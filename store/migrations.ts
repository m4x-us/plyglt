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
//             @/lib/licenseTypes (LICENSE_TYPES, LicenseType)
// USED BY: store/srsStore.ts, store/entitlementStore.ts, store/settingsStore.ts
// ===========================================

import { FREE_PACK_CODES } from "@/lib/langRegistry";
import { LICENSE_TYPES, type LicenseType } from "@/lib/licenseTypes";

// ── SRS store ─────────────────────────────────────────────────────────────────

export const SRS_VERSION = 2;

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

export const ENTITLEMENT_VERSION = 2;

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

export const SETTINGS_VERSION = 1;

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
