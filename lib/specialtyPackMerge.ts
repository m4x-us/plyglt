// ============================================================
// SPECIALTY PACK MERGE — parse-verify-merge-persist commit step for specialty add-on packs
// ============================================================
// The single "commit" step of the specialty-pack load pipeline: given specialty pack JSON
// (freshly downloaded or served from cache) and the base pack it extends, parses, shape-
// validates, re-checks the caller's deactivation-generation guard TWICE (once before
// merging, once bracketing the storage-persist writes — Task #409, mirrors
// lib/basePackLoader.ts's evictionGuard second-check pattern), merges the add-on's units
// into the base pack, and persists the verified bytes to platform storage.
// Extracted from lib/specialtyPackLoader.ts under Rule 1 (services ≤400 lines) during
// Task #447 remediation — that file's _doLoad owns fetch/cache-hit orchestration (deciding
// WHERE the bytes come from and verifying their integrity before handing them off); this
// module owns only the merge/commit step once verified bytes are already in hand.
// ============================================================
// DEPENDS ON: @/lib/packTypes (types + shape check), @/lib/generationGuard (GenerationGuard
//             TYPE only — this module receives the caller's own guard instance as a
//             parameter; it does not own or create one), @/lib/packCache (cache I/O +
//             markAddOnLoaded)
// USED BY: lib/specialtyPackLoader.ts ONLY. mergeSpecialtyPackFromJson is exported solely
//          so that file's _doLoad can call it — invoking it from anywhere else bypasses
//          loadSpecialtyPack's entitlement/base-pack-presence gates and is a stop-the-line
//          violation.
// ============================================================

import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack, LoadPackResult, PackMemCache, PackMeta } from "@/lib/packTypes";
import type { GenerationGuard } from "@/lib/generationGuard";
import { writeCacheMeta, writeCacheData, markAddOnLoaded, type CachedPackMeta } from "@/lib/packCache";

// Parses add-on JSON, merges units into the base pack in memCache, and optionally
// persists the bytes to platform storage. `manifestEntry` non-null → persist
// (fresh download with verified bytes); null → already persisted or serving stale cache.
// `deactivationGuard` is the caller's (lib/specialtyPackLoader.ts's) generation guard,
// passed in rather than imported so this module has no dependency on that file's other
// module-scope state (inFlight map, etc.) — only on the one guard instance it needs to
// re-check.
export async function mergeSpecialtyPackFromJson(
  lang: string,
  baseLang: string,
  memCache: PackMemCache,
  json: string,
  manifestEntry: PackMeta | null,
  entryGeneration: number,
  deactivationGuard: GenerationGuard,
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
  if (deactivationGuard.isStale(entryGeneration)) {
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

  // Second check (#409, mirrors lib/basePackLoader.ts's #378 cycle-2 F-C2-1): a deactivation
  // can land inside the awaited storage writes above. Its storage removal (evictPack →
  // clearPackCache, called by clearEntitlement BEFORE resetSpecialtyLoadState) is ordered
  // after these writes in packCache's per-code mutation chain, so storage ends clean either
  // way — but merging into memCache now, after the entitlement snapshot went stale, would
  // grant post-deactivation access to paid content. memCache.merge is deliberately deferred
  // to this point (moved out of its old pre-write position) specifically so this check can
  // gate it — re-checking after the fact could not have undone an already-completed merge.
  if (deactivationGuard.isStale(entryGeneration)) {
    console.warn(`[ADDON_STALE_ENTITLEMENT-${lang}-${Date.now()}] deactivation completed during storage write — merge aborted`);
    return { ok: false, error: "invalid_lang" };
  }

  // merge, not write: this is an additive update to an already-loaded base pack, not a fresh
  // replacement — it must NOT prune specialty tracking, since that would immediately undo the
  // markAddOnLoaded(lang) call on the next line. See PackMemCache's doc comment in lib/packTypes.ts.
  memCache.merge(baseLang, merged);
  markAddOnLoaded(lang);

  return { ok: true, pack: merged };
}
