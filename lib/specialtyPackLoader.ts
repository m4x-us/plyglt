/**
 * specialtyPackLoader — loads and merges specialty packs into their base language pack.
 * Inputs: specialty pack code, base language memCache.
 * Outputs: merged memCache[baseLang] with specialty cards appended; loadedAddOns list.
 * Called by: lib/packLoader.ts (specialty branch of loadPack).
 * Pure functions only — no React, no Zustand.
 */

import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack, LoadPackResult, Manifest, PackMemCache } from "@/lib/packTypes";
import { SPECIALTY_PACKS } from "@/lib/langRegistry";
import { sha256Hex, packUrl } from "@/lib/utils";

// Track which specialty add-on pack codes have been merged into their base pack
// this session. Each entry is the specialty code (e.g. "it-medical"); the merged
// units live inside the base pack's entry in memCache under the baseLang key.
const loadedAddOns: string[] = [];

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

/**
 * Loads a specialty add-on pack and merges its units into the base pack in memCache.
 *
 * Precondition: `lang` must be a ready specialty pack code (SPECIALTY_PACKS entry with ready:true).
 * The base pack (spec.baseLang) must already be present in memCache; if not, returns
 * { ok: false, error: "base_pack_not_loaded" }.
 *
 * On success, the merged pack is written back to memCache[spec.baseLang] and the specialty
 * code is added to loadedAddOns. Subsequent calls for the same code return the already-merged
 * base pack immediately.
 */
export async function loadSpecialtyPack(
  lang: string,
  memCache: PackMemCache,
  manifest: Manifest | null,
): Promise<LoadPackResult> {
  const spec = SPECIALTY_PACKS.find(sp => sp.code === lang && sp.ready)!;

  if (!memCache.has(spec.baseLang)) {
    return { ok: false, error: "base_pack_not_loaded" };
  }

  // Already merged this session — return the base pack (which has merged units).
  if (loadedAddOns.includes(lang)) {
    return { ok: true, pack: memCache.get(spec.baseLang)! };
  }

  // Download the add-on pack JSON.
  let addOnJson: string;
  try {
    const res = await fetch(packUrl(lang), { cache: "no-store" });
    if (!res.ok) return { ok: false, error: "download_failed" };
    addOnJson = await res.text();
  } catch (err) {
    console.error(`[ADDON_DOWNLOAD_FAIL-${Date.now()}]`, err);
    return { ok: false, error: "download_failed" };
  }

  // SHA-256 verify if the manifest has an entry for this add-on.
  const addOnManifestEntry = manifest?.packs?.[lang];
  if (addOnManifestEntry) {
    const actual = await sha256Hex(addOnJson);
    if (actual !== addOnManifestEntry.sha256) {
      return { ok: false, error: "checksum_mismatch" };
    }
  }

  // Parse the add-on pack.
  let addOnPack: Pack;
  try {
    addOnPack = JSON.parse(addOnJson) as Pack;
  } catch (err) {
    console.error(`[ADDON_PARSE_FAIL-${Date.now()}]`, err);
    return { ok: false, error: "parse_error" };
  }
  if (!hasValidUnitsArray(addOnPack)) {
    // Same log-before-reject discipline as the download/parse failures just above — without
    // this, a wrong-shape add-on pack fails silently while every other failure mode here logs.
    console.error(`[SHAPE_INVALID_FAIL-${lang}-${Date.now()}] add-on pack failed hasValidUnitsArray`);
    return { ok: false, error: "parse_error" };
  }

  // Merge add-on units into the base pack — additive, never removes base units.
  const base = memCache.get(spec.baseLang)!;
  const merged: Pack = {
    ...base,
    units:     [...base.units, ...addOnPack.units],
    unitCount: base.unitCount + addOnPack.unitCount,
    cardCount: base.cardCount + addOnPack.cardCount,
  };
  // merge, not write: this is an additive update to an already-loaded base pack, not a fresh
  // replacement — it must NOT prune specialty tracking, since that would immediately undo the
  // loadedAddOns.push(lang) two lines below. See PackMemCache's doc comment in lib/packTypes.ts.
  memCache.merge(spec.baseLang, merged);
  loadedAddOns.push(lang);
  return { ok: true, pack: merged };
}
