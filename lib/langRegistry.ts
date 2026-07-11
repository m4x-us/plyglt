// ===========================================
// LANGUAGE REGISTRY
// ===========================================
// Single source of truth for all language packs: codes, configs, and
// free/paid status. Derived constants (ALL_PACK_CODES, FREE_PACK_CODES,
// LANG_CONFIG_MAP) are imported everywhere instead of maintaining parallel arrays.
// PackCode is the canonical type for a valid language pack code.
// ===========================================
// DEPENDS ON: @/lib/language (LanguageConfig, ITALIAN, SPANISH)
// USED BY: store/entitlementStore.ts, lib/entitlement.ts, lib/importBackup.ts,
//          store/migrations.ts, lib/packLoader.ts, lib/specialtyPackLoader.ts,
//          components/LanguageGrid.tsx,
//          LANG_CONFIG_MAP → (any component rendering language UI)
// ===========================================

import { ITALIAN, SPANISH, type LanguageConfig } from "@/lib/language";

export interface LanguageEntry {
  readonly code: PackCode;
  readonly config: LanguageConfig;
  readonly isFree: boolean;
  readonly ready: boolean;    // true = pack is available; false = in development
}

// Single source of truth for all language metadata.
// To add a new language: add one entry here with ready: false and a real LanguageConfig,
// then set ready: true once the content and pack are complete (see CONTRIBUTING_LANGUAGE.md).
// fr/de/pt were removed here (2026-06-27) — they had placeholder SPANISH configs and no
// real packs. Re-add them with real LanguageConfig objects when their packs are ready.
export const LANGUAGE_REGISTRY: readonly LanguageEntry[] = [
  { code: "it", config: ITALIAN, isFree: true,  ready: true  },
  { code: "es", config: SPANISH, isFree: false, ready: false },
] as const;

// Canonical type for a valid language pack code. Defined here (not in store/) so lib/ files can
// import it without an upward layer violation.
// Explicit union — keep in sync when adding entries to LANGUAGE_REGISTRY.
// LanguageEntry.code is typed as PackCode so TypeScript enforces valid codes at registry definition time.
export type PackCode = "it" | "es";

// Deep-freeze a LanguageConfig and its nested objects. Object.freeze is shallow — the two-level
// nested structure (config → uiStrings → cardLabels) requires explicit per-level freezing so
// that runtime mutations like `LANG_CONFIG_MAP.it.uiStrings.appTitle = "x"` throw TypeError.
function deepFreezeConfig(config: LanguageConfig): Readonly<LanguageConfig> {
  Object.freeze(config.uiStrings.cardLabels);
  Object.freeze(config.uiStrings);
  return Object.freeze(config);
}

// Derived constants — import these everywhere instead of maintaining parallel arrays.
// Object.freeze makes these immutable at runtime — ALL_PACK_CODES backs the security allowlist in
// evictPack; READY_PACK_CODES backs the loadPack guard (fail fast before CDN for unready packs).
// A mutable export could be .push()'d to bypass guards — hence freeze.
export const ALL_PACK_CODES: readonly PackCode[] = Object.freeze(LANGUAGE_REGISTRY.map(l => l.code));
export const READY_PACK_CODES: readonly PackCode[] = Object.freeze(LANGUAGE_REGISTRY.filter(l => l.ready).map(l => l.code));
export const FREE_PACK_CODES: readonly PackCode[] = Object.freeze(LANGUAGE_REGISTRY.filter(l => l.isFree).map(l => l.code));
export const LANG_CONFIG_MAP: Readonly<Record<string, LanguageConfig>> = Object.freeze(
  Object.fromEntries(LANGUAGE_REGISTRY.map(l => [l.code, deepFreezeConfig(l.config)]))
);

/** Type guard: returns true iff s is a registered PackCode (member of ALL_PACK_CODES). */
export function isValidPackCode(s: string): s is PackCode {
  return ALL_PACK_CODES.some(code => code === s);
}

// ── Specialty pack registry ───────────────────────────────────────────────────
// Specialty packs are paid add-ons within a base language (e.g. "it-medical").
// They extend the base pack — loaded alongside it, not instead of it.
// All current entries have ready:false. Set to true when a real pack file ships.

export interface SpecialtyPack {
  readonly code: string;       // e.g. "it-medical" — unique across all registries
  readonly baseLang: PackCode; // base language this add-on extends
  readonly name: string;       // e.g. "Medical Italian"
  readonly ready: boolean;     // false until the pack file ships
}

// Empty until real specialty content exists. To register a future pack: append here
// with ready:false, then set ready:true once the pack file and pricing are live.
export const SPECIALTY_PACKS: readonly SpecialtyPack[] = Object.freeze([]);

/**
 * Returns true iff s is a registered AND ready specialty pack code.
 * Used by purchaseAddOn as the sole code-validity gate before persisting into
 * purchasedAddOns (which has no removal path). Requiring .ready prevents a
 * registered-but-not-yet-shipped pack from being purchased and permanently stored.
 */
export function isSpecialtyPackCode(s: string): boolean {
  return SPECIALTY_PACKS.some(sp => sp.code === s && sp.ready);
}

/**
 * Returns true iff s is a registered AND ready specialty pack code.
 * Use for security-sensitive loadability checks (mirrors READY_PACK_CODES for base packs).
 * packLoader delegates to this function for its specialty-pack loadability gate,
 * replacing its former inline SPECIALTY_PACKS.some(...) check (Task #266).
 */
export function isReadySpecialtyPackCode(s: string): boolean {
  return SPECIALTY_PACKS.some(sp => sp.code === s && sp.ready);
}
