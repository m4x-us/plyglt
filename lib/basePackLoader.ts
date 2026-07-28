// ============================================================
// BASE PACK LOADER — storage/network load path for base language packs
// ============================================================
// The heavy half of loadPack: platform-storage cache validation, sha256
// integrity verification, network download, offline stale-cache fallback,
// and the eviction-generation guard that stops an in-flight load from
// resurrecting a pack evictPack just cleared.
// Extracted from lib/packLoader.ts under Rule 1 (services ≤400 lines) during
// Task #378 remediation — packLoader.ts keeps the public API, validation
// gates, and in-flight dedup; this module owns only the load mechanics.
// ============================================================
// DEPENDS ON: @/lib/packCache (cache I/O), @/lib/packTypes (types + shape check),
//             @/lib/utils (sha256Hex, packUrl), @/lib/generationGuard (the shared
//             snapshot/bump/isStale primitive behind evictionGuards),
//             @/lib/fetchWithTimeout (bounded fetch — Task #464/#465)
// USED BY (Task #428 — corrected, mechanically enforced by the poka-yoke test
//          "lib/basePackLoader.ts is imported by exactly its two legal callers" in
//          tests/packLoader.test.ts): TWO legal importers.
//   - lib/packLoader.ts — the real runtime caller. loadBasePackFromStorageOrNetwork is
//     exported solely so packLoader can call it — invoking it from anywhere else bypasses
//     loadPack's allowlist, entitlement, memory-hit, and dedup gates and is a
//     stop-the-line violation. bumpEvictionGeneration is called from 2 sites here: evictPack
//     (evicting a language) and loadPack's forced-reload branch (a forced call superseding
//     an already-pending normal load for the same language, #378 cycle-2 N3).
//     resetAllEvictionGuardsForTesting (test-only) is called from clearCacheForTesting.
//   - lib/packResolver.ts — imports the LoadPackOptions TYPE only (erased at compile time,
//     so it cannot bypass any runtime gate) to type its own function signatures.
// Comment refs (#NNN = task, FNNN/K2-*/N*/F-C2-* = audit findings): resolve via
// `git log -S "<ref>"` or .autocode/ history; the prose carries the WHY on its own.
// ============================================================

import { sha256Hex, packUrl } from "@/lib/utils";
import { createGenerationGuard, type GenerationGuard } from "@/lib/generationGuard";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Manifest, Pack, LoadPackResult } from "@/lib/packTypes";
import {
  readCacheMeta,
  readCacheData,
  writeCacheData,
  writeCacheMeta,
  clearPackCache,
  cacheAndReturn,
  validateAndCache,
  parseValidateAndCache,
  type CachedPackMeta,
} from "@/lib/packCache";

/** Options accepted by loadPack and this module's load path. Single named type so the two
 * signatures cannot drift (#378 audit F005 — parallel-literal ban, AGENTS.md).
 * forceRedownload applies to BASE packs only: loadPack's specialty branch delegates to
 * loadSpecialtyPack, which has no force parameter — a forced specialty reload is a
 * DELIBERATE no-op serving the merged cached copy (#378 audit F026, confirmed and made
 * observable by Task #432). Not a missing feature: a specialty pack's units are merged
 * additively into its base pack (`_mergeFromJson` appends, never replaces), and
 * `isAddOnLoaded(lang)` — the guard a forced reload would need to bypass — is the ONLY
 * thing preventing a second merge of the same units into the same base pack. Every
 * existing path that clears `isAddOnLoaded` (clearPackCache's specialty-key eviction,
 * PackMemCacheImpl.write's specialty cleanup) ALSO resets the base pack itself first, so
 * the invariant "isAddOnLoaded(lang) === false implies the base pack contains none of
 * lang's units yet" always holds. Bypassing that guard via a bolted-on forceRedownload
 * without also implementing a real "unmerge" step would duplicate every unit from a
 * previously-merged specialty pack. loadPack's specialty branch instead logs a
 * FORCE_REDOWNLOAD_NOOP warning when this option is set for a specialty code, so the
 * no-op is observable (Rule 8) rather than a silent swallow — see lib/packLoader.ts. */
export interface LoadPackOptions {
  forceRedownload?: boolean;
  purchasedAddOns?: string[];
  unlockedLangs?: string[];
}

// Bumped by evictPack BEFORE it clears caches (and by loadPack when a forced re-download
// starts, so an already-pending normal load cannot clobber the forced load's fresh bytes).
// loadBasePackFromStorageOrNetwork snapshots this at entry and skips every cache write when
// the snapshot is stale, so a load that was in flight when an eviction ran can never
// resurrect the evicted pack in memCache or storage. Same class of guard as
// specialtyPackLoader's deactivationGeneration (Task #394) — Rule 19b symmetry, #378 F001.
// Shared primitive (lib/generationGuard.ts) — same shape as specialtyPackLoader's
// deactivationGeneration; that file's adoption is complete (Task #394/#447/#456), not a
// carry-forward.
//
// KEYED PER LANGUAGE (Task #436): a single global counter meant evicting "es" also voided
// an unrelated, already in-flight "it" load's right to cache — that load still served
// correct data for its one call, but was silently forced to re-download on every
// subsequent load until its next successful write. One guard instance per language code
// scopes an eviction's invalidation to only the language actually being evicted.
const evictionGuards = new Map<string, GenerationGuard>();

function getEvictionGuard(lang: string): GenerationGuard {
  let guard = evictionGuards.get(lang);
  if (!guard) {
    guard = createGenerationGuard();
    evictionGuards.set(lang, guard);
  }
  return guard;
}

/** Invalidates every in-flight base-pack load's right to write back to cache — for `lang`
 * only. Called by evictPack (lib/packLoader.ts) before it clears anything, and by loadPack
 * when a forced re-download supersedes an already-pending normal load for the same lang. */
export function bumpEvictionGeneration(lang: string): void {
  getEvictionGuard(lang).bump();
}

// #445: no fetch call in this module had a timeout — a single hung TCP connection left
// its in-flight promise (packLoader.ts's inFlightBaseLoads entry) permanently pending, so
// every concurrent AND future caller for that language piggybacked on the dead promise for
// the rest of the process's life. fetchWithTimeout (Task #464/#465) guarantees the fetch
// below always settles — via AbortController AND an independent Promise.race backstop,
// reading the one shared FETCH_TIMEOUT_MS constant — which flows into the EXISTING catch
// block's typed download_failed/offline-fallback handling — no new error path needed,
// just a bound on how long the network is allowed to stay silent.

/** Test-only: invalidates every currently-tracked language's eviction guard at once —
 * clearCacheForTesting resets ALL state globally, not one language's, so a load left in
 * flight by a previous test (for any language) must not write into the cache this reset
 * just cleared. Languages never loaded have no guard yet and nothing in flight to
 * invalidate, so only tracked entries need bumping.
 * @internal Test use only — do not call in application code. */
export function resetAllEvictionGuardsForTesting(): void {
  for (const guard of evictionGuards.values()) guard.bump();
}

/**
 * The storage/network base-pack load path — everything past the validation gates, specialty
 * delegation, memory hit, and in-flight dedup of loadPack. Serves the platform-storage cache
 * when it is valid; otherwise downloads (the name says exactly that — it is NOT
 * unconditionally fresh). See the header USED BY warning: loadPack is the only legal caller.
 */
export async function loadBasePackFromStorageOrNetwork(
  lang: string,
  manifest: Manifest | null,
  options?: LoadPackOptions
): Promise<LoadPackResult> {
  const evictionGuard = getEvictionGuard(lang);
  const entryGeneration = evictionGuard.snapshot();
  const manifestEntry = manifest?.packs?.[lang];
  const [cachedMeta, initialCachedData] = await Promise.all([
    readCacheMeta(lang),
    readCacheData(lang),
  ]);
  let cachedData: string | null = initialCachedData;

  // Cache hit: version matches and data is present
  const cacheValid =
    !options?.forceRedownload &&
    cachedMeta !== null &&
    cachedData !== null &&
    (manifestEntry === undefined || cachedMeta.version === manifestEntry.version);

  if (cacheValid && cachedData) {
    try {
      if (manifestEntry) {
        // Re-verify hash — never trust data that might have been corrupted since caching
        const actual = await sha256Hex(cachedData);
        if (actual !== manifestEntry.sha256) {
          // clearPackCache also prunes specialty tracking for lang (see its doc comment) — this
          // branch is only reachable when memCache.has(lang) was already false (the memory-hit
          // check in loadPack would have short-circuited otherwise), so there is never a merged
          // specialty pack in memCache here to worry about pruning stale; the prune still runs,
          // it's simply a no-op in that case. The guarantee holds regardless of this invariant.
          await clearPackCache(lang);
          cachedData = null; // A003: prevent integrity-failed bytes from reaching stale-cache fallback
          // fall through to re-download
        } else {
          // JSON.parse stays inside this outer try (not routed through parseValidateAndCache) so a
          // throw here falls through to attempt a fresh download below, rather than erroring
          // immediately — no download has been attempted yet at this point in the function.
          const pack = JSON.parse(cachedData) as Pack;
          if (evictionGuard.isStale(entryGeneration)) return validateWithoutCaching(pack);
          return await validateAndCache(lang, pack);
        }
      } else {
        // No manifest to compare against — serve cache as-is (offline degradation).
        // Same fall-through-on-parse-throw reasoning as the branch above.
        const pack = JSON.parse(cachedData) as Pack;
        if (evictionGuard.isStale(entryGeneration)) return validateWithoutCaching(pack);
        return await validateAndCache(lang, pack);
      }
    } catch (err) {
      console.error(`[CACHE_PARSE_FAIL-${Date.now()}]`, err);
      await clearPackCache(lang);
      // Known-unparseable bytes must not reach the stale-cache fallback below — same
      // rationale as the A003 null after a hash mismatch. Without this, a failed download
      // would re-parse the same bytes, double-evict, and surface parse_error where
      // download_failed is the truthful cause. (#378 cycle-2 naive finding)
      cachedData = null;
      // fall through to re-download
    }
  }

  // Download needed
  let json: string;
  try {
    // Task #464/#465: fetchWithTimeout owns the AbortController + independent
    // Promise.race backstop and the shared FETCH_TIMEOUT_MS constant — see
    // lib/fetchWithTimeout.ts.
    const res = await fetchWithTimeout(packUrl(lang), { cache: "no-store" });
    if (!res.ok) {
      // Offline fallback: serve stale cache if available (integrity-checked when possible)
      if (cachedData && (await staleBytesMatchRecordedHash(cachedMeta, cachedData))) {
        if (evictionGuard.isStale(entryGeneration)) return parseValidateWithoutCaching(cachedData);
        return await parseValidateAndCache(lang, cachedData);
      }
      return { ok: false, error: "download_failed" };
    }
    json = await res.text();
  } catch (err) {
    // Network error OR a #445/#464 timeout (abort-honored or backstop-forced) — both
    // surface as a rejected fetch, indistinguishable here and handled identically: serve
    // stale cache (integrity-checked when possible), or fail typed.
    console.error(`[PACK_DOWNLOAD_FAIL-${Date.now()}]`, err);
    if (cachedData && (await staleBytesMatchRecordedHash(cachedMeta, cachedData))) {
      if (evictionGuard.isStale(entryGeneration)) return parseValidateWithoutCaching(cachedData);
      return await parseValidateAndCache(lang, cachedData);
    }
    return { ok: false, error: "download_failed" };
  }

  // Verify sha256 if manifest is available — never serve a corrupted pack.
  // Wrapped in try/catch (#378 audit F002): a crypto.subtle failure must surface as a typed
  // { ok: false } result with a ref-ID log, not a rejection — the cache-hit sha256 above is
  // already inside a try; this path gets the same protection so loadPack's no-reject
  // contract is enforced on both verification sites. Fail closed: unverifiable bytes are
  // treated exactly like corrupted bytes.
  if (manifestEntry) {
    let actual: string;
    try {
      actual = await sha256Hex(json);
    } catch (err) {
      console.error(`[SHA_VERIFY_FAIL-${lang}-${Date.now()}] sha256Hex threw during fresh-download verification — treating pack as unverifiable`, err);
      return { ok: false, error: "checksum_mismatch" };
    }
    if (actual !== manifestEntry.sha256) {
      // Do NOT write corrupted data to cache
      return { ok: false, error: "checksum_mismatch" };
    }
  }

  // Parse. Failure here is NOT routed through parseValidateAndCache/evictAndReject: these are
  // freshly-downloaded bytes, not previously-cached ones, so there is nothing of this data's own
  // to evict — a malformed server response must not blow away an existing, still-good local cache.
  let pack: Pack;
  try {
    pack = JSON.parse(json) as Pack;
  } catch (err) {
    console.error(`[PACK_PARSE_FAIL-${Date.now()}]`, err);
    return { ok: false, error: "parse_error" };
  }

  if (!hasValidUnitsArray(pack)) {
    console.error(`[SHAPE_INVALID_FAIL-${lang}-${Date.now()}] freshly-downloaded pack failed hasValidUnitsArray`);
    return { ok: false, error: "parse_error" };
  }

  if (evictionGuard.isStale(entryGeneration)) {
    // An eviction ran while this download was in flight. Serve the verified pack to the
    // caller that initiated the load (UI entitlement gates re-check on every render), but
    // write NOTHING back — a memCache/storage write here would silently resurrect the pack
    // that evictPack just cleared for the whole dedup'd cohort (#378 audit F001).
    return { ok: true, pack };
  }

  // Atomic-style cache write: META FIRST, then data (#378 audit F025 — mirrors Task #309's
  // fix in specialtyPackLoader). Meta-without-data is safe: cacheValid requires both, so the
  // next launch re-downloads. Data-without-meta (the old order, unsafe) leaves orphaned
  // bytes that the offline stale-cache fallback serves via parseValidateAndCache with ZERO
  // sha256 re-verification — integrity-unchecked content reaching the user.
  // QuotaExceededError is caught here — the pack is still valid and goes into memCache for
  // this session. It will be re-downloaded on next launch.
  try {
    await writeCacheMeta(lang, {
      version: manifestEntry?.version ?? pack.packVersion,
      sha256: manifestEntry?.sha256 ?? "",
      cachedAt: Date.now(),
    });
    await writeCacheData(lang, json);
  } catch (err) {
    console.error(`[PACK_CACHE_WRITE_FAIL-${lang}] Storage write failed — pack available this session only:`, err);
  }
  if (evictionGuard.isStale(entryGeneration)) {
    // Second check (#378 cycle-2 F-C2-1): an eviction can land inside the awaited storage
    // writes above. Its storage removals are ordered after these writes in packCache's
    // per-code mutation chain, so storage ends clean — but the memCache.write inside
    // cacheAndReturn would resurrect the pack. Re-check in the same synchronous span as
    // the write, mirroring _mergeFromJson's zero-await check-to-write distance (Rule 19b).
    return { ok: true, pack };
  }
  return cacheAndReturn(lang, pack);
}

/** Offline stale-serve integrity (#378 cycle-2, naive finding): when a sha256 was recorded
 * at cache time, re-verify the stale bytes against it before serving — the module header's
 * "verifies" promise must hold on the offline path too, not only on downloads. No recorded
 * hash (meta lost, or the pack was cached without a manifest — sha256 stored as "") means
 * shape validation is the only available check, as before. Verification failure fails
 * closed with a ref-ID log. */
async function staleBytesMatchRecordedHash(
  cachedMeta: CachedPackMeta | null,
  data: string
): Promise<boolean> {
  const recorded = cachedMeta?.sha256;
  if (!recorded) return true;
  try {
    if ((await sha256Hex(data)) === recorded) return true;
    console.error(`[STALE_HASH_MISMATCH-${Date.now()}] cached bytes no longer match their recorded sha256 — refusing offline serve`);
    return false;
  } catch (err) {
    console.error(`[SHA_VERIFY_FAIL-stale-${Date.now()}] sha256Hex threw during stale-cache verification — refusing offline serve`, err);
    return false;
  }
}

/** Shape-check WITHOUT caching — the post-eviction path of an in-flight load (see
 * evictionGeneration). Serving is allowed; writing back is not. */
function validateWithoutCaching(pack: Pack): LoadPackResult {
  if (!hasValidUnitsArray(pack)) {
    console.error(`[SHAPE_INVALID_FAIL-stale-${Date.now()}] post-eviction pack failed hasValidUnitsArray`);
    return { ok: false, error: "parse_error" };
  }
  return { ok: true, pack };
}

/** Parse + shape-check WITHOUT caching — post-eviction variant of parseValidateAndCache. */
function parseValidateWithoutCaching(json: string): LoadPackResult {
  let pack: Pack;
  try {
    pack = JSON.parse(json) as Pack;
  } catch (err) {
    console.error(`[STALE_PARSE_FAIL-${Date.now()}]`, err);
    return { ok: false, error: "parse_error" };
  }
  return validateWithoutCaching(pack);
}
