/**
 * specialtyPackLoader — loads and merges specialty packs into their base language pack.
 * Inputs: specialty pack code, base language memCache, manifest, purchasedAddOns.
 * Outputs: merged memCache[baseLang] with specialty cards appended; loadedAddOns updated.
 *
 * Called by:
 *   lib/packLoader.ts — specialty branch of loadPack (imports loadSpecialtyPack, clearSpecialtyCache (deprecated alias),
 *     getLoadedAddOns re-export). This is the primary consumer.
 *   store/entitlementStore.ts — imports resetSpecialtyLoadState directly for the license-clear flow.
 *
 * Side effects: fetch() I/O, memCache mutation (via lib/packCache), loadedAddOns mutation
 *   (via lib/packCache — moved there in Task #328 to break a circular ES-module dependency),
 *   platform storage writes.
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
  isAddOnLoaded,
  markAddOnLoaded,
  clearLoadedAddOns,
  type CachedPackMeta,
} from "@/lib/packCache";
// loadedAddOns tracking (getLoadedAddOns / clearSpecialtyPacksForLang) moved to
// lib/packCache.ts in Task #328 to break the circular ES-module dependency.
export { getLoadedAddOns } from "@/lib/packCache";

// In-flight promises, keyed by BOTH specialty code and base language code.
// Specialty code key → same-code dedup: concurrent calls for the same code share one promise.
// Base language key → cross-code serialization: concurrent loads for the same base lang chain
// sequentially so neither merge overwrites the other. (Task #264)
const inFlight = new Map<string, Promise<LoadPackResult>>();

// Task #394: monotonically increasing generation, incremented by resetSpecialtyLoadState()
// (which store/entitlementStore.clearEntitlement calls on every deactivation).
// loadSpecialtyPack captures the current value AFTER its purchasedAddOns entitlement gate
// passes; _mergeFromJson re-checks it immediately before mutating memCache. lib/ cannot
// read the live entitlement store (layer rule: lib/ never imports store/), so this counter
// stands in for "purchasedAddOns has not been reset since this load was validated".
// Without it, a load in flight during deactivation merges specialty content into a base
// pack that useLangPack's re-seed effect (#362) restored AFTER purchasedAddOns was already
// reset — post-deactivation access to paid content.
let deactivationGeneration = 0;

/**
 * Resets specialty-pack LOAD STATE only: loadedAddOns bookkeeping (owned by lib/packCache
 * — clearLoadedAddOns() resets it there, #328), the in-flight promise map, and the
 * deactivation generation (invalidating any in-flight merge, #394).
 *
 * Deliberately does NOT touch memCache — merged pack data lives there and is evicted
 * separately via evictPack (see store/entitlementStore.clearEntitlement, which must run
 * its evictions BEFORE calling this). Named for what it does (Task #385, Rule 10): the
 * old name clearSpecialtyCache implied memCache eviction and needed disclaimer comments
 * at every call site.
 * @internal Called by packLoader.clearCacheForTesting and store/entitlementStore.clearEntitlement.
 */
export function resetSpecialtyLoadState(): void {
  clearLoadedAddOns();
  inFlight.clear();
  // Task #394: any load validated before this point must not merge after it — its
  // entitlement snapshot is stale. _mergeFromJson aborts on generation mismatch.
  deactivationGeneration++;
  // Platform storage singleton is owned by lib/packCache.ts; reset happens via
  // packLoader.clearCacheForTesting → clearPackCacheState.
}

/**
 * @deprecated Alias for resetSpecialtyLoadState — the old name overpromised (it never
 * touched memCache; Task #385). Kept so lib/packLoader.ts (owned by a parallel stream
 * this wave) keeps compiling; migrate remaining call sites to resetSpecialtyLoadState
 * (same pattern as the isReadySpecialtyPackCode → isSpecialtyPackCode migration, #361).
 */
export const clearSpecialtyCache = resetSpecialtyLoadState;

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
  entryGeneration: number,
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

  // Task #394: re-validate the entitlement snapshot immediately before merging — not just
  // at loadSpecialtyPack's entry. A deactivation (clearEntitlement → resetSpecialtyLoadState)
  // that completed while this load was in flight reset purchasedAddOns; merging now would
  // hand the user post-deactivation access to paid content (and re-persist its storage
  // keys after eviction just pruned them). "invalid_lang" mirrors the entry gate's code
  // for a not-purchased add-on — that is exactly what this add-on has become.
  if (entryGeneration !== deactivationGeneration) {
    console.warn(`[ADDON_STALE_ENTITLEMENT-${lang}-${Date.now()}] deactivation completed while load was in flight — merge aborted`);
    return { ok: false, error: "invalid_lang" };
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
  // markAddOnLoaded(lang) call on the next line. See PackMemCache's doc comment in lib/packTypes.ts.
  memCache.merge(baseLang, merged);
  markAddOnLoaded(lang);

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
  entryGeneration: number,
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
      // Wrapped in try/catch (#405, mirrors basePackLoader's #378 F002 SHA_VERIFY_FAIL
      // pattern): a crypto.subtle failure must surface as a typed { ok: false } result
      // with a ref-ID log, not a rejection of the shared in-flight promise.
      let actual: string;
      try {
        actual = await sha256Hex(cachedData);
      } catch (err) {
        console.error(`[SHA_VERIFY_FAIL-${lang}-${Date.now()}] sha256Hex threw during cached-copy verification — treating pack as unverifiable`, err);
        return { ok: false, error: "checksum_mismatch" };
      }
      if (actual === addOnManifestEntry.sha256) {
        const result = await _mergeFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration);
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
      const result = await _mergeFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration);
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
      return _mergeFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration);
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
      if (cachedData) return _mergeFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration);
      return { ok: false, error: "download_failed" };
    }
    addOnJson = await res.text();
  } catch (err) {
    console.error(`[ADDON_DOWNLOAD_FAIL-${lang}-${Date.now()}]`, err);
    if (cachedData) return _mergeFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration);
    return { ok: false, error: "download_failed" };
  }

  // Verify sha256.
  // Wrapped in try/catch (#405, mirrors basePackLoader's #378 F002 SHA_VERIFY_FAIL
  // pattern): a crypto.subtle failure must surface as a typed { ok: false } result
  // with a ref-ID log, not a rejection of the shared in-flight promise.
  let actual: string;
  try {
    actual = await sha256Hex(addOnJson);
  } catch (err) {
    console.error(`[SHA_VERIFY_FAIL-${lang}-${Date.now()}] sha256Hex threw during fresh-download verification — treating pack as unverifiable`, err);
    return { ok: false, error: "checksum_mismatch" };
  }
  if (actual !== addOnManifestEntry.sha256) {
    return { ok: false, error: "checksum_mismatch" };
  }

  // Parse, merge, and persist to storage (manifestEntry non-null → persist).
  return _mergeFromJson(lang, baseLang, memCache, addOnJson, addOnManifestEntry, entryGeneration);
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
 * async wrapper. This guarantees p1 === p2 for concurrent direct loadSpecialtyPack calls with
 * the same code. Note: callers that go through loadPack (which is declared `async`) receive a
 * new Promise wrapper regardless — reference equality holds only for direct loadSpecialtyPack
 * callers. (#321, #365)
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

  // Task #394: snapshot the deactivation generation now — immediately after the
  // purchasedAddOns gate above passed. _mergeFromJson compares against the live value
  // right before mutating memCache; a resetSpecialtyLoadState() in between (deactivation)
  // invalidates this load.
  const entryGeneration = deactivationGeneration;

  // Already merged this session — return the base pack (which has merged units).
  if (isAddOnLoaded(lang)) {
    return Promise.resolve({ ok: true, pack: memCache.get(spec.baseLang)! });
  }

  // Same-code dedup: return the SAME in-flight promise reference if this code is already loading.
  // This function is non-async precisely so that `return existingForCode` returns the exact same
  // Promise object — an async function would always wrap it in a new Promise.
  const existingForCode = inFlight.get(lang);
  if (existingForCode) return existingForCode;

  // Cross-code serialization: chain behind any in-flight load for the same base lang.
  // Without this, two concurrent specialty loads for the same base lang both read the
  // same pre-merge base snapshot; whichever merge resolves last silently discards the
  // other's units when it calls memCache.merge() with a stale base. (Task #264)
  const prior: Promise<unknown> = inFlight.get(spec.baseLang) ?? Promise.resolve();

  const promise: Promise<LoadPackResult> = prior.then(async () => {
    // Re-check after the prior load completes: it may have already merged this code.
    if (isAddOnLoaded(lang)) {
      return { ok: true, pack: memCache.get(spec.baseLang)! } as LoadPackResult;
    }
    return _doLoad(lang, spec.baseLang, memCache, manifest, entryGeneration);
  });

  inFlight.set(lang, promise);
  inFlight.set(spec.baseLang, promise);

  void promise.finally(() => {
    if (inFlight.get(lang) === promise) inFlight.delete(lang);
    if (inFlight.get(spec.baseLang) === promise) inFlight.delete(spec.baseLang);
  });

  return promise;
}
