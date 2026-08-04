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

import { describe, it, expect, vi } from "vitest";
import {
  migrateSrsStore,
  migrateEntitlementStore,
  migrateSettingsStore,
  SRS_VERSION,
  ENTITLEMENT_VERSION,
  SETTINGS_VERSION,
} from "@/store/migrations";

// Mock SPECIALTY_PACKS so the v2→v3 migration filter (#344, #384) is deterministic in tests.
// One ready:true and one ready:false entry — the filter must check REGISTRATION only
// (membership in SPECIALTY_PACKS); the mutable ready flag must never drop a persisted
// paid purchase record (Task #384 data-loss fix).
const mockSpecialtyPacks = vi.hoisted(() => [
  { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
  { code: "it-legal",   baseLang: "it", name: "Legal Italian",   ready: false },
]);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: mockSpecialtyPacks,
    // Task #407: isRegisteredSpecialtyCode closes over the module-scope SPECIALTY_PACKS
    // binding, not the exported one — override it here so the v2→v3 migration filter uses
    // this mock's fixture list (same reasoning as isSpecialtyPackCode's override elsewhere).
    isRegisteredSpecialtyCode: (s: string) => mockSpecialtyPacks.some(sp => sp.code === s),
  };
});

// ── Version constants ─────────────────────────────────────────────────────────

// S011: exact value assertions (not just "positive integer")
describe("version constants", () => {
  it("SRS_VERSION is 3", () => {
    expect(SRS_VERSION).toBe(3);
  });
  it("ENTITLEMENT_VERSION is 3", () => {
    expect(ENTITLEMENT_VERSION).toBe(3);
  });
  it("SETTINGS_VERSION is 3", () => {
    expect(SETTINGS_VERSION).toBe(3);
  });
});

// ── Future-version guard (Task #494) ───────────────────────────────────────────
// Root-cause regression tests for debt.md's Task #494: each migrate*Store's
// `while (v < CURRENT_VERSION)` loop only walks storedVersion UP, so a storedVersion
// already >= CURRENT_VERSION previously skipped the loop entirely and returned
// materially newer/incompatible-shaped persisted data completely unmigrated and
// unvalidated. This block proves that a genuinely NEWER-than-understood version now
// throws (refusing to apply it) rather than silently passing it through — and that
// the ALREADY-current case (storedVersion === CURRENT_VERSION, the normal steady
// state after every app boot) is untouched and still a true no-op.
describe("future-version guard — storedVersion > CURRENT_VERSION throws instead of silently passing through", () => {
  it("migrateSrsStore throws when storedVersion is newer than SRS_VERSION", () => {
    // B7 target: deleting the assertNotFutureVersion() call at the top of
    // migrateSrsStore makes this test fail — the function would instead return the
    // future-shaped garbage object completely unmigrated.
    const futureData = { cards: {}, someUnknownFutureField: "garbage-from-a-newer-build" };
    expect(() => migrateSrsStore(futureData, SRS_VERSION + 1)).toThrow(
      /SRS store version 4 is newer than this app build understands/
    );
  });

  it("migrateEntitlementStore throws when storedVersion is newer than ENTITLEMENT_VERSION", () => {
    // Empirically confirmed live before this fix: migrateEntitlementStore(data, 4) with
    // ENTITLEMENT_VERSION=3 returned `data` completely unchanged (result === data,
    // no validation at all) — the exact "silently accepts unmigrated data with no
    // throw" gap named in debt.md's Task #494.
    const futureData = { licenseType: "subscription", purchasedAddOns: "not-an-array-anymore" };
    expect(() => migrateEntitlementStore(futureData, ENTITLEMENT_VERSION + 1)).toThrow(
      /Entitlement store version 4 is newer than this app build understands/
    );
  });

  it("migrateSettingsStore throws when storedVersion is newer than SETTINGS_VERSION", () => {
    const futureData = { intervalHours: "not-a-number-anymore" };
    expect(() => migrateSettingsStore(futureData, SETTINGS_VERSION + 1)).toThrow(
      /Settings store version 4 is newer than this app build understands/
    );
  });

  it("migrateSrsStore does NOT throw and remains a true no-op when storedVersion === SRS_VERSION", () => {
    const state = { cards: { "a1-01": { reps: 7 } }, streak: 2 };
    expect(() => migrateSrsStore(state, SRS_VERSION)).not.toThrow();
    expect(migrateSrsStore(state, SRS_VERSION)).toBe(state);
  });

  it("migrateEntitlementStore does NOT throw and remains a true no-op when storedVersion === ENTITLEMENT_VERSION", () => {
    const state = { licenseType: "subscription", purchasedAddOns: ["it-medical"] };
    expect(() => migrateEntitlementStore(state, ENTITLEMENT_VERSION)).not.toThrow();
    expect(migrateEntitlementStore(state, ENTITLEMENT_VERSION)).toBe(state);
  });

  it("migrateSettingsStore does NOT throw and remains a true no-op when storedVersion === SETTINGS_VERSION", () => {
    const state = { intervalHours: 3 };
    expect(() => migrateSettingsStore(state, SETTINGS_VERSION)).not.toThrow();
    expect(migrateSettingsStore(state, SETTINGS_VERSION)).toBe(state);
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
    // Reference equality proves the migration loop never ran — any migration step
    // creates a new object, so toBe fails if the version-guard was deleted.
    expect(result).toBe(state);
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
    const state = { cards, streak: 2 };
    const result = migrateSrsStore(state, SRS_VERSION) as Record<string, unknown>;
    expect((result.cards as typeof cards)?.["a1-01"]?.reps).toBe(7);
    expect(result.streak).toBe(2);
    expect(result).toBe(state);
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
    // Running from v1 applies both v2 (preserves introductions) and v3 (adds phaseStartDate).
    const existingIntros = { "it-a1u01-001": { cardId: "it-a1u01-001", introducedDate: "2026-05-01", graduated: false } };
    const result = migrateSrsStore(
      { cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: existingIntros },
      1,
    ) as Record<string, unknown>;
    const intro = (result.introductions as Record<string, Record<string, unknown>>)["it-a1u01-001"];
    expect(intro?.["cardId"]).toBe("it-a1u01-001");
    expect(intro?.["introducedDate"]).toBe("2026-05-01");
    expect(intro?.["phaseStartDate"]).toBe("2026-05-01");
    expect(intro?.["graduated"]).toBe(false);
  });

  it("v2 → v3: adds phaseStartDate to each IntroductionRecord, defaulting to introducedDate", () => {
    const state = {
      cards: {},
      streak: 5,
      lastStudiedDate: "2026-06-01",
      introductions: {
        "card-1": {
          cardId: "card-1",
          introducedDate: "2026-05-20",
          dayOfPhase: 8,
          consecutiveCorrect: 3,
          totalEncounters: 12,
          lastSeenDate: "2026-06-01",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    };
    const result = migrateSrsStore(state, 2) as Record<string, unknown> & {
      introductions: Record<string, Record<string, unknown>>;
    };
    // Task #183 F007 / #433: all 11 IntroductionRecord fields asserted — every field is now
    // individually validated (Task #433), but a well-formed input passes through unchanged.
    expect(result.introductions["card-1"]).toEqual({
      cardId: "card-1",
      introducedDate: "2026-05-20",
      phaseStartDate: "2026-05-20",
      dayOfPhase: 8,
      consecutiveCorrect: 3,
      totalEncounters: 12,
      lastSeenDate: "2026-06-01",
      appearancesToday: 1,
      consecutiveWrongToday: 0,
      lastSeenType: null,
      graduated: false,
    });
  });

  it("v2 → v3: preserves existing phaseStartDate if already populated (pre-release build)", () => {
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: {
        "card-1": {
          cardId: "card-1",
          introducedDate: "2026-05-20",
          phaseStartDate: "2026-05-25",
          dayOfPhase: 3,
          consecutiveCorrect: 0,
          totalEncounters: 5,
          lastSeenDate: "2026-05-25",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    };
    const result = migrateSrsStore(state, 2) as Record<string, unknown> & {
      introductions: Record<string, Record<string, unknown>>;
    };
    // Task #183 F007 / #433: all 11 IntroductionRecord fields asserted (same gap as the sibling test above).
    expect(result.introductions["card-1"]).toEqual({
      cardId: "card-1",
      introducedDate: "2026-05-20", // must not be clobbered
      phaseStartDate: "2026-05-25", // preserved — already populated
      dayOfPhase: 3,
      consecutiveCorrect: 0,
      totalEncounters: 5,
      lastSeenDate: "2026-05-25",
      appearancesToday: 1,
      consecutiveWrongToday: 0,
      lastSeenType: null,
      graduated: false,
    });
  });

  it("v2 → v3: preserves all other srsStore fields", () => {
    const state = { cards: { "c1": { stability: 3.2 } }, streak: 7, lastStudiedDate: "2026-06-01", introductions: {} };
    const result = migrateSrsStore(state, 2) as typeof state;
    expect(result.streak).toBe(7);
    expect(result.lastStudiedDate).toBe("2026-06-01");
    expect(result.cards).toEqual({ "c1": { stability: 3.2 } });
  });

  it("v2 → v3: record missing introducedDate gets phaseStartDate from today (not '' or NaN)", () => {
    // Corrupt legacy records that are missing both phaseStartDate and introducedDate must NOT get
    // phaseStartDate: "" — that causes getDayOfPhase to return NaN and silently hides the card.
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: {
        "card-corrupt": {
          cardId: "card-corrupt",
          // intentionally omit introducedDate to simulate corrupt legacy data
          dayOfPhase: 3,
          consecutiveCorrect: 0,
          totalEncounters: 2,
          lastSeenDate: "2026-06-01",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let result: Record<string, unknown> & { introductions: Record<string, { phaseStartDate: string }> };
    try {
      result = migrateSrsStore(state, 2) as typeof result;
      // Task #183 F008: the corrupt-record fallback must log so a real corruption incident is diagnosable.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/migration v3: corrupt record card-corrupt/),
      );
    } finally {
      errorSpy.mockRestore();
    }
    const intro = result.introductions["card-corrupt"];
    // Note: these are already exact-value assertions (.toBe / .not.toBe), not the banned
    // existence-only patterns — no existence-check tag needed. phaseStartDate is derived
    // from localDateStr() at test execution time (genuinely non-deterministic, today's date),
    // so format/non-emptiness is the strongest check possible without hardcoding "today";
    // an exact-date assertion would flake by test-run day.
    expect(typeof intro?.phaseStartDate).toBe("string");
    expect(intro?.phaseStartDate).not.toBe(""); // guards against the empty-string bug this test targets
    expect(/^\d{4}-\d{2}-\d{2}$/.test(intro?.phaseStartDate ?? "")).toBe(true);
  });

  it("v2 → v3: null record does not throw and produces a valid phaseStartDate (Zustand data-loss guard)", () => {
    // A null entry in the introductions map would cause TypeError on property access,
    // which Zustand's persist middleware catches by resetting the entire store — silently
    // wiping all SRS card history. The null guard must prevent the throw.
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: { "card-null": null },
    };
    expect(() => migrateSrsStore(state, 2)).not.toThrow();
    const result = migrateSrsStore(state, 2) as Record<string, unknown> & {
      introductions: Record<string, { phaseStartDate: string }>;
    };
    const intro = result.introductions["card-null"];
    expect(typeof intro?.phaseStartDate).toBe("string");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(intro?.phaseStartDate ?? "")).toBe(true);
  });

  it("v2 → v3: calendar-invalid introducedDate (e.g. '2026-13-45') falls back to today, not preserved", () => {
    // "2026-13-45" passes DATE_RE (/^\d{4}-\d{2}-\d{2}$/) but new Date("2026-13-45") is
    // Invalid Date. If preserved as phaseStartDate, getDayOfPhase returns NaN and the card
    // is silently hidden forever. The isNaN guard must reject it and fall back to today.
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: {
        "card-bad-date": {
          cardId: "card-bad-date",
          introducedDate: "2026-13-45",
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 1,
          lastSeenDate: "2026-07-01",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    };
    const result = migrateSrsStore(state, 2) as Record<string, unknown> & {
      introductions: Record<string, { phaseStartDate: string; introducedDate: string }>;
    };
    const intro = result.introductions["card-bad-date"];
    // Must NOT preserve the calendar-invalid string
    expect(intro?.phaseStartDate).not.toBe("2026-13-45");
    // Must be a valid calendar date — not NaN or ""
    expect(typeof intro?.phaseStartDate).toBe("string");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(intro?.phaseStartDate ?? "")).toBe(true);
    expect(isNaN(new Date(intro?.phaseStartDate ?? "").getTime())).toBe(false);
    // Task #433: introducedDate now gets the same validate-log-fallback treatment as every
    // other field — a calendar-invalid value is no longer passed through unchecked. It falls
    // back to the already-computed phaseStartDate (also "today" here, since both source
    // dates were invalid).
    expect(intro?.introducedDate).toBe(intro?.phaseStartDate);
    expect(intro?.introducedDate).not.toBe("2026-13-45");
  });

  // Task #433 (F060): a record with a malformed field must be repaired during migration,
  // not passed through untouched — a string consecutiveCorrect would otherwise reach
  // production arithmetic (recordResult does `consecutiveCorrect + 1`) as "many1"/NaN-like
  // corruption instead of a number.
  it("v2 → v3: repairs a malformed consecutiveCorrect field instead of passing it through", () => {
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: {
        "card-1": {
          cardId: "card-1",
          introducedDate: "2026-05-20",
          phaseStartDate: "2026-05-20",
          dayOfPhase: 8,
          consecutiveCorrect: "many", // malformed — should be a number
          totalEncounters: 12,
          lastSeenDate: "2026-06-01",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let result: Record<string, unknown> & { introductions: Record<string, Record<string, unknown>> };
    try {
      result = migrateSrsStore(state, 2) as typeof result;
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid consecutiveCorrect "many", using 0')
      );
    } finally {
      errorSpy.mockRestore();
    }
    expect(result.introductions["card-1"]).toEqual({
      cardId: "card-1",
      introducedDate: "2026-05-20",
      phaseStartDate: "2026-05-20",
      dayOfPhase: 8,
      consecutiveCorrect: 0, // repaired — malformed string dropped, safe default substituted
      totalEncounters: 12,
      lastSeenDate: "2026-06-01",
      appearancesToday: 1,
      consecutiveWrongToday: 0,
      lastSeenType: null,
      graduated: false,
    });
  });

  // Task #433 (F060): every remaining IntroductionRecord field gets the same treatment —
  // this test malforms all 9 at once (cardId mismatch, dayOfPhase, totalEncounters,
  // lastSeenDate, appearancesToday, consecutiveWrongToday, lastSeenType, graduated, plus
  // consecutiveCorrect covered above) and asserts every one is repaired to a safe default.
  it("v2 → v3: repairs all 9 remaining malformed IntroductionRecord fields, not just consecutiveCorrect", () => {
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: {
        "card-1": {
          cardId: "wrong-id",              // mismatched — should be replaced with the map key
          introducedDate: "2026-05-20",
          phaseStartDate: "2026-05-20",
          dayOfPhase: 999,                 // out of [1, MAX_PHASE_DAY] range
          consecutiveCorrect: 3,
          totalEncounters: -5,             // negative — invalid
          lastSeenDate: "not-a-date",      // calendar-invalid
          appearancesToday: 1.5,           // non-integer
          consecutiveWrongToday: null,     // wrong type
          lastSeenType: "shout",           // not a registered CardType
          graduated: "yes",                // wrong type
          strandedAcrossDays: "nope",      // wrong type — optional field
        },
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let result: Record<string, unknown> & { introductions: Record<string, Record<string, unknown>> };
    try {
      result = migrateSrsStore(state, 2) as typeof result;
    } finally {
      errorSpy.mockRestore();
    }
    expect(result.introductions["card-1"]).toEqual({
      cardId: "card-1",
      introducedDate: "2026-05-20",
      phaseStartDate: "2026-05-20",
      dayOfPhase: 1,
      consecutiveCorrect: 3,
      totalEncounters: 0,
      lastSeenDate: "2026-05-20", // fell back to phaseStartDate
      appearancesToday: 0,
      consecutiveWrongToday: 0,
      lastSeenType: null,
      graduated: false,
      // strandedAcrossDays dropped entirely — invalid value is treated as "never set"
    });
    expect(result.introductions["card-1"]).not.toHaveProperty("strandedAcrossDays");
  });

  // Task #183 F019: the for-loop over introductions must process each card independently —
  // one corrupt record's fallback must not leak into or corrupt a valid neighbour.
  it("v2 → v3: a corrupt record's fallback does not contaminate a valid neighbour in the same map", () => {
    const state = {
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      introductions: {
        "card-valid": {
          cardId: "card-valid",
          introducedDate: "2026-05-20",
          dayOfPhase: 8,
          consecutiveCorrect: 3,
          totalEncounters: 12,
          lastSeenDate: "2026-06-01",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
        "card-corrupt": null, // missing both date fields — must fall back to today, not throw
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let result: Record<string, unknown> & { introductions: Record<string, Record<string, unknown> | null> };
    try {
      result = migrateSrsStore(state, 2) as typeof result;
      // Same log path as the single-record corrupt test above (F008) — asserted here too for
      // consistency, since this test exercises the identical fallback branch in store/migrations.ts.
      // Must be checked before errorSpy.mockRestore() below clears the call history.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/migration v3: corrupt record card-corrupt/),
      );
    } finally {
      errorSpy.mockRestore();
    }
    // The valid neighbour keeps its own phaseStartDate — untouched by the corrupt record's
    // today-fallback path processed in the same loop iteration set.
    expect(result.introductions["card-valid"]).toEqual({
      cardId: "card-valid",
      introducedDate: "2026-05-20",
      phaseStartDate: "2026-05-20",
      dayOfPhase: 8,
      consecutiveCorrect: 3,
      totalEncounters: 12,
      lastSeenDate: "2026-06-01",
      appearancesToday: 1,
      consecutiveWrongToday: 0,
      lastSeenType: null,
      graduated: false,
    });
    // The corrupt record still gets its own independent valid fallback, not "" or NaN.
    const corruptPhaseStartDate = result.introductions["card-corrupt"]?.phaseStartDate;
    expect(typeof corruptPhaseStartDate).toBe("string");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(String(corruptPhaseStartDate))).toBe(true);
  });

  // Migration chain guard — verify every step from v0 to SRS_VERSION is defined.
  // If SRS_VERSION is bumped without adding the migration step, migrateSrsStore throws
  // at runtime. This test catches that at CI time: migrating from v0 will throw if any
  // step in the chain is missing.
  it("migration chain is gap-free: migrating from v0 does not throw (all steps defined)", () => {
    expect(() => migrateSrsStore({}, 0)).not.toThrow();
  });

  it("migration chain: last step (SRS_VERSION - 1 → current) does not throw", () => {
    expect(() =>
      migrateSrsStore(
        { cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} },
        SRS_VERSION - 1
      )
    ).not.toThrow();
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

  it("preserves existing unlockedPacks array of registered codes", () => {
    const result = migrateEntitlementStore({ unlockedPacks: ["it", "es"] }, 0) as Record<string, unknown>;
    expect(result.unlockedPacks).toEqual(["it", "es"]);
  });

  it("v0 → v1: filters out unregistered unlockedPacks codes and logs the drop (#383)", () => {
    // Before #383, the filter was typeof item === "string" only — an unregistered code like
    // "fr" (never registered in lib/langRegistry.ts) would survive migration and could poison
    // a storage key lookup downstream. Mirrors the v2->v3 purchasedAddOns fix (#384).
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = migrateEntitlementStore({ unlockedPacks: ["it", "fr"] }, 0) as Record<string, unknown>;
      expect(result.unlockedPacks).toEqual(["it"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`dropped 1 unregistered unlockedPacks entries: ["fr"]`)
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("v0 → v1: drops non-string unlockedPacks elements (corrupt blob) and logs them (#383)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = migrateEntitlementStore({ unlockedPacks: [null, 42, "it"] }, 0) as Record<string, unknown>;
      expect(result.unlockedPacks).toEqual(["it"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("dropped 2 unregistered unlockedPacks entries: [null,42]")
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("v0 → v1: preserves a registered-but-not-ready pack — the ready flag never drops it (#383)", () => {
    // "es" is registered in lib/langRegistry.ts with ready:false. Registration validation
    // (isValidPackCode) must never key off the mutable ready flag — same policy as #384.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = migrateEntitlementStore({ unlockedPacks: ["es"] }, 0) as Record<string, unknown>;
      expect(result.unlockedPacks).toEqual(["es"]);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("is a no-op when already at current version", () => {
    const state = { licenseKey: "X", licenseType: "subscription" };
    const result = migrateEntitlementStore(state, ENTITLEMENT_VERSION) as typeof state;
    expect(result.licenseKey).toBe("X");
    expect(result).toBe(state);
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

  // S013: storedVersion=1 triggers only v2 migration (unrecognised → subscription)
  it("storedVersion=1 coerces unrecognised licenseType to subscription via v2 migration", () => {
    const result = migrateEntitlementStore(
      { licenseType: "lifetime", licenseKey: "X", instanceId: "Y", unlockedPacks: ["it"], lastValidated: 0, validUntil: null },
      1
    ) as Record<string, unknown>;
    expect(result.licenseType).toBe("subscription");
  });

  it("v2 → v3: adds purchasedAddOns: [] when field is absent", () => {
    const result = migrateEntitlementStore(
      { licenseKey: null, instanceId: null, licenseType: "free", unlockedPacks: ["it"], lastValidated: 0, validUntil: null },
      2
    ) as Record<string, unknown>;
    expect(result.purchasedAddOns).toEqual([]);
  });

  it("v2 → v3: preserves registered purchasedAddOns if already populated (pre-release build)", () => {
    const result = migrateEntitlementStore(
      { licenseKey: null, instanceId: null, licenseType: "subscription", unlockedPacks: ["it"], lastValidated: 0, validUntil: null, purchasedAddOns: ["it-medical"] },
      2
    ) as Record<string, unknown>;
    expect(result.purchasedAddOns).toEqual(["it-medical"]);
  });

  it("v2 → v3: filters out unregistered purchasedAddOns codes and logs the drop (#344, #384)", () => {
    // Before #344, the filter was typeof item === "string" only — unregistered codes like
    // "garbage-pack" would survive migration into the entitlementStore. After #384, drops
    // are also logged — silently discarding persisted user data is a stop-the-line violation.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = migrateEntitlementStore(
        { licenseKey: null, instanceId: null, licenseType: "subscription", unlockedPacks: ["it"], lastValidated: 0, validUntil: null, purchasedAddOns: ["it-medical", "garbage-pack"] },
        2
      ) as Record<string, unknown>;
      // "garbage-pack" is not in SPECIALTY_PACKS — filtered out; "it-medical" is registered
      expect(result.purchasedAddOns).toEqual(["it-medical"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`dropped 1 unregistered purchasedAddOns entries: ["garbage-pack"]`)
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("v2 → v3: preserves a registered-but-not-ready purchase — the ready flag never drops a paid record (#384)", () => {
    // Data-loss regression guard (Task #384): "it-legal" is registered in the mocked
    // SPECIALTY_PACKS with ready:false — the state a pack enters when it is deprecated or
    // rolled back AFTER a user purchased it while ready:true. The old filter used
    // isSpecialtyPackCode (registration AND ready:true), which silently destroyed the paid
    // purchase record on the next migration run. The fixed filter checks registration only.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = migrateEntitlementStore(
        { licenseKey: null, instanceId: null, licenseType: "subscription", unlockedPacks: ["it"], lastValidated: 0, validUntil: null, purchasedAddOns: ["it-legal"] },
        2
      ) as Record<string, unknown>;
      expect(result.purchasedAddOns).toEqual(["it-legal"]);
      // Nothing was dropped — no warning may fire for a fully-registered list.
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("v2 → v3: drops non-string purchasedAddOns elements (corrupt blob) and logs them (#384)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = migrateEntitlementStore(
        { licenseKey: null, instanceId: null, licenseType: "subscription", unlockedPacks: ["it"], lastValidated: 0, validUntil: null, purchasedAddOns: [null, 42, "it-medical"] },
        2
      ) as Record<string, unknown>;
      expect(result.purchasedAddOns).toEqual(["it-medical"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("dropped 2 unregistered purchasedAddOns entries: [null,42]")
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("v2 → v3: preserves all other fields unchanged", () => {
    const result = migrateEntitlementStore(
      { licenseKey: "K", instanceId: "I", licenseType: "subscription", unlockedPacks: ["it", "es"], lastValidated: 12345, validUntil: 99999 },
      2
    ) as Record<string, unknown>;
    expect(result.licenseKey).toBe("K");
    expect(result.instanceId).toBe("I");
    expect(result.licenseType).toBe("subscription");
    expect(result.unlockedPacks).toEqual(["it", "es"]);
    expect(result.lastValidated).toBe(12345);
    expect(result.validUntil).toBe(99999);
    expect(result.purchasedAddOns).toEqual([]);
  });

  it("v0 → v3: full chain output includes purchasedAddOns: []", () => {
    // Task #183 F017: this test only asserts purchasedAddOns — the other 6 EntitlementState fields
    // (licenseKey, instanceId, licenseType, unlockedPacks, lastValidated, validUntil) are
    // covered for the v2→v3 step by "v2 → v3: preserves all other fields unchanged" above.
    // Not duplicated here to avoid two tests asserting the same 6 fields at different
    // migration entry points with no behavioral difference between them.
    const result = migrateEntitlementStore({}, 0) as Record<string, unknown>;
    expect(result.purchasedAddOns).toEqual([]);
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
    expect(result).toBe(state);
  });

  it("v1 → v2: adds OS trigger fields with correct defaults when absent", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30 },
      1
    ) as Record<string, unknown>;
    expect(result.wakeEnabled).toBe(true);
    expect(result.unlockEnabled).toBe(true);
    expect(result.idleEnabled).toBe(true);
    expect(result.idleThresholdMinutes).toBe(15);
  });

  it("v1 → v2: preserves existing wakeEnabled=false (pre-release build opt-out)", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: true, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, wakeEnabled: false },
      1
    ) as Record<string, unknown>;
    expect(result.wakeEnabled).toBe(false);
  });

  it("v1 → v2: preserves custom idleThresholdMinutes if already set", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: true, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, idleThresholdMinutes: 45 },
      1
    ) as Record<string, unknown>;
    expect(result.idleThresholdMinutes).toBe(45);
  });

  it("v1 → v2: preserves all existing v1 fields unchanged", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: true, interruptEnabled: true, intervalHours: 4, mandatory: true, dndStart: "23:00", dndEnd: "07:00", snoozeMinutes: 60 },
      1
    ) as Record<string, unknown>;
    expect(result.launchAtLogin).toBe(true);
    expect(result.interruptEnabled).toBe(true);
    expect(result.intervalHours).toBe(4);
    expect(result.mandatory).toBe(true);
    expect(result.dndStart).toBe("23:00");
    expect(result.dndEnd).toBe("07:00");
    expect(result.snoozeMinutes).toBe(60);
  });

  it("v0 → v2 (full chain): all new fields present with correct defaults", () => {
    const result = migrateSettingsStore({}, 0) as Record<string, unknown>;
    expect(result.wakeEnabled).toBe(true);
    expect(result.unlockEnabled).toBe(true);
    expect(result.idleEnabled).toBe(true);
    expect(result.idleThresholdMinutes).toBe(15);
  });

  it("v1 → v2: clamps idleThresholdMinutes below 5 to 5 (corrupt persisted value)", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, idleThresholdMinutes: -50 },
      1
    ) as Record<string, unknown>;
    expect(result.idleThresholdMinutes).toBe(5);
  });

  it("v1 → v2: clamps idleThresholdMinutes above 120 to 120 (corrupt persisted value)", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, idleThresholdMinutes: 99999 },
      1
    ) as Record<string, unknown>;
    expect(result.idleThresholdMinutes).toBe(120);
  });

  // Migration chain guard — verify every step from v0 to SETTINGS_VERSION is defined.
  it("migration chain is gap-free: migrating from v0 does not throw (all steps defined)", () => {
    expect(() => migrateSettingsStore({}, 0)).not.toThrow();
  });

  it("migration chain: last step (SETTINGS_VERSION - 1 → current) does not throw", () => {
    expect(() =>
      migrateSettingsStore(
        { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30 },
        SETTINGS_VERSION - 1
      )
    ).not.toThrow();
  });

  it("v2 → v3: adds sourceLang defaulting to \"en\" when absent", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, wakeEnabled: true, unlockEnabled: true, idleEnabled: true, idleThresholdMinutes: 15 },
      2
    ) as Record<string, unknown>;
    expect(result.sourceLang).toBe("en");
  });

  it("v2 → v3: preserves an existing known sourceLang value (\"es\")", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, wakeEnabled: true, unlockEnabled: true, idleEnabled: true, idleThresholdMinutes: 15, sourceLang: "es" },
      2
    ) as Record<string, unknown>;
    expect(result.sourceLang).toBe("es");
  });

  it("v2 → v3: falls back to \"en\" for an unrecognized sourceLang value (corrupt/future-build data)", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, wakeEnabled: true, unlockEnabled: true, idleEnabled: true, idleThresholdMinutes: 15, sourceLang: "xx-not-a-real-code" },
      2
    ) as Record<string, unknown>;
    expect(result.sourceLang).toBe("en");
  });

  it("v2 → v3: falls back to \"en\" when sourceLang is a non-string (corrupt persisted value)", () => {
    const result = migrateSettingsStore(
      { launchAtLogin: false, interruptEnabled: false, intervalHours: 3, mandatory: false, dndStart: "22:00", dndEnd: "08:00", snoozeMinutes: 30, wakeEnabled: true, unlockEnabled: true, idleEnabled: true, idleThresholdMinutes: 15, sourceLang: 42 },
      2
    ) as Record<string, unknown>;
    expect(result.sourceLang).toBe("en");
  });

  it("v0 → v3 (full chain): sourceLang present with correct default", () => {
    const result = migrateSettingsStore({}, 0) as Record<string, unknown>;
    expect(result.sourceLang).toBe("en");
  });
});
