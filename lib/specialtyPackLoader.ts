/**
 * specialtyPackLoader — loads and merges specialty packs into their base language pack.
 * Inputs: specialty pack code, base language memCache, manifest.
 * Outputs: merged memCache[baseLang] with specialty cards appended; loadedAddOns updated.
 * Called by: lib/packLoader.ts (specialty branch of loadPack).
 * Side effects: fetch() I/O, memCache mutation, loadedAddOns mutation.
 * No React, no Zustand imports.
 */

import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack, LoadPackResult, Manifest, PackMemCache } from "@/lib/packTypes";
import { SPECIALTY_PACKS } from "@/lib/langRegistry";
import { sha256Hex, packUrl } from "@/lib/utils";

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
}

/**
 * Removes any specialty add-ons whose baseLang matches the evicted base pack.
 * Called by packLoader.evictPack so evicting a base pack also prunes its merged add-ons.
 */
export function clearSpecialtyPacksForLang(baseLang: string): void {
  const codesForBase = new Set(
    SPECIALTY_PACKS.filter(sp => sp.baseLang === baseLang).map(sp => sp.code),
  );
  for (let i = loadedAddOns.length - 1; i >= 0; i--) {
    if (codesForBase.has(loadedAddOns[i]!)) {
      loadedAddOns.splice(i, 1);
    }
  }
}

// Core download-verify-merge implementation. Called only after locking checks pass.
// Precondition: baseLang is present in memCache and lang is not yet in loadedAddOns.
async function _doLoad(
  lang: string,
  baseLang: string,
  memCache: PackMemCache,
  manifest: Manifest | null,
): Promise<LoadPackResult> {
  // Download the add-on pack JSON.
  let addOnJson: string;
  try {
    const res = await fetch(packUrl(lang), { cache: "no-store" });
    if (!res.ok) return { ok: false, error: "download_failed" };
    addOnJson = await res.text();
  } catch (err) {
    console.error(`[ADDON_DOWNLOAD_FAIL-${lang}]`, err);
    return { ok: false, error: "download_failed" };
  }

  // Fail-closed SHA-256 integrity check. If the manifest has no entry for this
  // add-on code, reject the download entirely — arbitrary content must never be
  // merged into the base pack without integrity verification. (Task #265)
  const addOnManifestEntry = manifest?.packs?.[lang];
  if (!addOnManifestEntry) {
    console.error(`[ADDON_NO_MANIFEST-${lang}] specialty pack absent from manifest — rejecting to prevent unverified merge`);
    return { ok: false, error: "checksum_mismatch" };
  }
  const actual = await sha256Hex(addOnJson);
  if (actual !== addOnManifestEntry.sha256) {
    return { ok: false, error: "checksum_mismatch" };
  }

  // Parse the add-on pack.
  let addOnPack: Pack;
  try {
    addOnPack = JSON.parse(addOnJson) as Pack;
  } catch (err) {
    console.error(`[ADDON_PARSE_FAIL-${lang}]`, err);
    return { ok: false, error: "parse_error" };
  }
  if (!hasValidUnitsArray(addOnPack)) {
    console.error(`[SHAPE_INVALID_FAIL-${lang}] add-on pack failed hasValidUnitsArray`);
    return { ok: false, error: "parse_error" };
  }

  // Merge add-on units into the base pack — additive, never removes base units.
  const base = memCache.get(baseLang)!;
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
  return { ok: true, pack: merged };
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
 * code is added to loadedAddOns. Subsequent calls for the same code return the already-merged
 * base pack immediately.
 */
export async function loadSpecialtyPack(
  lang: string,
  memCache: PackMemCache,
  manifest: Manifest | null,
  purchasedAddOns: string[],
): Promise<LoadPackResult> {
  // #272: Guard against callers that bypass loadPack's isReadySpecialtyPackCode pre-check.
  // Returns a typed LoadPackResult error instead of throwing a raw TypeError on .baseLang access.
  const spec = SPECIALTY_PACKS.find(sp => sp.code === lang && sp.ready);
  if (!spec) {
    return { ok: false, error: "invalid_lang" };
  }

  // #261: Client-side entitlement gate. "client-only, honour-system" (CLAUDE.md §5) means no
  // server verification — it does NOT mean the client is exempt from checking its own local
  // purchasedAddOns state. Without this check, any user can load any specialty pack for free
  // by calling loadPack directly with a registered specialty code.
  if (!purchasedAddOns.includes(lang)) {
    return { ok: false, error: "invalid_lang" };
  }

  if (!memCache.has(spec.baseLang)) {
    return { ok: false, error: "base_pack_not_loaded" };
  }

  // Already merged this session — return the base pack (which has merged units).
  if (loadedAddOns.includes(lang)) {
    return { ok: true, pack: memCache.get(spec.baseLang)! };
  }

  // Same-code dedup: return the in-flight promise if this code is already loading.
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
