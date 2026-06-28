// ============================================================
// tests/introduction.test.ts — structural and behavioral tests for the introduction engine
// ============================================================
import { describe, it, expect } from "vitest";
import type { IntroductionRecord } from "@/content/types";
import {
  MAX_APPEARANCES_BY_PHASE_DAY,
  getDayOfPhase,
  maxAppearancesToday,
  shouldAppearToday,
  recordResult,
  shouldGraduate,
  getNextCardType,
} from "@/lib/introduction";

describe("IntroductionRecord — shape", () => {
  it("conforms to all required fields with correct types", () => {
    const record: IntroductionRecord = {
      cardId: "it-a1u01-001",
      introducedDate: "2026-06-27",
      dayOfPhase: 1,
      consecutiveCorrect: 0,
      totalEncounters: 0,
      lastSeenDate: "2026-06-27",
      appearancesToday: 0,
      consecutiveWrongToday: 0,
      lastSeenType: null,
      graduated: false,
    };
    expect(record.cardId).toBe("it-a1u01-001");
    expect(record.introducedDate).toBe("2026-06-27");
    expect(record.dayOfPhase).toBe(1);
    expect(record.consecutiveCorrect).toBe(0);
    expect(record.totalEncounters).toBe(0);
    expect(record.lastSeenDate).toBe("2026-06-27");
    expect(record.appearancesToday).toBe(0);
    expect(record.consecutiveWrongToday).toBe(0);
    expect(record.lastSeenType).toBeNull();
    expect(record.graduated).toBe(false);
  });

  it("accepts a non-null lastSeenType", () => {
    const record: IntroductionRecord = {
      cardId: "it-a1u01-002",
      introducedDate: "2026-06-26",
      dayOfPhase: 2,
      consecutiveCorrect: 3,
      totalEncounters: 5,
      lastSeenDate: "2026-06-27",
      appearancesToday: 1,
      consecutiveWrongToday: 0,
      lastSeenType: "recognize",
      graduated: false,
    };
    expect(record.lastSeenType).toBe("recognize");
    expect(record.dayOfPhase).toBe(2);
    expect(record.consecutiveCorrect).toBe(3);
  });
});

describe("MAX_APPEARANCES_BY_PHASE_DAY", () => {
  it("is a non-null object with numeric keys", () => {
    expect(typeof MAX_APPEARANCES_BY_PHASE_DAY).toBe("object");
    expect(MAX_APPEARANCES_BY_PHASE_DAY).not.toBeNull();
    for (const key of Object.keys(MAX_APPEARANCES_BY_PHASE_DAY)) {
      expect(Number.isFinite(Number(key))).toBe(true);
    }
  });

  it("day 1 is Infinity — every interrupt, no daily cap", () => {
    expect(MAX_APPEARANCES_BY_PHASE_DAY[1]).toBe(Infinity);
  });

  it("day 11 is 0.5 — every other day", () => {
    expect(MAX_APPEARANCES_BY_PHASE_DAY[11]).toBe(0.5);
  });
});

describe("getDayOfPhase", () => {
  it("returns 1 when introduced today", () => {
    expect(getDayOfPhase("2026-06-27", "2026-06-27")).toBe(1);
  });

  it("returns 2 when introduced yesterday", () => {
    expect(getDayOfPhase("2026-06-26", "2026-06-27")).toBe(2);
  });

  it("returns 22 when introduced exactly 21 days ago", () => {
    // 2026-06-27 minus 21 days = 2026-06-06; diff=21, +1 = 22
    expect(getDayOfPhase("2026-06-06", "2026-06-27")).toBe(22);
  });

  it("clamps to 22 when introduced more than 21 days ago", () => {
    // 2026-06-27 minus 25 days = 2026-06-02; unclamped would be 26, clamped to 22
    expect(getDayOfPhase("2026-06-02", "2026-06-27")).toBe(22);
  });

  it("advances by calendar days even after a study gap (phase does not pause)", () => {
    // introduced 10 days ago (2026-06-17); not studied for 3 days — still day 11
    expect(getDayOfPhase("2026-06-17", "2026-06-27")).toBe(11);
  });

  it("returns 21 when introduced exactly 20 days ago (one below graduation clamp)", () => {
    // 2026-06-27 minus 20 days = 2026-06-07; diff=20, +1=21 — not clamped
    expect(getDayOfPhase("2026-06-07", "2026-06-27")).toBe(21);
  });

  it("clamps to 1 when today is before introducedDate (clock skew / bad data)", () => {
    // Exercises the Math.max(1, ...) lower-bound guard added in Task #042
    expect(getDayOfPhase("2026-06-28", "2026-06-27")).toBe(1);
  });
});

describe("maxAppearancesToday", () => {
  it("day 1 → Infinity (no daily cap — every interrupt)", () => {
    expect(maxAppearancesToday(1)).toBe(Infinity);
  });

  it("day 2 → 5 (every other interrupt)", () => {
    expect(maxAppearancesToday(2)).toBe(5);
  });

  it("day 4 → 2 (days 3–5 appear twice daily)", () => {
    expect(maxAppearancesToday(4)).toBe(2);
  });

  it("day 8 → 1 (days 6–10 appear once daily)", () => {
    expect(maxAppearancesToday(8)).toBe(1);
  });

  it("day 15 → 0.5 (days 11–21 appear every other day)", () => {
    expect(maxAppearancesToday(15)).toBe(0.5);
  });

  it("day 22 → 0 (graduated to FSRS, never appears in introduction queue)", () => {
    expect(maxAppearancesToday(22)).toBe(0);
  });
});

// Helper to build a minimal valid IntroductionRecord for shouldAppearToday tests.
const makeRecord = (overrides: Partial<IntroductionRecord>): IntroductionRecord => ({
  cardId: "it-a1u01-001",
  introducedDate: "2026-06-17",
  dayOfPhase: 1,
  consecutiveCorrect: 0,
  totalEncounters: 0,
  lastSeenDate: "2026-06-27",
  appearancesToday: 0,
  consecutiveWrongToday: 0,
  lastSeenType: null,
  graduated: false,
  ...overrides,
});

describe("shouldAppearToday", () => {
  it("graduated record → false regardless of phase day", () => {
    expect(shouldAppearToday(makeRecord({ graduated: true, dayOfPhase: 5 }), "2026-06-27")).toBe(false);
  });

  it("day 22 (not graduated) → false (max=0, no appearances allowed)", () => {
    expect(shouldAppearToday(makeRecord({ dayOfPhase: 22 }), "2026-06-27")).toBe(false);
  });

  it("day 1, appearancesToday=0 → true (Infinity cap not reached)", () => {
    expect(shouldAppearToday(makeRecord({ dayOfPhase: 1, appearancesToday: 0 }), "2026-06-27")).toBe(true);
  });

  it("day 11 (odd dayOfPhase), appearancesToday=0 → true (every-other-day: odd phase days appear)", () => {
    expect(shouldAppearToday(makeRecord({ dayOfPhase: 11, appearancesToday: 0 }), "2026-06-27")).toBe(true);
  });

  it("day 12 (even dayOfPhase), appearancesToday=0 → false (every-other-day: even phase days skip)", () => {
    expect(shouldAppearToday(makeRecord({ dayOfPhase: 12, appearancesToday: 0 }), "2026-06-27")).toBe(false);
  });

  it("day 2, appearancesToday=5 → false (daily cap of 5 reached)", () => {
    expect(shouldAppearToday(makeRecord({ dayOfPhase: 2, appearancesToday: 5 }), "2026-06-27")).toBe(false);
  });

  it("day 13 (odd dayOfPhase), appearancesToday=0 → true (confirms odd parity rule beyond day 11)", () => {
    expect(shouldAppearToday(makeRecord({ dayOfPhase: 13, appearancesToday: 0 }), "2026-06-27")).toBe(true);
  });
});

describe("shouldGraduate", () => {
  it("returns true when consecutiveCorrect >= 15", () => {
    expect(shouldGraduate(makeRecord({ consecutiveCorrect: 15 }))).toBe(true);
  });

  it("returns false when consecutiveCorrect < 15", () => {
    expect(shouldGraduate(makeRecord({ consecutiveCorrect: 14 }))).toBe(false);
  });
});

describe("recordResult", () => {
  it("correct answer increments counters and resets consecutiveWrongToday", () => {
    const result = recordResult(
      makeRecord({ consecutiveCorrect: 3, totalEncounters: 10, appearancesToday: 2, consecutiveWrongToday: 1 }),
      true,
      "2026-06-27",
    );
    expect(result.consecutiveCorrect).toBe(4);
    expect(result.totalEncounters).toBe(11);
    expect(result.appearancesToday).toBe(3);
    expect(result.consecutiveWrongToday).toBe(0);
    expect(result.lastSeenDate).toBe("2026-06-27");
  });

  it("15th consecutive correct answer sets graduated: true", () => {
    const result = recordResult(makeRecord({ consecutiveCorrect: 14 }), true, "2026-06-27");
    expect(result.graduated).toBe(true);
  });

  it("wrong answer resets consecutiveCorrect and increments consecutiveWrongToday", () => {
    const result = recordResult(
      makeRecord({ consecutiveCorrect: 5, totalEncounters: 10, consecutiveWrongToday: 0 }),
      false,
      "2026-06-27",
    );
    expect(result.consecutiveCorrect).toBe(0);
    expect(result.consecutiveWrongToday).toBe(1);
    expect(result.totalEncounters).toBe(11);
  });

  it("third consecutive wrong resets dayOfPhase to 1 and clears consecutiveWrongToday", () => {
    // consecutiveWrongToday: 2 + one more wrong = 3 total → Day 1 reset
    const result = recordResult(makeRecord({ consecutiveWrongToday: 2, dayOfPhase: 8 }), false, "2026-06-27");
    expect(result.dayOfPhase).toBe(1);
    expect(result.consecutiveWrongToday).toBe(0);
  });

  it("does not mutate the original record (immutability)", () => {
    const original = makeRecord({ consecutiveCorrect: 3 });
    const result = recordResult(original, true, "2026-06-27");
    expect(original.consecutiveCorrect).toBe(3);
    expect(result.consecutiveCorrect).toBe(4);
  });

  it("second consecutive wrong increments consecutiveWrongToday to 2 without resetting dayOfPhase", () => {
    // Only 3rd wrong triggers Day 1 reset; 2nd wrong is an intermediate state
    const result = recordResult(makeRecord({ consecutiveWrongToday: 1, dayOfPhase: 8 }), false, "2026-06-27");
    expect(result.consecutiveWrongToday).toBe(2);
    expect(result.dayOfPhase).toBe(8);
  });

  it("15th consecutive correct sets both consecutiveCorrect to 15 and graduated to true", () => {
    const result = recordResult(makeRecord({ consecutiveCorrect: 14 }), true, "2026-06-27");
    expect(result.consecutiveCorrect).toBe(15);
    expect(result.graduated).toBe(true);
  });
});

describe("getNextCardType", () => {
  it("returns any available type when lastSeenType is null", () => {
    const result = getNextCardType(null, ["recognize", "produce"]);
    expect(["recognize", "produce"] as string[]).toContain(result);
  });

  it("returns a different type when an alternative to lastSeenType is available", () => {
    expect(getNextCardType("produce", ["recognize", "produce"])).toBe("recognize");
  });

  it("returns lastSeenType when it is the only available option", () => {
    expect(getNextCardType("produce", ["produce"])).toBe("produce");
  });

  it("avoids lastSeenType when multiple alternatives exist and returns a value within available", () => {
    const result = getNextCardType("fill_blank", ["recognize", "produce", "fill_blank"]);
    expect(result).not.toBe("fill_blank");
    expect(["recognize", "produce", "fill_blank"] as string[]).toContain(result);
  });
});
