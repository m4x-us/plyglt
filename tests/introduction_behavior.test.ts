// ============================================================
// tests/introduction_behavior.test.ts — decision/progression functions of the introduction
// engine: shouldAppearToday, shouldGraduate, recordResult, getNextCardType.
// Split from tests/introduction.test.ts (Task #181) to stay under the 250-line file limit.
// See also: tests/introduction.test.ts (shape + scheduling math) and
// tests/seam_introduction.test.ts (cross-module store seam test).
// ============================================================
import { describe, it, expect } from "vitest";
import type { IntroductionRecord } from "@/content/types";
import {
  shouldAppearToday,
  recordResult,
  shouldGraduate,
  getNextCardType,
} from "@/lib/introduction";

// Helper to build a minimal valid IntroductionRecord for these tests.
const makeRecord = (overrides: Partial<IntroductionRecord>): IntroductionRecord => ({
  cardId: "it-a1u01-001",
  introducedDate: "2026-06-17",
  phaseStartDate: "2026-06-17",
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

  it("uses 0 as appearances when lastSeenDate is not today (date-reset ternary false branch)", () => {
    // Card was seen yesterday with 3 appearances; today is a new day → treat as 0 appearances
    // Covers line 60 ternary false branch: lastSeenDate !== today → 0
    const record = makeRecord({ dayOfPhase: 8, lastSeenDate: "2026-06-26", appearancesToday: 3 });
    // max=1 for day 8; date-reset sets appearances=0, so 0 < 1 → should appear
    expect(shouldAppearToday(record, "2026-06-27")).toBe(true);
  });

  it("day 11 (on day), appearancesToday=1 today → false (0.5-cap: once per on-day)", () => {
    // On an odd phase day in the 11–21 range, once we've seen the card today it must not reappear.
    const record = makeRecord({ dayOfPhase: 11, lastSeenDate: "2026-06-27", appearancesToday: 1 });
    expect(shouldAppearToday(record, "2026-06-27")).toBe(false);
  });

  it("day 11 (on day), appearancesToday=1 yesterday → true (day reset: yesterday count doesn't carry over)", () => {
    // Yesterday's appearance count must not block today's single allowed appearance.
    const record = makeRecord({ dayOfPhase: 11, lastSeenDate: "2026-06-26", appearancesToday: 1 });
    expect(shouldAppearToday(record, "2026-06-27")).toBe(true);
  });
});

describe("shouldGraduate", () => {
  it("returns false when consecutiveCorrect is 0 (new card, far from threshold)", () => {
    expect(shouldGraduate(makeRecord({ consecutiveCorrect: 0 }))).toBe(false);
  });

  it("returns false when consecutiveCorrect < 15", () => {
    expect(shouldGraduate(makeRecord({ consecutiveCorrect: 14 }))).toBe(false);
  });

  it("returns true when consecutiveCorrect >= 15", () => {
    expect(shouldGraduate(makeRecord({ consecutiveCorrect: 15 }))).toBe(true);
  });

  it("returns true when consecutiveCorrect is 16 (above threshold)", () => {
    expect(shouldGraduate(makeRecord({ consecutiveCorrect: 16 }))).toBe(true);
  });
});

describe("recordResult", () => {
  // F21 — every field of the returned record is pinned (full-object equality), not a subset.
  // A prior version of this suite asserted 5 of 11 fields; an unasserted field could silently
  // carry a wrong value (e.g. a stale cardId or dropped lastSeenType) with no test catching it.
  it("correct-path return: all 11 IntroductionRecord fields asserted explicitly", () => {
    const input = makeRecord({
      cardId: "it-a1u01-099",
      introducedDate: "2026-06-01",
      phaseStartDate: "2026-06-17",
      dayOfPhase: 8,
      consecutiveCorrect: 3,
      totalEncounters: 10,
      lastSeenDate: "2026-06-27",
      appearancesToday: 2,
      consecutiveWrongToday: 1,
      lastSeenType: "recognize",
      graduated: false,
    });
    const result = recordResult(input, true, "2026-06-27");
    expect(result).toEqual({
      cardId: "it-a1u01-099",
      introducedDate: "2026-06-01",
      phaseStartDate: "2026-06-17",
      dayOfPhase: 8,
      consecutiveCorrect: 4,
      totalEncounters: 11,
      lastSeenDate: "2026-06-27",
      appearancesToday: 3,
      consecutiveWrongToday: 0,
      lastSeenType: "recognize",
      graduated: false,
    });
  });

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

  it("third consecutive wrong advances phaseStartDate to today and clears consecutiveWrongToday", () => {
    // consecutiveWrongToday: 2 + one more wrong = 3 total → Day 1 reset via phaseStartDate advance
    // phaseStartDate is set to today so getDayOfPhase(record.phaseStartDate, today) → 1
    const result = recordResult(makeRecord({ consecutiveWrongToday: 2, dayOfPhase: 8, phaseStartDate: "2026-06-17" }), false, "2026-06-27");
    expect(result.phaseStartDate).toBe("2026-06-27");
    expect(result.consecutiveWrongToday).toBe(0);
    expect(result.consecutiveCorrect).toBe(0);
    expect(result.graduated).toBe(false);
    expect(result.totalEncounters).toBe(1);
    expect(result.appearancesToday).toBe(1);
    expect(result.lastSeenDate).toBe("2026-06-27");
    expect(result.dayOfPhase).toBe(8); // stale — callers must recompute via getDayOfPhase(result.phaseStartDate, today)
  });

  it("does not mutate the original record (immutability)", () => {
    const original = makeRecord({ consecutiveCorrect: 3 });
    const result = recordResult(original, true, "2026-06-27");
    expect(original.consecutiveCorrect).toBe(3);
    expect(result.consecutiveCorrect).toBe(4);
  });

  it("resets appearancesToday to 1 when lastSeenDate differs from today (date-reset path)", () => {
    // Card was seen yesterday with 2 appearances. Recording today's result should
    // treat appearances as 0 before incrementing to 1. Covers lines 78-79 ternary false branch.
    const record = makeRecord({ lastSeenDate: "2026-06-26", appearancesToday: 2 });
    const result = recordResult(record, true, "2026-06-27");
    expect(result.appearancesToday).toBe(1);
    expect(result.lastSeenDate).toBe("2026-06-27");
  });

  it("second consecutive wrong increments consecutiveWrongToday to 2 without triggering triple-wrong reset", () => {
    // Only 3rd wrong triggers Day 1 reset; 2nd wrong is an intermediate state.
    // dayOfPhase assertion removed (vacuous — recordResult never mutates dayOfPhase).
    const result = recordResult(makeRecord({ consecutiveWrongToday: 1, dayOfPhase: 8 }), false, "2026-06-27");
    expect(result.consecutiveWrongToday).toBe(2);
    expect(result.consecutiveCorrect).toBe(0);
    expect(result.phaseStartDate).toBe("2026-06-17"); // NOT reset — only 2nd wrong, not 3rd
  });

  it("cross-day wrong: 2 wrongs on a prior day do NOT count toward triple-wrong on a new day", () => {
    // consecutiveWrongToday=2 from yesterday; one wrong today should give consecutiveWrongToday=1
    // and must NOT trigger the triple-wrong Day 1 reset (cross-day carryover is the bug CF-02 fixes).
    const result = recordResult(
      makeRecord({ consecutiveWrongToday: 2, lastSeenDate: "2026-06-26", phaseStartDate: "2026-06-17" }),
      false,
      "2026-06-27",
    );
    expect(result.consecutiveWrongToday).toBe(1);
    expect(result.phaseStartDate).toBe("2026-06-17"); // NOT reset — cross-day carryover must not fire
    expect(result.consecutiveCorrect).toBe(0);
  });

  it("15th consecutive correct sets both consecutiveCorrect to 15 and graduated to true", () => {
    const result = recordResult(makeRecord({ consecutiveCorrect: 14 }), true, "2026-06-27");
    expect(result.consecutiveCorrect).toBe(15);
    expect(result.graduated).toBe(true);
  });
});

describe("getNextCardType", () => {
  it("returns the first available type when lastSeenType is null (deterministic: pool[0])", () => {
    // getNextCardType(null, ...) is fully deterministic — it always returns available[0].
    // A toContain assertion here would pass even if the implementation returned the wrong
    // element, since both candidates are in the array.
    expect(getNextCardType(null, ["recognize", "produce"])).toBe("recognize");
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

  it("throws when available is empty (line 120 guard — callers must not pass empty arrays)", () => {
    expect(() => getNextCardType(null, [])).toThrow("getNextCardType: available must not be empty");
  });
});
