// ===========================================
// STORE MIGRATIONS
// ===========================================
// Authoritative version history for all persisted Zustand stores.
// Zustand's persist middleware calls migrate(storedState, storedVersion) when
// the stored version < the config version. We chain the numbered migration fns
// to walk any stored data up to the current shape, one version at a time.
// Rules:
// - NEVER remove an entry from a migrations record — the chain must stay intact.
// - ONLY add new entries when bumping the corresponding *_VERSION constant.
// - Throw on a missing migration step — silent fallbacks corrupt user data.
// ===========================================
// DEPENDS ON: @/lib/langRegistry (FREE_PACK_CODES, SPECIALTY_PACKS),
//             @/lib/licenseTypes (LICENSE_TYPES, LicenseType),
//             @/lib/utils (localDateStr, isCalendarValidDate),
//             @/lib/introduction (MAX_PHASE_DAY), @/content/types (CardType)
// USED BY: store/srsStore.ts, store/entitlementStore.ts, store/settingsStore.ts
// EXPORTS: IDLE_THRESHOLD_DEFAULT_MINUTES — single source of truth for the idle default;
//          imported by store/settingsStore.ts and mirrored (as seconds) in interrupt.rs.
// ===========================================

import { FREE_PACK_CODES, isRegisteredSpecialtyCode, isValidPackCode } from "@/lib/langRegistry";
import { LICENSE_TYPES, type LicenseType } from "@/lib/licenseTypes";
import { localDateStr, isCalendarValidDate } from "@/lib/utils";
import { MAX_PHASE_DAY } from "@/lib/introduction";
import type { CardType } from "@/content/types";

// Shared by all three migrate*Store functions below (Task #494 fix — see debt.md's
// Task #494 entry and store/entitlementCrossTabSync.ts's corrected doc comment).
// Each function's `while (v < CURRENT_VERSION)` loop only walks storedVersion UP —
// when storedVersion is already >= CURRENT_VERSION the loop body never runs, so
// storedVersion > CURRENT_VERSION (data written by a build newer than this one, e.g.
// a stale/downgraded app instance, or a newer tab during a rollout) previously fell
// through and returned that data completely unmigrated and unvalidated, straight into
// the live store. This is exactly the "silent fallback corrupts user data" failure
// this file's own header rule already forbids for the missing-migration-step case
// (line 11) — it applies equally to a version that's too NEW, not just too old.
function assertNotFutureVersion(storeName: string, storedVersion: number, currentVersion: number): void {
  if (storedVersion > currentVersion) {
    throw new Error(
      `${storeName} store version ${storedVersion} is newer than this app build understands (current ${currentVersion}) — refusing to apply unmigrated data`
    );
  }
}

// ── SRS store ─────────────────────────────────────────────────────────────────

export const SRS_VERSION = 3;

// v2→v3 IntroductionRecord field validators (Task #433). Every field gets the same
// validate-log-fallback treatment as the pre-existing phaseStartDate check — an
// unvalidated field (e.g. consecutiveCorrect:"many") would otherwise survive migration
// untouched and reach production arithmetic (AGENTS.md: "any function that can silently
// corrupt persisted user data" is a stop-the-line violation).
const VALID_CARD_TYPES = new Set<CardType>(["recognize", "produce", "conjugate", "fill_blank", "passage_cloze"]);

function migrateDateField(record: Record<string, unknown>, field: string, cardId: string, fallback: string): string {
  const value = record[field];
  if (typeof value === "string" && isCalendarValidDate(value)) return value;
  console.error(`[plyglt] migration v3: corrupt record ${cardId} — invalid ${field} "${String(value)}", using fallback`);
  return fallback;
}

function migrateIntInRange(record: Record<string, unknown>, field: string, cardId: string, fallback: number, min: number, max: number): number {
  const value = record[field];
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) return value;
  console.error(`[plyglt] migration v3: corrupt record ${cardId} — invalid ${field} "${String(value)}", using ${fallback}`);
  return fallback;
}

function migrateBoolean(record: Record<string, unknown>, field: string, cardId: string, fallback: boolean): boolean {
  const value = record[field];
  if (typeof value === "boolean") return value;
  console.error(`[plyglt] migration v3: corrupt record ${cardId} — invalid ${field} "${String(value)}", using ${fallback}`);
  return fallback;
}

// strandedAcrossDays is optional (boolean | undefined) — unset is a valid, meaningful state
// (never stranded), so an absent field must stay absent rather than being forced to false.
// Returns a spreadable fragment: {strandedAcrossDays: bool} when a valid value is present,
// {} when absent or invalid (an invalid value is logged and dropped, same as "never set").
function migrateStrandedAcrossDays(record: Record<string, unknown>, cardId: string): { strandedAcrossDays?: boolean } {
  const value = record.strandedAcrossDays;
  if (value === undefined) return {};
  if (typeof value === "boolean") return { strandedAcrossDays: value };
  console.error(`[plyglt] migration v3: corrupt record ${cardId} — invalid strandedAcrossDays "${String(value)}", dropping`);
  return {};
}

const SRS_MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  // v0 → v1: initial shape. Fills missing fields for data written before versioning.
  1: (data: unknown) => {
    const d = data as Record<string, unknown>;
    return {
      cards:           typeof d.cards === "object" && d.cards !== null ? d.cards : {},
      streak:          typeof d.streak === "number" ? d.streak : 0,
      lastStudiedDate: typeof d.lastStudiedDate === "string" ? d.lastStudiedDate : null,
      activeSession:   d.activeSession ?? null,
    };
  },
  // v1 → v2: adds introductions map for the intensive introduction engine.
  // Uses ?? {} so any data already written by a pre-release build is preserved.
  2: (data: unknown) => {
    const d = data as Record<string, unknown>;
    return { ...d, introductions: d.introductions ?? {} };
  },
  // v2 → v3: adds phaseStartDate to every IntroductionRecord.
  // phaseStartDate defaults to introducedDate — safe because prior builds never
  // executed a triple-wrong reset (the dayOfPhase:1 write was a dead write discarded
  // by all callers). No user has ever had a functional triple-wrong reset.
  // Corrupt records missing both fields fall back to today's date and log an error.
  // The isCalendarValidDate check below is defense-in-depth at the persistence boundary:
  // getDayOfPhase now throws [ERR-INTRO-DATE] on invalid input rather than returning NaN;
  // this guard ensures corrupt persisted dates never reach it.
  3: (data: unknown) => {
    const d = data as Record<string, unknown>;
    // Typed as Record<string, unknown> (not Record<string, Record<string, unknown>>) so that
    // the null-record guard below can safely narrow at runtime without fighting the type system.
    const introductions = typeof d.introductions === "object" && d.introductions !== null
      ? d.introductions as Record<string, unknown>
      : {};
    // isCalendarValidDate imported from lib/utils — single source of truth for DATE_RE +
    // isNaN + round-trip calendar checks. See lib/utils.ts for full documentation.
    const todayFallback = localDateStr();
    const migratedIntroductions: Record<string, unknown> = {};
    for (const [cardId, rawRecord] of Object.entries(introductions)) {
      // Guard against null/non-object entries stored by a corrupt build.
      // A TypeError thrown on null access would be caught by Zustand's persist middleware
      // and resolved by resetting the entire store to defaults — silently wiping all history.
      // Build a complete default record (not just phaseStartDate) to prevent NaN corruption
      // on the first review call — undefined fields cause NaN propagation via undefined + 1.
      if (rawRecord === null || typeof rawRecord !== "object") {
        console.error(`[plyglt] migration v3: corrupt record ${cardId} — null or non-object entry, using today-based defaults`);
        migratedIntroductions[cardId] = {
          cardId,
          introducedDate: todayFallback,
          phaseStartDate: todayFallback,
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 0,
          lastSeenDate: todayFallback,
          appearancesToday: 0,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        };
        continue;
      }
      const record = rawRecord as Record<string, unknown>;
      const phaseStartDate = (() => {
        if (typeof record.phaseStartDate === "string" && isCalendarValidDate(record.phaseStartDate)) {
          return record.phaseStartDate;
        }
        if (typeof record.introducedDate === "string" && isCalendarValidDate(record.introducedDate)) {
          return record.introducedDate;
        }
        console.error(`[plyglt] migration v3: corrupt record ${cardId} — missing or calendar-invalid date fields, using today`);
        return todayFallback;
      })();

      // Task #433: validate every remaining field with the same pattern as phaseStartDate
      // above — invalid values are logged and replaced with a safe default rather than
      // passed through via {...record}.
      if (!(typeof record.cardId === "string" && record.cardId === cardId)) {
        console.error(`[plyglt] migration v3: record ${cardId} — cardId field "${String(record.cardId)}" did not match its map key, using map key`);
      }
      const introducedDate = migrateDateField(record, "introducedDate", cardId, phaseStartDate);
      const lastSeenDate = migrateDateField(record, "lastSeenDate", cardId, phaseStartDate);
      const dayOfPhase = migrateIntInRange(record, "dayOfPhase", cardId, 1, 1, MAX_PHASE_DAY);
      const consecutiveCorrect = migrateIntInRange(record, "consecutiveCorrect", cardId, 0, 0, Number.MAX_SAFE_INTEGER);
      const totalEncounters = migrateIntInRange(record, "totalEncounters", cardId, 0, 0, Number.MAX_SAFE_INTEGER);
      const appearancesToday = migrateIntInRange(record, "appearancesToday", cardId, 0, 0, Number.MAX_SAFE_INTEGER);
      const consecutiveWrongToday = migrateIntInRange(record, "consecutiveWrongToday", cardId, 0, 0, Number.MAX_SAFE_INTEGER);
      const graduated = migrateBoolean(record, "graduated", cardId, false);
      const lastSeenType: CardType | null = record.lastSeenType === null
        ? null
        : (typeof record.lastSeenType === "string" && VALID_CARD_TYPES.has(record.lastSeenType as CardType)
            ? (record.lastSeenType as CardType)
            : (() => {
                console.error(`[plyglt] migration v3: corrupt record ${cardId} — invalid lastSeenType "${String(record.lastSeenType)}", using null`);
                return null;
              })());

      migratedIntroductions[cardId] = {
        cardId,
        introducedDate,
        phaseStartDate,
        dayOfPhase,
        consecutiveCorrect,
        totalEncounters,
        lastSeenDate,
        appearancesToday,
        consecutiveWrongToday,
        lastSeenType,
        graduated,
        ...migrateStrandedAcrossDays(record, cardId),
      };
    }
    return { ...d, introductions: migratedIntroductions };
  },
};

export function migrateSrsStore(persisted: unknown, storedVersion: number): unknown {
  assertNotFutureVersion("SRS", storedVersion, SRS_VERSION);
  let v = storedVersion;
  let data = persisted;
  while (v < SRS_VERSION) {
    v++;
    const fn = SRS_MIGRATIONS[v];
    if (!fn) throw new Error(`Missing SRS store migration to version ${v}`);
    data = fn(data);
  }
  return data;
}

// ── Entitlement store ─────────────────────────────────────────────────────────

export const ENTITLEMENT_VERSION = 3;

// Derived from LICENSE_TYPES (the single source of truth in lib/licenseTypes.ts).
// Adding a new license type to lib/licenseTypes.ts automatically extends this Set.
// See also: lib/importBackup.ts VALID_LICENSE_TYPES — different fallback policy (see comment there).
const MIGRATION_VALID_LICENSE_TYPES = new Set<LicenseType>(LICENSE_TYPES);

const ENTITLEMENT_MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  1: (data: unknown) => {
    const d = data as Record<string, unknown>;
    // Element-shape + registration guard mirrors the v3 purchasedAddOns pattern (Task #384):
    // Array.isArray alone accepts arrays of non-strings, and typeof-only accepts unregistered
    // codes. Validate against REGISTRATION (isValidPackCode / ALL_PACK_CODES — structural),
    // never READINESS — same policy as lib/importBackup.ts's unlockedPacks filter. Dropped
    // entries are logged — silently discarding persisted user data is a stop-the-line violation.
    const rawPacks = Array.isArray(d.unlockedPacks) ? d.unlockedPacks : [...FREE_PACK_CODES];
    const validPacks = rawPacks.filter((item): item is string => typeof item === "string" && isValidPackCode(item));
    if (validPacks.length < rawPacks.length) {
      console.warn(
        `[plyglt] migration v1: dropped ${rawPacks.length - validPacks.length} unregistered unlockedPacks entries: ${JSON.stringify(
          rawPacks.filter(item => !(typeof item === "string" && isValidPackCode(item)))
        )}`
      );
    }
    return {
      licenseKey:    typeof d.licenseKey === "string" ? d.licenseKey : null,
      instanceId:    typeof d.instanceId === "string" ? d.instanceId : null,
      licenseType:   typeof d.licenseType === "string" ? d.licenseType : "free",
      unlockedPacks: validPacks,
      lastValidated: typeof d.lastValidated === "number" ? d.lastValidated : 0,
      validUntil:    typeof d.validUntil === "number" ? d.validUntil : null,
    };
  },
  // v1 → v2: coerce any unrecognised licenseType value from a prior app version to "subscription"
  // to preserve paid access for legacy users. Only "free" stays "free"; everything else maps
  // to "subscription". lib/importBackup.ts uses "free" as fallback because backup data is
  // untrusted external input (different policy — see cross-reference comment in importBackup.ts).
  2: (data: unknown) => {
    const d = data as Record<string, unknown>;
    const raw = typeof d.licenseType === "string" ? d.licenseType : "free";
    return {
      ...d,
      licenseType: MIGRATION_VALID_LICENSE_TYPES.has(raw as LicenseType) ? raw : "subscription",
    };
  },
  // v2 → v3: adds purchasedAddOns for specialty pack add-on tracking.
  // Default [] — no existing user has purchased any add-ons.
  // Preserves any data already written by a pre-release build (unlikely but safe).
  // Element-shape guard: filter to string AND registration (Task #384). Validation of
  // persisted PAID purchase records must check REGISTRATION (the code exists in
  // SPECIALTY_PACKS — structural), never READINESS (isSpecialtyPackCode requires
  // ready:true, a mutable business flag). A pack purchased while ready:true that later
  // reverts to ready:false (deprecation, rollback) must keep its purchase record —
  // readiness gates purchasing (purchaseAddOn) and loading (loadSpecialtyPack), not
  // retention. Same policy as lib/importBackup.ts's purchasedAddOns filter — both now
  // share lib/langRegistry.ts's isRegisteredSpecialtyCode (Task #407), so they cannot drift.
  // Dropped entries (unregistered codes from corrupt/pre-release blobs) are logged —
  // silently discarding persisted user data is a stop-the-line violation.
  3: (data: unknown) => {
    const d = data as Record<string, unknown>;
    const raw = Array.isArray(d.purchasedAddOns) ? d.purchasedAddOns : [];
    const valid = raw.filter(
      (item): item is string => typeof item === "string" && isRegisteredSpecialtyCode(item)
    );
    if (valid.length < raw.length) {
      console.warn(
        `[plyglt] migration v3: dropped ${raw.length - valid.length} unregistered purchasedAddOns entries: ${JSON.stringify(
          raw.filter(item => !(typeof item === "string" && isRegisteredSpecialtyCode(item)))
        )}`
      );
    }
    return { ...d, purchasedAddOns: valid };
  },
};

export function migrateEntitlementStore(persisted: unknown, storedVersion: number): unknown {
  assertNotFutureVersion("Entitlement", storedVersion, ENTITLEMENT_VERSION);
  let v = storedVersion;
  let data = persisted;
  while (v < ENTITLEMENT_VERSION) {
    v++;
    const fn = ENTITLEMENT_MIGRATIONS[v];
    if (!fn) throw new Error(`Missing entitlement store migration to version ${v}`);
    data = fn(data);
  }
  return data;
}

// ── Settings store ────────────────────────────────────────────────────────────

export const SETTINGS_VERSION = 2;
/** Single source of truth for the idle-threshold default (minutes).
 *  Mirrored as IDLE_THRESHOLD_DEFAULT_SECS = 900 in src-tauri/src/interrupt.rs. */
export const IDLE_THRESHOLD_DEFAULT_MINUTES = 15;

const SETTINGS_MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  1: (data: unknown) => {
    const d = data as Record<string, unknown>;
    return {
      launchAtLogin:    typeof d.launchAtLogin === "boolean" ? d.launchAtLogin : false,
      interruptEnabled: typeof d.interruptEnabled === "boolean" ? d.interruptEnabled : false,
      intervalHours:    typeof d.intervalHours === "number" ? d.intervalHours : 3,
      mandatory:        typeof d.mandatory === "boolean" ? d.mandatory : false,
      dndStart:         typeof d.dndStart === "string" ? d.dndStart : "22:00",
      dndEnd:           typeof d.dndEnd === "string" ? d.dndEnd : "08:00",
      snoozeMinutes:    typeof d.snoozeMinutes === "number" ? d.snoozeMinutes : 30,
    };
  },
  // v1 → v2: adds OS trigger controls. Defaults to true/true/true/15 — opt-out model
  // so existing users keep all triggers active until they explicitly disable them.
  // idleThresholdMinutes is clamped to [5, 120] to reject corrupt persisted values
  // (e.g. -50 or 99999) that would produce nonsensical OS idle detection thresholds.
  2: (data: unknown) => {
    const d = data as Record<string, unknown>;
    const rawThreshold = typeof d.idleThresholdMinutes === "number" ? d.idleThresholdMinutes : IDLE_THRESHOLD_DEFAULT_MINUTES;
    return {
      ...d,
      wakeEnabled:          typeof d.wakeEnabled === "boolean" ? d.wakeEnabled : true,
      unlockEnabled:        typeof d.unlockEnabled === "boolean" ? d.unlockEnabled : true,
      idleEnabled:          typeof d.idleEnabled === "boolean" ? d.idleEnabled : true,
      idleThresholdMinutes: Math.min(120, Math.max(5, rawThreshold)),
    };
  },
};

export function migrateSettingsStore(persisted: unknown, storedVersion: number): unknown {
  assertNotFutureVersion("Settings", storedVersion, SETTINGS_VERSION);
  let v = storedVersion;
  let data = persisted;
  while (v < SETTINGS_VERSION) {
    v++;
    const fn = SETTINGS_MIGRATIONS[v];
    if (!fn) throw new Error(`Missing settings store migration to version ${v}`);
    data = fn(data);
  }
  return data;
}
