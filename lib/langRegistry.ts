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
//          store/migrations.ts, app/settings/page.tsx, app/learn/page.tsx,
//          app/study/page.tsx, LANG_CONFIG_MAP → (any component rendering language UI)
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

// Derived constants — import these everywhere instead of maintaining parallel arrays.
// Object.freeze makes these immutable at runtime — ALL_PACK_CODES backs the security allowlist in
// evictPack; READY_PACK_CODES backs the loadPack guard (fail fast before CDN for unready packs).
// A mutable export could be .push()'d to bypass guards — hence freeze.
export const ALL_PACK_CODES: readonly PackCode[] = Object.freeze(LANGUAGE_REGISTRY.map(l => l.code));
export const READY_PACK_CODES: readonly PackCode[] = Object.freeze(LANGUAGE_REGISTRY.filter(l => l.ready).map(l => l.code));
export const FREE_PACK_CODES: readonly PackCode[] = Object.freeze(LANGUAGE_REGISTRY.filter(l => l.isFree).map(l => l.code));
export const LANG_CONFIG_MAP = Object.fromEntries(
  LANGUAGE_REGISTRY.map(l => [l.code, l.config])
) as Record<string, LanguageConfig>;

/** Type guard: returns true iff s is a registered PackCode (member of ALL_PACK_CODES). */
export function isValidPackCode(s: string): s is PackCode {
  return ALL_PACK_CODES.some(code => code === s);
}
