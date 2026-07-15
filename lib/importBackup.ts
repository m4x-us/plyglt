// ===========================================
// BACKUP IMPORT PARSER
// ===========================================
// Parses and validates plyglt progress backup files (JSON).
// Normalizes card data and coerces license types.
// Used when a user restores progress from a file.
// ===========================================
// DEPENDS ON: @/lib/srs, @/lib/langRegistry, @/lib/licenseTypes
// USED BY: hooks/useExportImport.ts
// ===========================================

import { type CardProgress, type CardState } from "@/lib/srs";
import { isValidPackCode, FREE_PACK_CODES, isSpecialtyPackCode, type PackCode } from "@/lib/langRegistry";
import { LICENSE_TYPES, type LicenseType } from "@/lib/licenseTypes";

/** Highest backup _version this app can parse. Backups above this were written by a newer app. */
export const CURRENT_BACKUP_VERSION = 2;

export interface BackupSrs {
  cards: Record<string, CardProgress>;
  streak: number;
  lastStudiedDate: string | null;
}

export interface BackupEntitlement {
  licenseKey: string | null;
  instanceId: string | null;
  licenseType: LicenseType;
  unlockedPacks: PackCode[];
  validUntil: number | null;
  purchasedAddOns: string[];
}

export type ParseBackupResult =
  | { ok: true; srs: BackupSrs; entitlement: BackupEntitlement; langPair: string; validCardCount: number; skippedCardCount: number }
  | { ok: false; error: string };

const VALID_STATES: Set<string> = new Set(["new", "learning", "review", "relearning"]);
// Derived from LICENSE_TYPES (single source of truth in lib/licenseTypes.ts) so adding
// a new license type here automatically — no parallel definition.
// Unknown licenseType coerces to "free" (never escalates access from untrusted input).
// store/migrations.ts uses "subscription" as fallback instead — different policy for
// existing installed users vs imported backup data. See migrations.ts MIGRATION_VALID_LICENSE_TYPES.
const VALID_LICENSE_TYPES = new Set<LicenseType>(LICENSE_TYPES);

function normalizeCardProgress(raw: unknown): CardProgress | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.cardId !== "string" || !c.cardId) return null;
  if (!VALID_STATES.has(c.state as string)) return null;
  // typeof NaN === "number" is true — isFinite() is required to reject NaN and Infinity
  const stability      = typeof c.stability      === "number" && isFinite(c.stability)      ? Math.max(0, c.stability)    : 0;
  const difficulty     = typeof c.difficulty     === "number" && isFinite(c.difficulty)     ? c.difficulty                : 5;
  const retrievability = typeof c.retrievability === "number" && isFinite(c.retrievability) ? c.retrievability            : 1;
  const dueDate        = typeof c.dueDate        === "number" && isFinite(c.dueDate)        ? c.dueDate                   : Date.now();
  const lapses         = typeof c.lapses         === "number" && Number.isInteger(c.lapses) ? Math.max(0, c.lapses)       : 0;
  const reps           = typeof c.reps           === "number" && Number.isInteger(c.reps)   ? Math.max(0, c.reps)         : 0;
  return { cardId: c.cardId as string, state: c.state as CardState, stability, difficulty, retrievability, dueDate, lapses, reps };
}

export function parseBackup(raw: unknown): ParseBackupResult {
  if (typeof raw !== "object" || raw === null)
    return { ok: false, error: "Invalid backup — not a JSON object." };

  const data = raw as Record<string, unknown>;
  if (!data._version || typeof data.srs !== "object" || data.srs === null || Array.isArray(data.srs) || !data.entitlement)
    return { ok: false, error: "Invalid backup file — missing required fields." };

  if (typeof data._version === "number" && data._version > CURRENT_BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup was created by a newer version of the app (backup v${data._version}, app supports v${CURRENT_BACKUP_VERSION}). Please update plyglt.`,
    };
  }

  const srsData = data.srs as Record<string, unknown>;

  const rawCards = typeof srsData.cards === "object" && srsData.cards !== null
    ? srsData.cards as Record<string, unknown>
    : {};

  let validCardCount = 0;
  let skippedCardCount = 0;
  const validCards: Record<string, CardProgress> = {};

  for (const [id, card] of Object.entries(rawCards)) {
    const normalized = normalizeCardProgress(card);
    if (normalized) {
      validCards[id] = normalized;
      validCardCount++;
    } else {
      skippedCardCount++;
    }
  }

  const srs: BackupSrs = {
    cards: validCards,
    // isFinite() required — typeof NaN === "number" is true (see card field pattern at line 51)
    streak: typeof srsData.streak === "number" && isFinite(srsData.streak) ? Math.max(0, srsData.streak) : 0,
    lastStudiedDate: typeof srsData.lastStudiedDate === "string" ? srsData.lastStudiedDate : null,
  };

  const e = data.entitlement as Record<string, unknown>;
  const rawLicenseType = e.licenseType as string;
  const licenseType: LicenseType = VALID_LICENSE_TYPES.has(rawLicenseType as LicenseType)
    ? (rawLicenseType as LicenseType)
    : "free";

  // unlockedPacks: validate type AND registration. Log dropped entries so silent data-loss
  // is observable — mirrors the card skippedCardCount pattern above. (#354)
  const rawUnlockedPacks = Array.isArray(e.unlockedPacks) ? (e.unlockedPacks as unknown[]) : null;
  const validUnlockedPacks: PackCode[] = rawUnlockedPacks
    ? rawUnlockedPacks.filter((c): c is PackCode => typeof c === "string" && isValidPackCode(c))
    : [...FREE_PACK_CODES];
  if (rawUnlockedPacks !== null && validUnlockedPacks.length < rawUnlockedPacks.length) {
    console.warn(
      `[IMPORT-SKIP-PACKS] ${rawUnlockedPacks.length - validUnlockedPacks.length} unlockedPacks entries dropped — unregistered or invalid codes: ${JSON.stringify(rawUnlockedPacks.filter(c => !(typeof c === "string" && isValidPackCode(c))))}`
    );
  }

  // purchasedAddOns: validate type AND specialty-pack registration. Log dropped entries. (#354)
  // Old backups (pre-purchasedAddOns) arrive with e.purchasedAddOns undefined → rawAddOns=[] → [].
  const rawAddOns = Array.isArray(e.purchasedAddOns) ? e.purchasedAddOns : [];
  const validAddOns: string[] = rawAddOns.filter((item): item is string => typeof item === "string" && isSpecialtyPackCode(item));
  if (validAddOns.length < rawAddOns.length) {
    console.warn(
      `[IMPORT-SKIP-ADDONS] ${rawAddOns.length - validAddOns.length} purchasedAddOns entries dropped — unregistered or invalid codes: ${JSON.stringify(rawAddOns.filter(item => !(typeof item === "string" && isSpecialtyPackCode(item))))}`
    );
  }

  const entitlement: BackupEntitlement = {
    licenseKey:    typeof e.licenseKey   === "string" ? e.licenseKey   : null,
    instanceId:    typeof e.instanceId   === "string" ? e.instanceId   : null,
    licenseType,
    unlockedPacks: validUnlockedPacks,
    validUntil:    typeof e.validUntil === "number" && isFinite(e.validUntil) ? e.validUntil : null,
    // Validates both type (string) and registration (isSpecialtyPackCode) so a hand-edited
    // backup JSON cannot inject arbitrary add-on codes without a real receipt check.
    // Mirrors the unlockedPacks → isValidPackCode gate above.
    purchasedAddOns: validAddOns,
  };

  // v1 backups pre-date the langPair field — default to Italian (the only language at v1).
  // Validate format: base pair (en-it) or hyphenated specialty code (en-it-medical).
  const rawLangPair = typeof data.langPair === "string" ? data.langPair : "en-it";
  const LANG_PAIR_RE = /^[a-z]{2}-[a-z]{2,}(-[a-z]{2,})*$/;
  if (!LANG_PAIR_RE.test(rawLangPair)) {
    console.error(`[ERR-IMPORT-LANG-PAIR] Backup langPair "${rawLangPair}" did not match expected format — falling back to "en-it".`);
  }
  const langPair = LANG_PAIR_RE.test(rawLangPair) ? rawLangPair : "en-it";

  return { ok: true, srs, entitlement, langPair, validCardCount, skippedCardCount };
}
