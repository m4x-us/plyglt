/**
 * packTypes.ts — Shared type definitions for language pack data structures.
 * Single source of truth for: Pack, PackMeta, Manifest, LoadPackResult,
 * hasValidUnitsArray, and PackMemCache.
 * Imported by lib/packLoader.ts, lib/specialtyPackLoader.ts, and lib/packCache.ts
 * (imports hasValidUnitsArray, Pack, LoadPackResult, PackMemCache) — no React, no Zustand.
 */

import type { Unit } from "@/content/types";
import type { Level } from "@/content/types";

// Runtime mirror of the Level union — `satisfies` rejects any entry that is not a valid
// Level, so this set cannot drift into typos. It cannot detect a MISSING entry (TypeScript
// has no exhaustiveness check for arrays), so when a new level is added to content/types.ts
// it must be added here and in scripts/validatePack.ts's VALID_LEVELS. (#392)
const VALID_LEVELS: ReadonlySet<string> = new Set(
  ["A1", "A2", "B1", "B2"] satisfies readonly Level[],
);

export interface PackMeta {
  version: string;
  size: number;
  sha256: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface Manifest {
  _version: 1;
  generatedAt: string;
  packs: Record<string, PackMeta>;
}

export interface Pack {
  _version: 1;
  lang: string;
  packVersion: string;
  canonicalSource: string;
  name: string;
  nativeName: string;
  flag: string;
  unitCount: number;
  cardCount: number;
  units: Unit[];
}

export type LoadPackResult =
  | { ok: true; pack: Pack }
  | {
      ok: false;
      error:
        | "invalid_lang"          // lang code not in the allowlist — do NOT retry
        | "base_pack_not_loaded"  // specialty pack requested before its base lang is loaded
        | "download_failed"       // network error or non-200 response
        | "checksum_mismatch"
        | "parse_error";
    };

// Shared guard for every JSON.parse(...) as Pack site in lib/packLoader.ts and
// lib/specialtyPackLoader.ts. sha256 integrity (bytes haven't changed) and this
// shape check (bytes are at least a valid Pack skeleton) are orthogonal — a pack
// can pass sha256 yet have non-array units or malformed elements if the
// content-authoring pipeline produced malformed JSON. Apply both checks at every parse site.
// Validates: unitCount/cardCount are numbers (non-numeric values would silently
// string-concatenate when _mergeFromJson sums them); units is an array; each unit has a
// string id, string name, a registered level, string theme, string emoji, and a
// prerequisiteUnits array (all non-optional on Unit — components/LevelSection.tsx and
// app/study/page.tsx dereference unit.prerequisiteUnits.every(...) with no guard, so a
// pack missing it would pass sha256 yet crash the UI on first render instead of failing
// at load; #392); each unit has a cards array; each card has string id, string type,
// string prompt, array accepted, array tags, number tier, and (Task #443) — when present —
// a prerequisites array of strings. card.prerequisites is OPTIONAL on Card (unlike
// unit.prerequisiteUnits), so its absence is valid; but lib/srs.ts:207's
// `card.prerequisites.every(...)` has no Array.isArray guard of its own — a pack with a
// non-array-but-truthy prerequisites value (e.g. a non-empty string, which also has a
// truthy .length and so passes lib/srs.ts:206's `?.length` check) would pass sha256 yet
// throw a TypeError in the live FSRS new-card queue (store/srsStore.ts's getNewCards) and
// the introduction engine — reachable via the shipped Italian base pack, not gated behind
// specialty packs being unready. unitCount equals the actual units.length and cardCount
// equals the actual total cards across all units (Task #418 —
// lib/specialtyPackLoader.ts's _mergeFromJson arithmetically sums exactly these two
// declared fields, so a declared count that doesn't match the real array lengths produces
// an arithmetically wrong but type-safe merged total with no caller ever catching it).
// This is the runtime mirror of scripts/validatePack.ts's validateUnit — keep the two in
// sync: any field the UI dereferences unconditionally must be checked in BOTH places.
export function hasValidUnitsArray(pack: Pack): boolean {
  if (typeof pack.unitCount !== "number") return false;
  if (typeof pack.cardCount !== "number") return false;
  if (!Array.isArray(pack.units)) return false;
  if (pack.units.length !== pack.unitCount) return false;
  let totalCards = 0;
  // Cast through unknown[] — pack JSON is untrusted and elements may not match
  // the TypeScript type despite the outer cast, so we validate defensively.
  const unitsValid = (pack.units as unknown[]).every((u) => {
    if (u === null || typeof u !== "object") return false;
    const unit = u as Record<string, unknown>;
    if (typeof unit.id !== "string") return false;
    if (typeof unit.name !== "string") return false;
    if (typeof unit.level !== "string" || !VALID_LEVELS.has(unit.level)) return false;
    if (typeof unit.theme !== "string") return false;
    if (typeof unit.emoji !== "string") return false;
    if (!Array.isArray(unit.prerequisiteUnits)) return false;
    if (!Array.isArray(unit.cards)) return false;
    totalCards += unit.cards.length;
    return (unit.cards as unknown[]).every((c) => {
      if (c === null || typeof c !== "object") return false;
      const card = c as Record<string, unknown>;
      return (
        typeof card.id === "string" &&
        typeof card.type === "string" &&
        typeof card.prompt === "string" &&
        Array.isArray(card.accepted) &&
        Array.isArray(card.tags) &&
        typeof card.tier === "number" &&
        // Task #443: prerequisites is OPTIONAL (undefined is valid) but, when present,
        // must be an array of strings — lib/srs.ts's prerequisitesMet has no guard of its
        // own against a non-array-but-truthy value.
        (card.prerequisites === undefined ||
          (Array.isArray(card.prerequisites) &&
            (card.prerequisites as unknown[]).every((p) => typeof p === "string")))
      );
    });
  });
  if (!unitsValid) return false;
  return totalCards === pack.cardCount;
}

/**
 * Contract for the in-memory pack cache, shared by lib/packLoader.ts (which owns the concrete
 * implementation) and lib/specialtyPackLoader.ts (which reads/writes it only through this
 * interface). Deliberately has no generic `set` method — only `write` (replace an entry outright;
 * always prunes any specialty-pack tracking for `lang` first, since the incoming pack was not
 * built by merging in an existing add-on) and `merge` (additive update used only when folding a
 * specialty add-on's units into its base pack; must NOT prune, since pruning would immediately
 * undo the merge this call itself just performed). A caller cannot silently bypass the
 * specialty-tracking pairing a raw `Map.set` would allow, because there is no raw `set` exposed.
 */
export interface PackMemCache {
  has(lang: string): boolean;
  get(lang: string): Pack | undefined;
  keys(): IterableIterator<string>;
  /**
   * Replaces `lang`'s entry outright. The in-memory write itself is synchronous — this
   * method returns only after `this.get(lang)` already reflects `pack` — but it ALSO
   * triggers un-awaited, fire-and-forget async platform-storage I/O as a side effect
   * (pruning any specialty pack storage keys tied to the replaced base pack; see
   * lib/packCache.ts's PackMemCacheImpl.write() and Task #439/F068). A caller does not need
   * to await anything for the in-memory contract to hold, but should not assume `write()`
   * returning means all disk/Tauri-store mutations it initiated have completed.
   */
  write(lang: string, pack: Pack): void;
  merge(lang: string, mergedPack: Pack): void;
  delete(lang: string): void;
  clear(): void;
}
