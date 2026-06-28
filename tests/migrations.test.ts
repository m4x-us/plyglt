// ===========================================
// STORE MIGRATIONS TESTS
// ===========================================
// Tests for store/migrations.ts — verifies that migrateSrsStore,
// migrateEntitlementStore, and migrateSettingsStore correctly walk
// stored state from any prior version to the current shape.
// ===========================================
// DEPENDS ON: @/store/migrations
// USED BY: CI / npm test
// ===========================================

import { describe, it, expect } from "vitest";
import {
  migrateSrsStore,
  migrateEntitlementStore,
  migrateSettingsStore,
  SRS_VERSION,
  ENTITLEMENT_VERSION,
  SETTINGS_VERSION,
} from "@/store/migrations";

// ── Version constants ─────────────────────────────────────────────────────────

// S011: exact value assertions (not just "positive integer")
describe("version constants", () => {
  it("SRS_VERSION is 2", () => {
    expect(SRS_VERSION).toBe(2);
  });
  it("ENTITLEMENT_VERSION is 2", () => {
    expect(ENTITLEMENT_VERSION).toBe(2);
  });
  it("SETTINGS_VERSION is 1", () => {
    expect(SETTINGS_VERSION).toBe(1);
  });
});

// ── migrateSrsStore ───────────────────────────────────────────────────────────

describe("migrateSrsStore()", () => {
  it("is a no-op when already at current version", () => {
    const state = { cards: { "a1-01": { reps: 3 } }, streak: 5, lastStudiedDate: "2026-01-01", activeSession: null };
    const result = migrateSrsStore(state, SRS_VERSION) as typeof state;
    expect(result.streak).toBe(5);
    expect(result.lastStudiedDate).toBe("2026-01-01");
    expect(result.cards).toEqual(state.cards);
  });

  it("v0 → v1: fills empty object with all defaults", () => {
    const result = migrateSrsStore({}, 0) as Record<string, unknown>;
    expect(result.cards).toEqual({});
    expect(result.streak).toBe(0);
    expect(result.lastStudiedDate).toBeNull();
    expect(result.activeSession).toBeNull();
  });

  it("v0 → v1: preserves existing cards", () => {
    const cards = { "a1-01": { cardId: "a1-01", reps: 3, state: "review" } };
    const result = migrateSrsStore({ cards }, 0) as { cards: unknown };
    expect(result.cards).toEqual(cards);
  });

  it("v0 → v1: preserves existing streak", () => {
    const result = migrateSrsStore({ streak: 14 }, 0) as { streak: number };
    expect(result.streak).toBe(14);
  });

  it("v0 → v1: preserves lastStudiedDate", () => {
    const result = migrateSrsStore({ lastStudiedDate: "2026-06-01" }, 0) as { lastStudiedDate: string };
    expect(result.lastStudiedDate).toBe("2026-06-01");
  });

  it("v0 → v1: preserves non-null activeSession", () => {
    const session = { unitId: "a1-unit-01", queueIds: [], position: 2 };
    const result = migrateSrsStore({ activeSession: session }, 0) as { activeSession: unknown };
    expect(result.activeSession).toEqual(session);
  });

  it("v0 → v1: null cards object falls back to empty object", () => {
    const result = migrateSrsStore({ cards: null }, 0) as { cards: unknown };
    expect(result.cards).toEqual({});
  });

  it("is a no-op when storedVersion already equals current version", () => {
    const cards = { "a1-01": { reps: 7 } };
    const result = migrateSrsStore({ cards, streak: 2 }, SRS_VERSION) as Record<string, unknown>;
    expect((result.cards as typeof cards)?.["a1-01"]?.reps).toBe(7);
    expect(result.streak).toBe(2);
  });

  it("v1 → v2: adds introductions: {} and preserves all existing fields", () => {
    const result = migrateSrsStore(
      { cards: {}, streak: 0, lastStudiedDate: null, activeSession: null },
      1,
    ) as Record<string, unknown>;
    expect(result.introductions).toEqual({});
    expect(result.cards).toEqual({});
    expect(result.streak).toBe(0);
    expect(result.lastStudiedDate).toBeNull();
    expect(result.activeSession).toBeNull();
  });

  it("v1 → v2: preserves existing introductions when already populated (does not reset to {})", () => {
    const existingIntros = { "it-a1u01-001": { cardId: "it-a1u01-001", graduated: false } };
    const result = migrateSrsStore(
      { cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: existingIntros },
      1,
    ) as Record<string, unknown>;
    expect(result.introductions).toEqual(existingIntros);
  });
});

// ── migrateEntitlementStore ───────────────────────────────────────────────────

describe("migrateEntitlementStore()", () => {
  it("fills all missing fields with defaults on v0 → v1", () => {
    const result = migrateEntitlementStore({}, 0) as Record<string, unknown>;
    expect(result.licenseKey).toBeNull();
    expect(result.instanceId).toBeNull();
    expect(result.licenseType).toBe("free");
    expect(result.unlockedPacks).toEqual(["it"]);
    expect(result.lastValidated).toBe(0);
    expect(result.validUntil).toBeNull();
  });

  it("preserves existing licenseKey", () => {
    const result = migrateEntitlementStore({ licenseKey: "ABCD-1234" }, 0) as Record<string, unknown>;
    expect(result.licenseKey).toBe("ABCD-1234");
  });

  it("coerces unrecognised licenseType to subscription via v2 migration", () => {
    const result = migrateEntitlementStore({ licenseType: "lifetime" }, 0) as Record<string, unknown>;
    expect(result.licenseType).toBe("subscription");
  });

  it("preserves free licenseType unchanged through all migrations", () => {
    const result = migrateEntitlementStore({ licenseType: "free" }, 0) as Record<string, unknown>;
    expect(result.licenseType).toBe("free");
  });

  it("preserves subscription licenseType unchanged through all migrations", () => {
    const result = migrateEntitlementStore({ licenseType: "subscription" }, 0) as Record<string, unknown>;
    expect(result.licenseType).toBe("subscription");
  });

  it("preserves non-null validUntil", () => {
    const expiry = 1750000000000;
    const result = migrateEntitlementStore({ validUntil: expiry }, 0) as Record<string, unknown>;
    expect(result.validUntil).toBe(expiry);
  });

  it("preserves existing unlockedPacks array", () => {
    const result = migrateEntitlementStore({ unlockedPacks: ["it", "es", "fr"] }, 0) as Record<string, unknown>;
    expect(result.unlockedPacks).toEqual(["it", "es", "fr"]);
  });

  it("is a no-op when already at current version", () => {
    const state = { licenseKey: "X", licenseType: "subscription" };
    const result = migrateEntitlementStore(state, ENTITLEMENT_VERSION) as typeof state;
    expect(result.licenseKey).toBe("X");
  });

  // V7: migration guard — verify every step from v0 to ENTITLEMENT_VERSION is defined.
  // If ENTITLEMENT_VERSION is bumped without adding the migration step, migrateEntitlementStore
  // throws "Missing entitlement store migration to version N" at runtime. This test catches
  // that case at CI time: migrating from v0 will throw if any step in the chain is missing.
  it("migration chain is gap-free: migrating from v0 does not throw (all steps defined)", () => {
    expect(() => migrateEntitlementStore({}, 0)).not.toThrow();
  });

  it("migration chain: last step (ENTITLEMENT_VERSION - 1 → current) does not throw", () => {
    expect(() =>
      migrateEntitlementStore(
        { licenseKey: null, instanceId: null, licenseType: "subscription", unlockedPacks: ["it"], lastValidated: 0, validUntil: null },
        ENTITLEMENT_VERSION - 1
      )
    ).not.toThrow();
  });

  // S013: storedVersion=1 triggers only v2 migration (lifetime → subscription)
  it("storedVersion=1 still coerces lifetime licenseType to subscription via v2 migration", () => {
    const result = migrateEntitlementStore(
      { licenseType: "lifetime", licenseKey: "X", instanceId: "Y", unlockedPacks: ["it"], lastValidated: 0, validUntil: null },
      1
    ) as Record<string, unknown>;
    expect(result.licenseType).toBe("subscription");
  });
});

// ── migrateSettingsStore ──────────────────────────────────────────────────────

describe("migrateSettingsStore()", () => {
  it("fills all missing fields with defaults on v0 → v1", () => {
    const result = migrateSettingsStore({}, 0) as Record<string, unknown>;
    expect(result.launchAtLogin).toBe(false);
    expect(result.interruptEnabled).toBe(false);
    expect(result.intervalHours).toBe(3);
    expect(result.mandatory).toBe(false);
    expect(result.dndStart).toBe("22:00");
    expect(result.dndEnd).toBe("08:00");
    expect(result.snoozeMinutes).toBe(30);
  });

  it("preserves existing intervalHours", () => {
    const result = migrateSettingsStore({ intervalHours: 6 }, 0) as Record<string, unknown>;
    expect(result.intervalHours).toBe(6);
  });

  it("preserves existing mandatory flag", () => {
    const result = migrateSettingsStore({ mandatory: true }, 0) as Record<string, unknown>;
    expect(result.mandatory).toBe(true);
  });

  it("preserves custom DND hours", () => {
    const result = migrateSettingsStore({ dndStart: "23:30", dndEnd: "07:00" }, 0) as Record<string, unknown>;
    expect(result.dndStart).toBe("23:30");
    expect(result.dndEnd).toBe("07:00");
  });

  it("is a no-op when already at current version", () => {
    const state = { intervalHours: 4, mandatory: true };
    const result = migrateSettingsStore(state, SETTINGS_VERSION) as typeof state;
    expect(result.intervalHours).toBe(4);
    expect(result.mandatory).toBe(true);
  });
});
