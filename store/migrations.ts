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
// DEPENDS ON: @/lib/langRegistry (FREE_PACK_CODES),
//             @/lib/licenseTypes (LICENSE_TYPES, LicenseType),
//             @/lib/utils (localDateStr)
// USED BY: store/srsStore.ts, store/entitlementStore.ts, store/settingsStore.ts
// EXPORTS: IDLE_THRESHOLD_DEFAULT_MINUTES — single source of truth for the idle default;
//          imported by store/settingsStore.ts and mirrored (as seconds) in interrupt.rs.
// ===========================================

import { FREE_PACK_CODES } from "@/lib/langRegistry";
import { LICENSE_TYPES, type LicenseType } from "@/lib/licenseTypes";
import { localDateStr, isCalendarValidDate } from "@/lib/utils";

// ── SRS store ─────────────────────────────────────────────────────────────────

export const SRS_VERSION = 3;

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
      migratedIntroductions[cardId] = { ...record, phaseStartDate };
    }
    return { ...d, introductions: migratedIntroductions };
  },
};

export function migrateSrsStore(persisted: unknown, storedVersion: number): unknown {
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
    return {
      licenseKey:    typeof d.licenseKey === "string" ? d.licenseKey : null,
      instanceId:    typeof d.instanceId === "string" ? d.instanceId : null,
      licenseType:   typeof d.licenseType === "string" ? d.licenseType : "free",
      unlockedPacks: Array.isArray(d.unlockedPacks) ? d.unlockedPacks : [...FREE_PACK_CODES],
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
  // Element-shape guard: filter to string-only so a corrupt/pre-release blob with
  // non-string elements (null, number, object) cannot propagate into entitlementStore.
  3: (data: unknown) => {
    const d = data as Record<string, unknown>;
    const raw = Array.isArray(d.purchasedAddOns) ? d.purchasedAddOns : [];
    return { ...d, purchasedAddOns: raw.filter((item): item is string => typeof item === "string") };
  },
};

export function migrateEntitlementStore(persisted: unknown, storedVersion: number): unknown {
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
