// ============================================================
// tests/introduction.test.ts — structural tests + scheduling math for the introduction engine
// Split from a single 436-line file (Task #181) to stay under the 250-line file limit.
// See also: tests/introduction_behavior.test.ts (shouldAppearToday/shouldGraduate/recordResult/
// getNextCardType) and tests/seam_introduction.test.ts (cross-module store seam test).
// ============================================================
import { describe, it, expect } from "vitest";
import type { IntroductionRecord } from "@/content/types";
import {
  MAX_APPEARANCES_BY_PHASE_DAY,
  GRADUATION_THRESHOLD,
  CONSECUTIVE_WRONG_RESET,
  getDayOfPhase,
  maxAppearancesToday,
} from "@/lib/introduction";

describe("IntroductionRecord — shape", () => {
  it("conforms to all required fields with correct types", () => {
    const record: IntroductionRecord = {
      cardId: "it-a1u01-001",
      introducedDate: "2026-06-27",
      phaseStartDate: "2026-06-27",
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
    expect(record.phaseStartDate).toBe("2026-06-27");
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
      phaseStartDate: "2026-06-26",
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

describe("GRADUATION_THRESHOLD / CONSECUTIVE_WRONG_RESET", () => {
  it("GRADUATION_THRESHOLD is 15 — matches BRAND.md 15-consecutive-correct rule", () => {
    expect(GRADUATION_THRESHOLD).toBe(15);
  });

  it("CONSECUTIVE_WRONG_RESET is 3 — matches BRAND.md triple-wrong Day 1 reset rule", () => {
    expect(CONSECUTIVE_WRONG_RESET).toBe(3);
  });

  it("MAX_APPEARANCES_BY_PHASE_DAY is frozen (cannot be mutated by importers)", () => {
    const attempt = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (MAX_APPEARANCES_BY_PHASE_DAY as any)[1] = 999;
    };
    // Object.freeze causes silent failure in non-strict mode and throws in strict mode.
    // Either way the value must remain unchanged.
    try { attempt(); } catch { /* strict mode throw — acceptable */ }
    expect(MAX_APPEARANCES_BY_PHASE_DAY[1]).toBe(Infinity);
  });
});

// F16 — every one of the 22 phase-day entries is asserted individually (not just a sample),
// so a silent edit to any single entry in the scheduling table fails a test.
describe("MAX_APPEARANCES_BY_PHASE_DAY — full table (all 22 phase days)", () => {
  const EXPECTED_BY_PHASE_DAY: Record<number, number> = {
    1: Infinity,
    2: 5,
    3: 2,
    4: 2,
    5: 2,
    6: 1,
    7: 1,
    8: 1,
    9: 1,
    10: 1,
    11: 0.5,
    12: 0.5,
    13: 0.5,
    14: 0.5,
    15: 0.5,
    16: 0.5,
    17: 0.5,
    18: 0.5,
    19: 0.5,
    20: 0.5,
    21: 0.5,
    22: 0,
  };

  it.each(Object.entries(EXPECTED_BY_PHASE_DAY))(
    "phase day %s maps to %s",
    (day, expected) => {
      expect(MAX_APPEARANCES_BY_PHASE_DAY[Number(day)]).toBe(expected);
    },
  );

  it("has exactly 22 entries — no extra or missing phase day", () => {
    expect(Object.keys(MAX_APPEARANCES_BY_PHASE_DAY)).toHaveLength(22);
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

  it("throws [ERR-INTRO-DATE] when phaseStartDate is not YYYY-MM-DD", () => {
    expect(() => getDayOfPhase("invalid", "2026-06-27")).toThrow("[ERR-INTRO-DATE]");
  });

  it("throws [ERR-INTRO-DATE] when today is not YYYY-MM-DD", () => {
    expect(() => getDayOfPhase("2026-06-27", "27-06-2026")).toThrow("[ERR-INTRO-DATE]");
  });

  it("throws [ERR-INTRO-DATE] on empty string inputs", () => {
    expect(() => getDayOfPhase("", "2026-06-27")).toThrow("[ERR-INTRO-DATE]");
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

  it("day 25 → 0 (out-of-bounds day not in table — ?? 0 fallback)", () => {
    // Covers the nullish-coalescing branch at line 49: undefined ?? 0
    expect(maxAppearancesToday(25)).toBe(0);
  });
});
