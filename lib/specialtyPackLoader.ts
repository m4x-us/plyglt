/**
 * specialtyPackLoader — loads and merges specialty packs into their base language pack.
 * Inputs: specialty pack code, base language memCache.
 * Outputs: merged memCache[baseLang] with specialty cards appended; loadedAddOns list.
 * Called by: lib/packLoader.ts (specialty branch of loadPack).
 * Pure functions only — no React, no Zustand.
 */

import type { Pack, LoadPackResult, Manifest } from "@/lib/packLoader";
import { SPECIALTY_PACKS } from "@/lib/langRegistry";

// Track which specialty add-on pack codes have been merged into their base pack
// this session. Each entry is the specialty code (e.g. "it-medical"); the merged
// units live inside the base pack's entry in memCache under the baseLang key.
const loadedAddOns: string[] = [];

function packUrl(lang: string): string {
  return `/packs/${lang}.json`;
}

async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
  memCache: Map<string, Pack>,
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
  if (!Array.isArray(addOnPack.units)) {
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
  memCache.set(spec.baseLang, merged);
  loadedAddOns.push(lang);
  return { ok: true, pack: merged };
}
