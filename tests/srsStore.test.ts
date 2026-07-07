import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { unitMasteryPct, levelMasteryPct, currentStudyLevel, MASTERY_GATE, MASTERY_STABILITY_DAYS, useSRSStore, localDateStr } from "@/store/srsStore";
import type { ActiveSession } from "@/store/srsStore";
import { isInDnd } from "@/store/settingsStore";
import { getTargetLangCode, setTargetLangCode, LANG_PAIR_KEY } from "@/lib/constants";
import type { Unit } from "@/content/types";

function makeUnit(cardIds: string[]): Unit {
  return {
    id: "u1",
    name: "Test",
    level: "A1",
    theme: "test",
    emoji: "🧪",
    prerequisiteUnits: [],
    cards: cardIds.map((id) => ({
      id,
      type: "produce",
      prompt: "t",
      accepted: ["t"],
      tags: [],
      tier: 1,
    })),
  };
}

function mastered(id: string) {
  return {
    cardId: id,
    state: "review" as const,
    stability: MASTERY_STABILITY_DAYS + 1,
    difficulty: 5,
    retrievability: 0.9,
    dueDate: Date.now() + 86400000,
    lapses: 0,
    reps: 3,
  };
}

describe("srsStore — import graph (Rule 3: no upward imports)", () => {
  it("store/srsStore.ts must not import from the hooks/ directory", () => {
    const content = readFileSync(resolve(process.cwd(), "store/srsStore.ts"), "utf-8");
    expect(content).not.toMatch(/from "@\/hooks\//);
  });
});

describe("unitMasteryPct", () => {
  it("returns 0 for a unit with no progress", () => {
    expect(unitMasteryPct(makeUnit(["c1", "c2"]), {})).toBe(0);
  });

  it("returns 100 when all cards are mastered", () => {
    const unit = makeUnit(["c1", "c2"]);
    expect(unitMasteryPct(unit, { c1: mastered("c1"), c2: mastered("c2") })).toBe(100);
  });

  it("returns 80 for 4 out of 5 mastered", () => {
    const unit = makeUnit(["c1", "c2", "c3", "c4", "c5"]);
    const map = Object.fromEntries(["c1", "c2", "c3", "c4"].map((id) => [id, mastered(id)]));
    const pct = unitMasteryPct(unit, map);
    expect(pct).toBe(80);
    expect(pct).toBeGreaterThanOrEqual(MASTERY_GATE);
  });

  it("returns 0 for a unit with zero cards without dividing by zero", () => {
    expect(unitMasteryPct(makeUnit([]), {})).toBe(0);
  });
});

describe("isInDnd", () => {
  it("returns true when current time is within a same-day DND window", () => {
    const noon = new Date("2026-01-01T12:00:00");
    expect(isInDnd("10:00", "14:00", noon)).toBe(true);
  });

  it("returns false when current time is outside a same-day DND window", () => {
    const eight_am = new Date("2026-01-01T08:00:00");
    expect(isInDnd("10:00", "14:00", eight_am)).toBe(false);
  });

  it("returns true during an overnight window (22:00–08:00) at midnight", () => {
    const midnight = new Date("2026-01-01T00:00:00");
    expect(isInDnd("22:00", "08:00", midnight)).toBe(true);
  });

  it("returns true during an overnight window at 23:00", () => {
    expect(isInDnd("22:00", "08:00", new Date("2026-01-01T23:00:00"))).toBe(true);
  });

  it("returns false during an overnight window at noon", () => {
    expect(isInDnd("22:00", "08:00", new Date("2026-01-01T12:00:00"))).toBe(false);
  });
});

describe("touchStreak — DST-safe local date arithmetic", () => {
  beforeEach(() => {
    useSRSStore.setState({ streak: 1, lastStudiedDate: null, cards: {}, activeSession: null });
  });

  it("increments streak when last studied yesterday", () => {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    useSRSStore.setState({ streak: 5, lastStudiedDate: localDateStr(yd) });
    useSRSStore.getState().touchStreak();
    expect(useSRSStore.getState().streak).toBe(6);
  });

  it("resets streak to 1 when gap is more than one day", () => {
    useSRSStore.setState({ streak: 10, lastStudiedDate: "2020-01-01" });
    useSRSStore.getState().touchStreak();
    expect(useSRSStore.getState().streak).toBe(1);
  });

  it("does not change streak when called twice on the same day", () => {
    useSRSStore.getState().touchStreak();
    const after1 = useSRSStore.getState().streak;
    useSRSStore.getState().touchStreak();
    expect(useSRSStore.getState().streak).toBe(after1);
  });

  it("sets lastStudiedDate to today in YYYY-MM-DD local format", () => {
    useSRSStore.getState().touchStreak();
    const today = localDateStr();
    expect(useSRSStore.getState().lastStudiedDate).toBe(today);
  });
});

describe("localDateStr", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(localDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the local calendar date, not UTC", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(localDateStr(d)).toBe(expected);
  });

  it("yesterday via setDate is one day before today", () => {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const today = localDateStr();
    const yesterday = localDateStr(yd);
    expect(yesterday < today).toBe(true);
    // They differ by exactly one calendar day (last char sequence)
    expect(yesterday).not.toBe(today);
  });
});

describe("getTargetLangCode", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
  });

  it("returns 'it' when localStorage has no lang pair", () => {
    expect(getTargetLangCode()).toBe("it");
  });

  it("returns 'es' for 'en-es'", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "en-es" } });
    expect(getTargetLangCode()).toBe("es");
  });

  it("returns 'it' when lang pair is malformed (no hyphen)", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "en" } });
    expect(getTargetLangCode()).toBe("it");
  });

  it("returns 'it' when target segment after hyphen is empty string", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "en-" } });
    expect(getTargetLangCode()).toBe("it");
  });
});

describe("lib/constants — setTargetLangCode", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
      },
    });
  });

  it("writes 'en-fr' under LANG_PAIR_KEY when targetLang is 'fr'", () => {
    setTargetLangCode("fr");
    expect(store.get(LANG_PAIR_KEY)).toBe("en-fr");
  });

  it("writes 'en-it' under LANG_PAIR_KEY when targetLang is 'it'", () => {
    setTargetLangCode("it");
    expect(store.get(LANG_PAIR_KEY)).toBe("en-it");
  });

  it("round-trip: setTargetLangCode then getTargetLangCode returns same code", () => {
    setTargetLangCode("fr");
    expect(getTargetLangCode()).toBe("fr");
  });

  it("does not throw when window is undefined (SSR guard)", () => {
    vi.unstubAllGlobals();
    expect(() => setTargetLangCode("it")).not.toThrow();
  });
});

describe("lib/constants — import-graph seam (static USED BY list must be replaced)", () => {
  it("lib/constants.ts must not contain a static 'USED BY: store/srsStore' importer list", () => {
    const content = readFileSync(resolve(process.cwd(), "lib/constants.ts"), "utf-8");
    expect(content).not.toContain("USED BY: store/srsStore");
  });
});

// ── getNewCards — prerequisite logic tests (#023) ────────────────────────────

describe("getNewCards() — prerequisite logic", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
  });

  function makeCard(
    id: string,
    tier: 1 | 2 | 3 | 4,
    prerequisites: string[] = [],
  ) {
    return { id, type: "recognize" as const, prompt: "t", accepted: ["t"], tags: [], tier, prerequisites };
  }

  it("card with no prerequisites is returned by getNewCards", () => {
    const cards = [makeCard("c1", 1)];
    const result = useSRSStore.getState().getNewCards(cards);
    expect(result.map((c) => c.id)).toContain("c1");
  });

  it("card whose prerequisite is in state 'new' (no progress) is NOT returned", () => {
    // "c2" requires "c1"; "c1" has no progress (state "new" / missing from map)
    const cards = [makeCard("c1", 1), makeCard("c2", 2, ["c1"])];
    const result = useSRSStore.getState().getNewCards(cards);
    expect(result.map((c) => c.id)).not.toContain("c2");
    expect(result.map((c) => c.id)).toContain("c1");
  });

  it("card whose prerequisite is in state 'review' IS returned", () => {
    // Seed c1 as review — prerequisite met for c2
    useSRSStore.setState({
      cards: {
        c1: {
          cardId: "c1",
          state: "review",
          stability: 5,
          difficulty: 5,
          retrievability: 0.9,
          dueDate: Date.now() + 86400000,
          lapses: 0,
          reps: 3,
        },
      },
    });
    const cards = [makeCard("c1", 1), makeCard("c2", 2, ["c1"])];
    // c1 already has progress (reps > 0) so not returned as "new"; c2 is gated
    const result = useSRSStore.getState().getNewCards(cards);
    expect(result.map((c) => c.id)).toContain("c2");
  });

  it("respects the limit parameter — never returns more than limit cards", () => {
    const cards = [
      makeCard("c1", 1),
      makeCard("c2", 1),
      makeCard("c3", 1),
      makeCard("c4", 1),
      makeCard("c5", 1),
    ];
    const result = useSRSStore.getState().getNewCards(cards, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns cards sorted by tier — tier 1 before tier 2", () => {
    const cards = [
      makeCard("t2a", 2),
      makeCard("t1a", 1),
      makeCard("t2b", 2),
      makeCard("t1b", 1),
    ];
    const result = useSRSStore.getState().getNewCards(cards);
    const tiers = result.map((c) => c.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });
});

describe("levelMasteryPct", () => {
  it("returns 0 for an empty units array without dividing by zero", () => {
    expect(levelMasteryPct([], {})).toBe(0);
  });

  it("returns 0 when no cards are mastered", () => {
    const unit = makeUnit(["c1", "c2"]);
    expect(levelMasteryPct([unit], {})).toBe(0);
  });

  it("returns 50 when half of one unit's cards are mastered", () => {
    const unit = makeUnit(["c1", "c2"]);
    expect(levelMasteryPct([unit], { c1: mastered("c1") })).toBe(50);
  });

  it("aggregates mastery across multiple units", () => {
    const u1 = makeUnit(["a1", "a2"]);
    const u2 = makeUnit(["b1", "b2"]);
    const prog = { a1: mastered("a1"), b1: mastered("b1") };
    // 2 mastered out of 4 total = 50%
    expect(levelMasteryPct([u1, u2], prog)).toBe(50);
  });

  it("returns 100 when all cards across all units are mastered", () => {
    const u1 = makeUnit(["c1"]);
    const u2 = makeUnit(["c2"]);
    expect(levelMasteryPct([u1, u2], { c1: mastered("c1"), c2: mastered("c2") })).toBe(100);
  });
});

describe("currentStudyLevel", () => {
  it("returns the first level when masteryFn returns 0 for all levels", () => {
    expect(currentStudyLevel(["A1", "A2", "B1", "B2"], () => 0)).toBe("A1");
  });

  it("returns the highest level with progress > 0", () => {
    const pcts: Record<string, number> = { A1: 50, A2: 20, B1: 0, B2: 0 };
    expect(currentStudyLevel(["A1", "A2", "B1", "B2"], (lvl) => pcts[lvl] ?? 0)).toBe("A2");
  });

  it("returns the single level if there is only one", () => {
    expect(currentStudyLevel(["A1"], () => 0)).toBe("A1");
  });

  it("returns the last level when all levels have progress", () => {
    expect(currentStudyLevel(["A1", "A2", "B1", "B2"], () => 50)).toBe("B2");
  });
});

describe("rateCardAndSaveSession — atomic update", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, activeSession: null, streak: 0, lastStudiedDate: null });
  });

  it("updates both cards and activeSession in a single operation", () => {
    const session: ActiveSession = {
      unitId: "u1",
      queueIds: ["card-1"],
      position: 1,
      sessionCorrect: 1,
      sessionTotal: 1,
      startedAt: 1000000,
    };

    useSRSStore.getState().rateCardAndSaveSession("card-1", "good", session);

    const state = useSRSStore.getState();
    // Card must be scheduled — a fresh card ("new", reps=0) graded "good" graduates to
    // "review" with reps=1.
    const card1 = state.cards["card-1"];
    expect(card1?.state).toBe("review");
    expect(card1?.reps).toBe(1);
    // Session must match exactly what was passed
    expect(state.activeSession).toEqual(session);
    expect(state.activeSession?.position).toBe(1);
  });

  it("rateCardAndSaveSession with 'again' still persists session", () => {
    const session: ActiveSession = {
      unitId: "global",
      queueIds: ["card-2", "card-2"],
      position: 1,
      sessionCorrect: 0,
      sessionTotal: 1,
      startedAt: 1000000,
    };

    useSRSStore.getState().rateCardAndSaveSession("card-2", "again", session);

    const state = useSRSStore.getState();
    // A fresh card ("new", reps=0) graded "again" stays in "learning" with reps=1.
    expect(state.cards["card-2"]?.state).toBe("learning");
    expect(state.cards["card-2"]?.reps).toBe(1);
    expect(state.activeSession?.unitId).toBe("global");
  });
});

describe("srsStore — introduction engine actions", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
  });

  it("introduceCard creates a record with dayOfPhase 1, consecutiveCorrect 0, graduated false", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    const intro = useSRSStore.getState().introductions["card-1"];
    expect(intro?.dayOfPhase).toBe(1);
    expect(intro?.consecutiveCorrect).toBe(0);
    expect(intro?.graduated).toBe(false);
    expect(intro?.phaseStartDate).toBe("2026-06-24");
  });

  it("introduceCard is idempotent — second call does not reset an in-progress record", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    useSRSStore.getState().introduceCard("card-1", "2026-06-24"); // second call — must not reset
    expect(useSRSStore.getState().introductions["card-1"]?.consecutiveCorrect).toBe(1);
  });

  it("recordIntroductionResult increments consecutiveCorrect on a correct answer", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    expect(useSRSStore.getState().introductions["card-1"]?.consecutiveCorrect).toBe(1);
  });

  it("15 consecutive correct answers graduate the card", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    for (let i = 0; i < 15; i++) {
      useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    }
    expect(useSRSStore.getState().introductions["card-1"]?.graduated).toBe(true);
  });

  it("getIntroductionDueCardIds returns IDs of cards due today (shouldAppearToday === true)", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-24");
    expect(due).toContain("card-1");
  });

  it("canIntroduceNewCard returns false when a card was already introduced today", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-24")).toBe(false);
  });

  it("canIntroduceNewCard returns true when no card was introduced today", () => {
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-24")).toBe(true);
  });

  it("getIntroductionDueCardIds excludes graduated cards", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    for (let i = 0; i < 15; i++) {
      useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    }
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-24");
    expect(due).not.toContain("card-1");
  });

  // F03 — variety rule: lastSeenType must advance after each recordIntroductionResult call
  it("recordIntroductionResult updates lastSeenType to the next card type (variety rule)", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    expect(useSRSStore.getState().introductions["card-1"]?.lastSeenType).toBe(null);

    useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    // getNextCardType(null, ALL_CARD_TYPES): null branch → pool = all types → first = "recognize"
    expect(useSRSStore.getState().introductions["card-1"]?.lastSeenType).toBe("recognize");

    useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    // getNextCardType("recognize", ALL_CARD_TYPES): filters "recognize" → pool[0] = "produce"
    expect(useSRSStore.getState().introductions["card-1"]?.lastSeenType).toBe("produce");
  });

  // F10 — cross-day wrong streak: canIntroduceNewCard must block when a card is stuck wrong
  it("canIntroduceNewCard returns false when a card has a cross-day wrong streak at the reset threshold", () => {
    useSRSStore.setState({
      introductions: {
        "stuck-card": {
          cardId: "stuck-card",
          introducedDate: "2026-06-23",
          phaseStartDate: "2026-06-23",
          dayOfPhase: 2,
          consecutiveCorrect: 0,
          totalEncounters: 3,
          lastSeenDate: "2026-06-24",   // previous day — not today
          appearancesToday: 3,
          consecutiveWrongToday: 3,     // at the reset threshold
          lastSeenType: null,
          graduated: false,
        },
      },
    });
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-25")).toBe(false);
  });

  // F12 — rescue path: day-22+ non-graduated cards must appear once per day
  it("getIntroductionDueCardIds includes a day-22+ non-graduated card once per day (rescue path)", () => {
    // phaseStartDate 21 days before today → getDayOfPhase returns 22
    useSRSStore.setState({
      introductions: {
        "stranded-card": {
          cardId: "stranded-card",
          introducedDate: "2026-06-01",
          phaseStartDate: "2026-06-01",
          dayOfPhase: 22,
          consecutiveCorrect: 0,
          totalEncounters: 30,
          lastSeenDate: "2026-06-21",  // yesterday — not today, so no appearance cap yet
          appearancesToday: 0,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    });
    // getDayOfPhase("2026-06-01", "2026-06-22") = Math.min(21 + 1, 22) = 22 → rescue branch
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-22");
    expect(due).toContain("stranded-card");

    // After appearing once today, must NOT appear a second time
    useSRSStore.setState({
      introductions: {
        "stranded-card": {
          ...useSRSStore.getState().introductions["stranded-card"]!,
          lastSeenDate: "2026-06-22",
          appearancesToday: 1,
        },
      },
    });
    const dueAfter = useSRSStore.getState().getIntroductionDueCardIds("2026-06-22");
    expect(dueAfter).not.toContain("stranded-card");
  });

  // F13 — graduated card guard: introduceCard must not overwrite a graduated record
  it("introduceCard does not re-introduce a graduated card", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    for (let i = 0; i < 15; i++) {
      useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    }
    expect(useSRSStore.getState().introductions["card-1"]?.graduated).toBe(true);
    const graduatedRecord = useSRSStore.getState().introductions["card-1"];

    useSRSStore.getState().introduceCard("card-1", "2026-07-01"); // re-introduce attempt
    const after = useSRSStore.getState().introductions["card-1"];
    expect(after?.graduated).toBe(true);
    expect(after?.introducedDate).toBe(graduatedRecord?.introducedDate);
  });

  it("triple-wrong seam: recordIntroductionResult (3× wrong) resets phaseStartDate so getIntroductionDueCardIds returns day 1 scheduling", () => {
    // Introduce on 2026-06-01. On day 10 (2026-06-10), answer wrong 3 times.
    // Without phaseStartDate fix: getDayOfPhase(introducedDate, "2026-06-10") = 10.
    // With fix: phaseStartDate advances to "2026-06-10" → getDayOfPhase returns 1.
    useSRSStore.getState().introduceCard("card-seam", "2026-06-01");

    // Verify initial state
    const initial = useSRSStore.getState().introductions["card-seam"];
    expect(initial?.phaseStartDate).toBe("2026-06-01");

    // Three consecutive wrong answers on a later date
    useSRSStore.getState().recordIntroductionResult("card-seam", false, "2026-06-10");
    useSRSStore.getState().recordIntroductionResult("card-seam", false, "2026-06-10");
    useSRSStore.getState().recordIntroductionResult("card-seam", false, "2026-06-10");

    // phaseStartDate must have advanced to the reset date
    const after = useSRSStore.getState().introductions["card-seam"];
    expect(after?.phaseStartDate).toBe("2026-06-10");
    expect(after?.consecutiveWrongToday).toBe(0);  // reset cleared — required for Day 1 scheduling to work
    expect(after?.consecutiveCorrect).toBe(0);     // reset cleared

    // getIntroductionDueCardIds must return this card on "2026-06-10" (day 1 = Infinity cap)
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-10");
    expect(due).toContain("card-seam");
  });
});
