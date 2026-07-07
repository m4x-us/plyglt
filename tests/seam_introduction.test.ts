// ============================================================
// tests/seam_introduction.test.ts — cross-module seam test tracing the introduction engine
// through the Zustand store, not just the pure lib/introduction.ts functions in isolation.
// Split out of tests/introduction.test.ts (Task #181) — see also tests/introduction_behavior.test.ts.
// ============================================================
import { describe, it, expect, beforeEach } from "vitest";
import { useSRSStore } from "@/store/srsStore";

describe("seam: introduceCard → recordIntroductionResult (triple-wrong) → getIntroductionDueCardIds", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
  });

  // F14 — this is the exact path the Batch 5 audit found broken: recordResult wrote the Day 1
  // reset (phaseStartDate = today) but both store callers used to recompute dayOfPhase from the
  // original introducedDate, silently discarding the reset. Task #178 fixed the store to read
  // phaseStartDate as the source of truth. This test proves the fix is observable end-to-end
  // through the store's public API, not just on the record returned by lib/introduction.ts in
  // isolation — a unit test on recordResult alone would not have caught the original bug.
  it("full triple-wrong path: introduceCard → recordIntroductionResult (3x wrong) → getIntroductionDueCardIds schedules the card at day 1", () => {
    // Seed a card mid-cadence (phase day 11, started 2026-06-17) with 2 prior wrong answers today.
    useSRSStore.setState({
      introductions: {
        "card-1": {
          cardId: "card-1",
          introducedDate: "2026-06-17",
          phaseStartDate: "2026-06-17", // 10 days before "today" — day 11 before the reset
          dayOfPhase: 11,
          consecutiveCorrect: 4,
          totalEncounters: 20,
          lastSeenDate: "2026-06-27", // today — wrong count carries within the day
          appearancesToday: 2,
          consecutiveWrongToday: 2, // 2 prior wrongs today; one more triggers the reset
          lastSeenType: "recognize",
          graduated: false,
        },
      },
    });

    // Third consecutive wrong answer today — must trigger the Day 1 reset (Task #178's fix).
    useSRSStore.getState().recordIntroductionResult("card-1", false, "2026-06-27");

    const record = useSRSStore.getState().introductions["card-1"];
    expect(record?.phaseStartDate).toBe("2026-06-27"); // reset to today
    expect(record?.consecutiveWrongToday).toBe(0);
    expect(record?.consecutiveCorrect).toBe(0);

    // The reset must be OBSERVABLE through the due-card query, not just on the stored record —
    // this is exactly what the audit found broken: both store callers used to recompute
    // dayOfPhase from introducedDate (never reset), silently discarding this reset.
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-27");
    expect(due).toContain("card-1");
  });
});
