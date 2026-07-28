// ===========================================
// BACKUP IMPORT PARSER
// ===========================================
// Parses and validates plyglt progress backup files (JSON).
// Normalizes card data and coerces license types.
// Used when a user restores progress from a file.
// ===========================================
// DEPENDS ON: @/lib/srs, @/lib/langRegistry, @/lib/licenseTypes
// USED BY: hooks/useExportImport.ts,
//          lib/exportBackup.ts (imports CURRENT_BACKUP_VERSION, BackupSrs, BackupEntitlement)
// ===========================================

import { type CardProgress, type CardState } from "@/lib/srs";
import { isValidPackCode, FREE_PACK_CODES, isRegisteredSpecialtyCode, type PackCode } from "@/lib/langRegistry";
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
// Task #424: mirrors hooks/useLicenseActivation.ts:25's manual-entry format guard. Task #423
// (a shared named constant so the two sites cannot drift) is deferred to a later wave —
// duplicated here deliberately rather than blocking on it; keep in sync until #423 lands.
// A restored backup is untrusted input exactly like a manually-typed key — validating type
// alone (the pre-#424 check) let an oversized or non-charset-conforming licenseKey/instanceId
// bypass the manual-entry guard entirely via the restore path.
const LICENSE_FIELD_MAX_LENGTH = 200;
const LICENSE_FIELD_PATTERN = /^[A-Za-z0-9-]+$/;
function isValidLicenseField(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= LICENSE_FIELD_MAX_LENGTH && LICENSE_FIELD_PATTERN.test(v);
}
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
  // Task #390: entitlement gets the same strict shape check as srs (object, non-null,
  // non-array). A truthiness-only check accepted entitlement:"corrupted" or entitlement:5
  // and silently defaulted every entitlement field instead of rejecting the backup the
  // way equally-malformed srs input is rejected.
  if (
    !data._version ||
    typeof data.srs !== "object" || data.srs === null || Array.isArray(data.srs) ||
    typeof data.entitlement !== "object" || data.entitlement === null || Array.isArray(data.entitlement)
  )
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

  // purchasedAddOns: validate type AND specialty-pack REGISTRATION (membership in
  // SPECIALTY_PACKS), never READINESS. Log dropped entries. (#354, #384)
  // Task #384: isSpecialtyPackCode requires ready:true — a mutable business flag. A backup
  // written while a pack was ready:true must not lose the paid purchase record on restore
  // after the pack reverts to ready:false. Registration-only still blocks arbitrary
  // hand-edited codes, and a not-ready code cannot be loaded anyway (loadSpecialtyPack
  // gates on ready). Same policy as store/migrations.ts's v2→v3 filter — both now share
  // lib/langRegistry.ts's isRegisteredSpecialtyCode (Task #407), so they cannot drift.
  // Old backups (pre-purchasedAddOns) arrive with e.purchasedAddOns undefined → rawAddOns=[] → [].
  //
  // Task #422 (F023): this validated value is currently NEVER consumed by any production
  // caller — hooks/useExportImport.ts:readFile deliberately strips purchasedAddOns from
  // result.entitlement before it ever reaches setEntitlement (see excludePurchasedAddOns /
  // RestorableEntitlement there, Task #440): add-on purchases require a server-verified
  // receipt via purchaseAddOn() and can never be restored from an unsigned backup file.
  // The validation here is kept anyway — deliberately, not dead code left by oversight —
  // so BackupEntitlement stays a fully-validated, self-consistent shape for exportBackup's
  // round trip and any future caller, rather than an unvalidated field silently smuggled
  // through parseBackup's otherwise-strict output.
  const rawAddOns = Array.isArray(e.purchasedAddOns) ? e.purchasedAddOns : [];
  const validAddOns: string[] = rawAddOns.filter((item): item is string => typeof item === "string" && isRegisteredSpecialtyCode(item));
  if (validAddOns.length < rawAddOns.length) {
    console.warn(
      `[IMPORT-SKIP-ADDONS] ${rawAddOns.length - validAddOns.length} purchasedAddOns entries dropped — unregistered or invalid codes: ${JSON.stringify(rawAddOns.filter(item => !(typeof item === "string" && isRegisteredSpecialtyCode(item))))}`
    );
  }

  // Task #424: format/length-validate, not just type-check — a crafted backup JSON with an
  // oversized or non-charset-conforming licenseKey/instanceId must be rejected here, the same
  // as hooks/useLicenseActivation.ts's manual-entry guard rejects it at the input box. An
  // invalid field is treated as absent (null) and logged — mirrors this function's other
  // drop-and-log patterns (unlockedPacks, purchasedAddOns above) rather than failing the
  // whole restore over one bad field.
  // Only warn when a STRING was actually supplied but failed validation — null/undefined
  // is the normal, unremarkable shape for a free-user backup with no license and must not
  // spuriously log (mirrors the pre-#424 silent-coercion behavior for that common case).
  if (typeof e.licenseKey === "string" && !isValidLicenseField(e.licenseKey)) {
    console.warn(`[IMPORT-SKIP-LICENSE-KEY] licenseKey failed format/length validation — dropped`);
  }
  if (typeof e.instanceId === "string" && !isValidLicenseField(e.instanceId)) {
    console.warn(`[IMPORT-SKIP-INSTANCE-ID] instanceId failed format/length validation — dropped`);
  }
  const entitlement: BackupEntitlement = {
    licenseKey:    isValidLicenseField(e.licenseKey) ? e.licenseKey : null,
    instanceId:    isValidLicenseField(e.instanceId) ? e.instanceId : null,
    licenseType,
    unlockedPacks: validUnlockedPacks,
    validUntil:    typeof e.validUntil === "number" && isFinite(e.validUntil) ? e.validUntil : null,
    // Validates both type (string) and registration (SPECIALTY_PACKS membership) so a
    // hand-edited backup JSON cannot inject arbitrary add-on codes without a real receipt
    // check. Mirrors the unlockedPacks → isValidPackCode gate above.
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
