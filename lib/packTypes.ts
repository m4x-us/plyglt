/**
 * packTypes.ts — Shared type definitions for language pack data structures.
 * Single source of truth for: Pack, PackMeta, Manifest, LoadPackResult,
 * hasValidUnitsArray, and PackMemCache.
 * Imported by lib/packLoader.ts, lib/specialtyPackLoader.ts, and lib/packCache.ts
 * (imports hasValidUnitsArray, Pack, LoadPackResult, PackMemCache) — no React, no Zustand.
 */

import type { Unit } from "@/content/types";

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
// string id, string name, and a cards array; each card has string id, string type, string
// prompt, array accepted, array tags, and number tier.
// Does NOT validate: unitCount/cardCount cross-totals against actual units/cards lengths.
export function hasValidUnitsArray(pack: Pack): boolean {
  if (typeof pack.unitCount !== "number") return false;
  if (typeof pack.cardCount !== "number") return false;
  if (!Array.isArray(pack.units)) return false;
  // Cast through unknown[] — pack JSON is untrusted and elements may not match
  // the TypeScript type despite the outer cast, so we validate defensively.
  return (pack.units as unknown[]).every((u) => {
    if (u === null || typeof u !== "object") return false;
    const unit = u as Record<string, unknown>;
    if (typeof unit.id !== "string") return false;
    if (typeof unit.name !== "string") return false;
    if (!Array.isArray(unit.cards)) return false;
    return (unit.cards as unknown[]).every((c) => {
      if (c === null || typeof c !== "object") return false;
      const card = c as Record<string, unknown>;
      return (
        typeof card.id === "string" &&
        typeof card.type === "string" &&
        typeof card.prompt === "string" &&
        Array.isArray(card.accepted) &&
        Array.isArray(card.tags) &&
        typeof card.tier === "number"
      );
    });
  });
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
  write(lang: string, pack: Pack): void;
  merge(lang: string, mergedPack: Pack): void;
  delete(lang: string): void;
  clear(): void;
}
