/**
 * specialtyPackLoader — orchestrates loading a specialty add-on pack: entitlement gates,
 * same-code/cross-code in-flight dedup, and deciding WHERE bytes come from (platform-
 * storage cache vs network) and verifying their integrity before handing them off to be
 * merged into the base language pack.
 * Inputs: specialty pack code, base language memCache, manifest, purchasedAddOns.
 * Outputs: merged memCache[baseLang] with specialty cards appended; loadedAddOns updated.
 *
 * Called by:
 *   lib/packLoader.ts — specialty branch of loadPack (imports loadSpecialtyPack, clearSpecialtyCache (deprecated alias),
 *     getLoadedAddOns re-export). This is the primary consumer.
 *   store/entitlementStore.ts — imports resetSpecialtyLoadState directly for the license-clear flow.
 *
 * Side effects: fetch() I/O, memCache mutation (via lib/specialtyPackMerge → lib/packCache),
 *   loadedAddOns mutation (via lib/packCache — moved there in Task #328 to break a circular
 *   ES-module dependency), platform storage writes (via lib/specialtyPackMerge).
 * No React, no Zustand imports.
 *
 * Task #447 (Rule 1 — services ≤400 lines): the parse-verify-merge-persist "commit" step
 * (formerly this file's private _mergeFromJson) was extracted to lib/specialtyPackMerge.ts —
 * this file now owns only fetch/cache-hit orchestration and integrity verification; the
 * commit step lives there. See that file's header for the extraction rationale (mirrors
 * store/entitlementStore.ts → store/entitlementAddOns.ts, Task #412).
 */

import type { LoadPackResult, Manifest, PackMemCache } from "@/lib/packTypes";
import { SPECIALTY_PACKS } from "@/lib/langRegistry";
import { sha256Hex, packUrl } from "@/lib/utils";
import { createGenerationGuard } from "@/lib/generationGuard";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import {
  readCacheMeta,
  readCacheData,
  clearPackCache,
  isAddOnLoaded,
  clearLoadedAddOns,
  type CachedPackMeta,
} from "@/lib/packCache";
// loadedAddOns tracking (getLoadedAddOns / clearSpecialtyPacksForLang) moved to
// lib/packCache.ts in Task #328 to break the circular ES-module dependency.
export { getLoadedAddOns } from "@/lib/packCache";
// Task #447: the parse-verify-merge-persist "commit" step moved to its own module under
// Rule 1 (services ≤400 lines) — see lib/specialtyPackMerge.ts's header for the full
// extraction rationale.
import { mergeSpecialtyPackFromJson } from "@/lib/specialtyPackMerge";

// In-flight promises, keyed by BOTH specialty code and base language code.
// Specialty code key → same-code dedup: concurrent calls for the same code share one promise.
// Base language key → cross-code serialization: concurrent loads for the same base lang chain
// sequentially so neither merge overwrites the other. (Task #264)
const inFlight = new Map<string, Promise<LoadPackResult>>();

// Task #394: monotonically increasing generation, bumped by resetSpecialtyLoadState()
// (which store/entitlementStore.clearEntitlement calls on every deactivation).
// loadSpecialtyPack captures the current value AFTER its purchasedAddOns entitlement gate
// passes; mergeSpecialtyPackFromJson re-checks it before mutating memCache — TWICE (#409): once before
// starting the merge, and again bracketing the storage-persist awaits, mirroring
// lib/basePackLoader.ts's evictionGuard (#378 cycle-2, F-C2-1) instead of the hand-rolled,
// single-check counter this used to be. lib/ cannot read the live entitlement store (layer
// rule: lib/ never imports store/), so this guard stands in for "purchasedAddOns has not
// been reset since this load was validated". Without it, a load in flight during
// deactivation merges specialty content into a base pack that useLangPack's re-seed effect
// (#362) restored AFTER purchasedAddOns was already reset — post-deactivation access to
// paid content.
const deactivationGuard = createGenerationGuard();

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
  // entitlement snapshot is stale. mergeSpecialtyPackFromJson aborts on generation mismatch.
  deactivationGuard.bump();
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

// ── Offline-serve integrity ────────────────────────────────────────────────────

// #410, mirrors lib/basePackLoader.ts's staleBytesMatchRecordedHash (#378 cycle-2, naive
// finding): when a sha256 was recorded at cache time, re-verify the stale bytes against it
// before serving them through the offline/no-manifest fallback paths — the module header's
// "verifies" promise must hold on those paths too, not only when a manifest entry is
// available to check against. No recorded hash (meta lost, or the pack was cached without a
// manifest — sha256 stored as "") means shape validation (inside mergeSpecialtyPackFromJson) is the only
// available check, as before. Verification failure fails closed with a ref-ID log.
// TODO (tracked debt): identical logic to basePackLoader.ts's staleBytesMatchRecordedHash —
// a shared extraction is out of scope for this stream (would touch lib/packCache.ts, owned
// by a parallel stream this wave).
async function staleAddOnBytesMatchRecordedHash(
  lang: string,
  cachedMeta: CachedPackMeta | null,
  data: string,
): Promise<boolean> {
  const recorded = cachedMeta?.sha256;
  if (!recorded) return true;
  try {
    if ((await sha256Hex(data)) === recorded) return true;
    console.error(`[STALE_HASH_MISMATCH-${lang}-${Date.now()}] cached add-on bytes no longer match their recorded sha256 — refusing offline serve`);
    return false;
  } catch (err) {
    console.error(`[SHA_VERIFY_FAIL-${lang}-stale-${Date.now()}] sha256Hex threw during stale-cache verification — refusing offline serve`, err);
    return false;
  }
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
        const result = await mergeSpecialtyPackFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration, deactivationGuard);
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
      // serve cache as-is for offline graceful degradation, but only if it still matches
      // the sha256 recorded at cache time (#410). A stale-hash failure falls through
      // without eviction — the "!addOnManifestEntry" branch below re-checks the same
      // cachedData and fails closed with ADDON_NO_MANIFEST/checksum_mismatch.
      if (await staleAddOnBytesMatchRecordedHash(lang, cachedMeta, cachedData)) {
        const result = await mergeSpecialtyPackFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration, deactivationGuard);
        if (result.ok) return result;
        // Parse/shape failure — evict and fall through.
        await clearPackCache(lang);
      }
    }
  }

  // Download needed.
  // Fail-closed: require a manifest entry to verify integrity of freshly-downloaded bytes.
  // If the manifest has no entry for this specialty code AND we have a stale cache (version
  // mismatch), serve the stale cache — it was previously verified and a missing manifest entry
  // is indistinguishable from an offline condition for a registered specialty code.
  if (!addOnManifestEntry) {
    if (cachedData && (await staleAddOnBytesMatchRecordedHash(lang, cachedMeta, cachedData))) {
      return mergeSpecialtyPackFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration, deactivationGuard);
    }
    console.error(`[ADDON_NO_MANIFEST-${lang}-${Date.now()}] specialty pack absent from manifest — rejecting to prevent unverified merge`);
    return { ok: false, error: "checksum_mismatch" };
  }

  // Fetch the add-on pack JSON.
  // #445: bounded so a hung TCP connection can't leave loadSpecialtyPack's inFlight entry
  // permanently pending — mirrors lib/basePackLoader.ts's identical fix. A timeout
  // (abort-honored or #464 backstop-forced) surfaces as a rejected fetch, indistinguishable
  // from a real network error here, and is handled identically by the existing catch below.
  let addOnJson: string;
  try {
    // Task #464/#465: fetchWithTimeout owns the AbortController + independent
    // Promise.race backstop and the shared FETCH_TIMEOUT_MS constant — see
    // lib/fetchWithTimeout.ts.
    const res = await fetchWithTimeout(packUrl(lang), { cache: "no-store" });
    if (!res.ok) {
      // Offline fallback: serve stale cache (version-mismatched) if available and still
      // matches its recorded sha256 (#410).
      if (cachedData && (await staleAddOnBytesMatchRecordedHash(lang, cachedMeta, cachedData))) {
        return mergeSpecialtyPackFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration, deactivationGuard);
      }
      return { ok: false, error: "download_failed" };
    }
    addOnJson = await res.text();
  } catch (err) {
    console.error(`[ADDON_DOWNLOAD_FAIL-${lang}-${Date.now()}]`, err);
    if (cachedData && (await staleAddOnBytesMatchRecordedHash(lang, cachedMeta, cachedData))) {
      return mergeSpecialtyPackFromJson(lang, baseLang, memCache, cachedData, null, entryGeneration, deactivationGuard);
    }
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
  return mergeSpecialtyPackFromJson(lang, baseLang, memCache, addOnJson, addOnManifestEntry, entryGeneration, deactivationGuard);
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
  // purchasedAddOns gate above passed. mergeSpecialtyPackFromJson compares against the live value
  // right before mutating memCache (twice — #409); a resetSpecialtyLoadState() in between
  // (deactivation) invalidates this load.
  const entryGeneration = deactivationGuard.snapshot();

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

  // Task #494 audit fix: `prior` is an unrelated load's promise (possibly a different
  // specialty code sharing this base lang) — its own success or failure carries no
  // information about THIS attempt. A single-argument .then(onFulfilled) propagates a
  // rejected `prior` straight through, silently aborting this attempt without even
  // calling _doLoad — the exact class of bug lib/packLoader.ts:164-167 already fixed for
  // base-pack in-flight cleanup (see that file's own comment on why single-arg .then/
  // .finally is unsafe here). attemptLoad is reused for BOTH the fulfilled and rejected
  // branches of `prior` since only prior's SETTLEMENT (not its outcome) is needed for
  // the cross-code serialization Task #264 introduced this chain for.
  const attemptLoad = async (): Promise<LoadPackResult> => {
    // Re-check after the prior load settles: it may have already merged this code.
    if (isAddOnLoaded(lang)) {
      return { ok: true, pack: memCache.get(spec.baseLang)! } as LoadPackResult;
    }
    return _doLoad(lang, spec.baseLang, memCache, manifest, entryGeneration);
  };
  const promise: Promise<LoadPackResult> = prior.then(attemptLoad, attemptLoad);

  inFlight.set(lang, promise);
  inFlight.set(spec.baseLang, promise);

  // Task #494 audit fix: was `void promise.finally(() => {...})`. lib/packLoader.ts:159-163's
  // own comment already names exactly why that's unsafe here — `.finally()`'s returned
  // promise inherits `promise`'s rejection and re-throws it; void-ing that new promise
  // (rather than the original) still leaves an unhandled rejection with no catch anywhere.
  // Confirmed empirically: this test file's own #494 regression test threw a real
  // "Unhandled Rejection" (surfaced by Vitest) before this fix, using the exact same
  // `.then(cleanup, cleanup)` pattern packLoader.ts already uses for the identical reason.
  const cleanup = () => {
    if (inFlight.get(lang) === promise) inFlight.delete(lang);
    if (inFlight.get(spec.baseLang) === promise) inFlight.delete(spec.baseLang);
  };
  void promise.then(cleanup, cleanup);

  return promise;
}
