/**
 * packTypes.ts — Shared type definitions for language pack data structures.
 * Single source of truth for Pack, PackMeta, Manifest, and LoadPackResult.
 * Imported by lib/packLoader.ts and lib/specialtyPackLoader.ts — no React, no Zustand.
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
// can pass sha256 yet have non-array units if the content-authoring pipeline
// produced malformed JSON. Apply both checks at every parse site.
// NOTE: this checks only that `units` is an array — it does NOT validate the
// other required Pack fields above or individual Unit/Card element shapes.
// Name and scope kept deliberately narrow to avoid promising validation this
// function doesn't perform.
export function hasValidUnitsArray(pack: Pack): boolean {
  return Array.isArray(pack.units);
}
