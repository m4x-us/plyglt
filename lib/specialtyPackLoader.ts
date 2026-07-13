/**
 * specialtyPackLoader — loads and merges specialty packs into their base language pack.
 * Inputs: specialty pack code, base language memCache, manifest, purchasedAddOns.
 * Outputs: merged memCache[baseLang] with specialty cards appended; loadedAddOns updated.
 * Called by: lib/packLoader.ts (specialty branch of loadPack).
 * Side effects: fetch() I/O, memCache mutation, loadedAddOns mutation, platform storage writes.
 * No React, no Zustand imports.
 */

import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack, LoadPackResult, Manifest, PackMemCache, PackMeta } from "@/lib/packTypes";
import { SPECIALTY_PACKS } from "@/lib/langRegistry";
import { sha256Hex, packUrl } from "@/lib/utils";
import {
  readCacheMeta,
  writeCacheMeta,
  readCacheData,
  writeCacheData,
  clearPackCache,
  type CachedPackMeta,
} from "@/lib/packCache";

// ── In-memory tracking ────────────────────────────────────────────────────────

// Track which specialty add-on pack codes have been merged into their base pack
// this session. Each entry is the specialty code (e.g. "it-medical"); the merged
// units live inside the base pack's entry in memCache under the baseLang key.
const loadedAddOns: string[] = [];

// In-flight promises, keyed by BOTH specialty code and base language code.
// Specialty code key → same-code dedup: concurrent calls for the same code share one promise.
// Base language key → cross-code serialization: concurrent loads for the same base lang chain
// sequentially so neither merge overwrites the other. (Task #264)
const inFlight = new Map<string, Promise<LoadPackResult>>();

/**
 * Returns the list of specialty add-on pack codes merged this session.
 * Each entry is a specialty code (e.g. "it-medical") whose units have been
 * merged into the corresponding base pack entry in memCache.
 */
export function getLoadedAddOns(): string[] {
  return [...loadedAddOns];
}

/**
 * Resets specialty add-on tracking state.
 * @internal Called by packLoader.clearCacheForTesting — do not call directly in application code.
 */
export function clearSpecialtyCache(): void {
  loadedAddOns.length = 0;
  inFlight.clear();
  // Platform storage singleton is owned by lib/packCache.ts; reset happens via
  // packLoader.clearCacheForTesting → clearPackCacheState.
}

/**
 * Removes any specialty add-ons whose baseLang matches the evicted base pack.
 * Returns the list of specialty codes that were pruned. (#319)
 *
 * The return value is used by lib/packCache.clearPackCache to also clear each
 * pruned code's own persisted storage keys (pack-meta-v1-{code} / pack-data-v1-{code}).
 * Without this, evicting a base pack leaves orphaned specialty storage entries on disk —
 * they would be merged from cache on the next load without revalidating against the
 * current manifest or re-verifying sha256, even though their in-memory state was pruned.
 * Task #326 (store/entitlementStore.ts clearEntitlement) also reads this return value to
 * enumerate specialty codes to evict from memCache on license deactivation.
 */
export function clearSpecialtyPacksForLang(baseLang: string): string[] {
  const codesForBase = new Set(
    SPECIALTY_PACKS.filter(sp => sp.baseLang === baseLang).map(sp => sp.code),
  );
  const pruned: string[] = [];
  for (let i = loadedAddOns.length - 1; i >= 0; i--) {
    if (codesForBase.has(loadedAddOns[i]!)) {
      pruned.push(loadedAddOns[i]!);
      loadedAddOns.splice(i, 1);
    }
  }
  return pruned;
}

// ── Parse-merge-persist helper ────────────────────────────────────────────────

// Parses add-on JSON, merges units into the base pack in memCache, and optionally
// persists the bytes to platform storage. `manifestEntry` non-null → persist
// (fresh download with verified bytes); null → already persisted or serving stale cache.
async function _mergeFromJson(
  lang: string,
  baseLang: string,
  memCache: PackMemCache,
  json: string,
  manifestEntry: PackMeta | null,
): Promise<LoadPackResult> {
  let addOnPack: Pack;
  try {
    addOnPack = JSON.parse(json) as Pack;
  } catch (err) {
    console.error(`[ADDON_PARSE_FAIL-${lang}-${Date.now()}]`, err);
    return { ok: false, error: "parse_error" };
  }
  if (!hasValidUnitsArray(addOnPack)) {
    console.error(`[SHAPE_INVALID_FAIL-${lang}-${Date.now()}] add-on pack failed hasValidUnitsArray`);
    return { ok: false, error: "parse_error" };
  }

  // Task #310: guard against concurrent eviction of the base pack between the point where
  // loadSpecialtyPack checked memCache.has(baseLang) and the point where _doLoad runs
  // (after any prior in-flight serialization resolves). A non-null assertion here is a lie
  // if evictPack runs in that window; the thrown TypeError propagates through the inFlight-
  // chained promise and silently fails any other load chained behind it.
  const base = memCache.get(baseLang);
  if (!base) {
    return { ok: false, error: "base_pack_not_loaded" };
  }

  // Merge add-on units into the base pack — additive, never removes base units.
  const merged: Pack = {
    ...base,
    units:     [...base.units, ...addOnPack.units],
    unitCount: base.unitCount + addOnPack.unitCount,
    cardCount: base.cardCount + addOnPack.cardCount,
  };
  // merge, not write: this is an additive update to an already-loaded base pack, not a fresh
  // replacement — it must NOT prune specialty tracking, since that would immediately undo the
  // loadedAddOns.push(lang) two lines below. See PackMemCache's doc comment in lib/packTypes.ts.
  memCache.merge(baseLang, merged);
  loadedAddOns.push(lang);

  if (manifestEntry) {
    // Persist to platform storage. Meta is written FIRST so a crash or power-loss between
    // the two awaits leaves meta-without-data on disk, not data-without-meta. (#309)
    //
    // data-without-meta (old order, unsafe): on next launch, readCacheMeta returns null →
    // cacheVersionMatches = false → _doLoad falls through to the "!addOnManifestEntry"
    // offline path → if cachedData is non-null, _mergeFromJson is called with zero sha256
    // verification. The orphaned bytes are served as trusted content with no integrity check.
    //
    // meta-without-data (new order, safe): on next launch, readCacheData returns null →
    // cacheVersionMatches = false (cachedData is null) → _doLoad re-downloads and re-verifies.
    // The offline stale-cache path is unreachable because cachedData is null. Clean failure.
    try {
      await writeCacheMeta(lang, {
        version:  manifestEntry.version,
        sha256:   manifestEntry.sha256,
        cachedAt: Date.now(),
      } satisfies CachedPackMeta);
      await writeCacheData(lang, json);
    } catch (err) {
      console.error(`[ADDON_CACHE_WRITE_FAIL-${lang}-${Date.now()}] Storage write failed — pack available this session only:`, err);
    }
  }

  return { ok: true, pack: merged };
}

// ── Core download-verify-merge implementation ─────────────────────────────────

// Called only after locking checks pass.
// Precondition: baseLang is present in memCache and lang is not yet in loadedAddOns.
async function _doLoad(
  lang: string,
  baseLang: string,
  memCache: PackMemCache,
  manifest: Manifest | null,
): Promise<LoadPackResult> {
  const addOnManifestEntry = manifest?.packs?.[lang];

  // Read specialty pack cache from platform storage. (#269: add-ons now have their own keys)
  const [cachedMeta, initialCachedData] = await Promise.all([
    readCacheMeta(lang),
    readCacheData(lang),
  ]);
  let cachedData: string | null = initialCachedData;

  // Cache hit: version matches (or manifest absent for offline) and data is present.
  const cacheVersionMatches =
    cachedMeta !== null &&
    cachedData !== null &&
    (addOnManifestEntry === undefined || cachedMeta.version === addOnManifestEntry.version);

  if (cacheVersionMatches && cachedData) {
    if (addOnManifestEntry) {
      // Re-verify sha256 before trusting cached content — never serve unverified bytes.
      const actual = await sha256Hex(cachedData);
      if (actual === addOnManifestEntry.sha256) {
        const result = await _mergeFromJson(lang, baseLang, memCache, cachedData, null);
        if (result.ok) return result;
        // Parse/shape failure — evict corrupted cache and fall through to re-download.
        await clearPackCache(lang);
        cachedData = null;
      } else {
        // Hash mismatch — evict corrupted cache entry, re-download below.
        // A003: null out cachedData so the integrity-failed bytes can't be served as stale
        // fallback on the offline path below (mirrors packLoader.ts's A003 for base packs).
        await clearPackCache(lang);
        cachedData = null;
      }
    } else {
      // No manifest entry to compare against (manifest null or pack absent from it) —
      // serve cache as-is for offline graceful degradation.
      const result = await _mergeFromJson(lang, baseLang, memCache, cachedData, null);
      if (result.ok) return result;
      // Parse/shape failure — evict and fall through.
      await clearPackCache(lang);
    }
  }

  // Download needed.
  // Fail-closed: require a manifest entry to verify integrity of freshly-downloaded bytes.
  // If the manifest has no entry for this specialty code AND we have a stale cache (version
  // mismatch), serve the stale cache — it was previously verified and a missing manifest entry
  // is indistinguishable from an offline condition for a registered specialty code.
  if (!addOnManifestEntry) {
    if (cachedData) {
      return _mergeFromJson(lang, baseLang, memCache, cachedData, null);
    }
    console.error(`[ADDON_NO_MANIFEST-${lang}-${Date.now()}] specialty pack absent from manifest — rejecting to prevent unverified merge`);
    return { ok: false, error: "checksum_mismatch" };
  }

  // Fetch the add-on pack JSON.
  let addOnJson: string;
  try {
    const res = await fetch(packUrl(lang), { cache: "no-store" });
    if (!res.ok) {
      // Offline fallback: serve stale cache (version-mismatched) if available.
      if (cachedData) return _mergeFromJson(lang, baseLang, memCache, cachedData, null);
      return { ok: false, error: "download_failed" };
    }
    addOnJson = await res.text();
  } catch (err) {
    console.error(`[ADDON_DOWNLOAD_FAIL-${lang}-${Date.now()}]`, err);
    if (cachedData) return _mergeFromJson(lang, baseLang, memCache, cachedData, null);
    return { ok: false, error: "download_failed" };
  }

  // Verify sha256.
  const actual = await sha256Hex(addOnJson);
  if (actual !== addOnManifestEntry.sha256) {
    return { ok: false, error: "checksum_mismatch" };
  }

  // Parse, merge, and persist to storage (manifestEntry non-null → persist).
  return _mergeFromJson(lang, baseLang, memCache, addOnJson, addOnManifestEntry);
}

/**
 * Loads a specialty add-on pack and merges its units into the base pack in memCache.
 *
 * `purchasedAddOns` must be the caller's current list of purchased specialty pack codes.
 * Returns { ok: false, error: "invalid_lang" } when `lang` is not in that list — the
 * entitlement model is client-only and honour-system (CLAUDE.md §5, decision 2026-06-24),
 * but "no server check" does NOT mean the client skips its own local purchasedAddOns check.
 * (Task #261)
 *
 * Precondition: `lang` must be a ready specialty pack code (SPECIALTY_PACKS entry with ready:true).
 * The base pack (spec.baseLang) must already be present in memCache; if not, returns
 * { ok: false, error: "base_pack_not_loaded" }.
 *
 * Concurrent calls for the same lang share the in-flight promise (same-code dedup).
 * Concurrent calls for different specialty codes with the same base lang are serialized
 * to prevent the later merge from clobbering the earlier one. (Task #264)
 *
 * On success, the merged pack is written back to memCache[spec.baseLang] and the specialty
 * code is added to loadedAddOns. The verified bytes are also persisted to platform storage
 * under the specialty code's own keys so subsequent sessions skip the re-download. (#269)
 * Subsequent calls for the same code return the already-merged base pack immediately.
 *
 * Non-async: this function is deliberately not declared `async` so that the same-code dedup
 * path (`return existingForCode`) returns the exact same Promise reference rather than a new
 * async wrapper. This enables callers to observe promise reference equality for concurrent
 * same-code loads, which `async function` would prevent even with an in-flight guard. (#321)
 */
export function loadSpecialtyPack(
  lang: string,
  memCache: PackMemCache,
  manifest: Manifest | null,
  purchasedAddOns: string[],
): Promise<LoadPackResult> {
  // #272: Guard against callers that bypass loadPack's isReadySpecialtyPackCode pre-check.
  // Returns a typed LoadPackResult error instead of throwing a raw TypeError on .baseLang access.
  const spec = SPECIALTY_PACKS.find(sp => sp.code === lang && sp.ready);
  if (!spec) {
    return Promise.resolve({ ok: false, error: "invalid_lang" });
  }

  // #261: Client-side entitlement gate. "client-only, honour-system" (CLAUDE.md §5) means no
  // server verification — it does NOT mean the client is exempt from checking its own local
  // purchasedAddOns state. Without this check, any user can load any specialty pack for free
  // by calling loadPack directly with a registered specialty code.
  if (!purchasedAddOns.includes(lang)) {
    return Promise.resolve({ ok: false, error: "invalid_lang" });
  }

  if (!memCache.has(spec.baseLang)) {
    return Promise.resolve({ ok: false, error: "base_pack_not_loaded" });
  }

  // Already merged this session — return the base pack (which has merged units).
  if (loadedAddOns.includes(lang)) {
    return Promise.resolve({ ok: true, pack: memCache.get(spec.baseLang)! });
  }

  // Same-code dedup: return the SAME in-flight promise reference if this code is already loading.
  // This function is non-async precisely so that `return existingForCode` returns the exact same
  // Promise object — an async function would always wrap it in a new Promise. loadPack's
  // `return loadSpecialtyPack(...)` (also a direct return in a non-async specialtyPack call)
  // passes the reference through to the caller, making p1 === p2 for concurrent same-code loads.
  const existingForCode = inFlight.get(lang);
  if (existingForCode) return existingForCode;

  // Cross-code serialization: chain behind any in-flight load for the same base lang.
  // Without this, two concurrent specialty loads for the same base lang both read the
  // same pre-merge base snapshot; whichever merge resolves last silently discards the
  // other's units when it calls memCache.merge() with a stale base. (Task #264)
  const prior: Promise<unknown> = inFlight.get(spec.baseLang) ?? Promise.resolve();

  const promise: Promise<LoadPackResult> = prior.then(async () => {
    // Re-check after the prior load completes: it may have already merged this code.
    if (loadedAddOns.includes(lang)) {
      return { ok: true, pack: memCache.get(spec.baseLang)! } as LoadPackResult;
    }
    return _doLoad(lang, spec.baseLang, memCache, manifest);
  });

  inFlight.set(lang, promise);
  inFlight.set(spec.baseLang, promise);

  void promise.finally(() => {
    if (inFlight.get(lang) === promise) inFlight.delete(lang);
    if (inFlight.get(spec.baseLang) === promise) inFlight.delete(spec.baseLang);
  });

  return promise;
}
