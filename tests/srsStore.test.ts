import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { unitMasteryPct, levelMasteryPct, currentStudyLevel, MASTERY_GATE, MASTERY_STABILITY_DAYS, useSRSStore, localDateStr } from "@/store/srsStore";
import type { ActiveSession } from "@/store/srsStore";
import { isInDnd } from "@/store/settingsStore";
import { getTargetLangCode, setTargetLangCode, LANG_PAIR_KEY } from "@/lib/constants";
import type { Unit } from "@/content/types";
import { migrateSrsStore } from "@/store/migrations";
import { getDayOfPhase } from "@/lib/introduction";

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
  // Task #408: getTargetLangCode now persists a malformed-value repair via setTargetLangCode,
  // which calls window.localStorage.setItem — a get-only stub makes that call throw and log
  // a SECOND (unrelated) error, so the stub needs a working setItem like the real storage does.
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: (k: string, v: string) => { store.set(k, v); },
      },
    });
  });

  it("returns 'it' when localStorage has no lang pair", () => {
    expect(getTargetLangCode()).toBe("it");
  });

  it("returns 'es' for 'en-es'", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "en-es", setItem: () => {} } });
    expect(getTargetLangCode()).toBe("es");
  });

  it("returns 'it' when lang pair is malformed (no hyphen)", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "en", setItem: (k: string, v: string) => { store.set(k, v); } } });
    expect(getTargetLangCode()).toBe("it");
  });

  it("logs console.error when lang pair is malformed (no hyphen)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("window", { localStorage: { getItem: () => "nohyphen", setItem: (k: string, v: string) => { store.set(k, v); } } });
    getTargetLangCode();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]!).toMatch(/ERR-LANG-PAIR-MALFORMED/);
    errorSpy.mockRestore();
  });

  it("#408: persists the repair — a subsequent read sees the corrected value, not the original corrupt one", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (k === LANG_PAIR_KEY ? (store.get(k) ?? "nohyphen") : null),
        setItem: (k: string, v: string) => { store.set(k, v); },
      },
    });
    expect(getTargetLangCode()).toBe("it");
    expect(store.get(LANG_PAIR_KEY)).toBe("en-it");
  });

  it("returns 'it' when target segment after hyphen is empty string", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "en-", setItem: (k: string, v: string) => { store.set(k, v); } } });
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

// ── getNearDueCards — interrupt-floor fill source (Batch 23) ─────────────────

describe("getNearDueCards()", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
  });

  function card(id: string) {
    return { id, type: "recognize" as const, prompt: "t", accepted: ["t"], tags: [], tier: 1 as const };
  }
  function progress(cardId: string, dueDate: number, reps = 3) {
    return { cardId, state: "review" as const, stability: 5, difficulty: 5, retrievability: 0.9, dueDate, lapses: 0, reps };
  }

  it("returns studied not-yet-due cards ordered soonest-due first, respecting the limit", () => {
    const now = Date.now();
    useSRSStore.setState({
      cards: {
        far: progress("far", now + 3 * 86400000),
        soon: progress("soon", now + 1 * 86400000),
        mid: progress("mid", now + 2 * 86400000),
      },
    });
    const unitCards = [card("far"), card("soon"), card("mid")];
    expect(useSRSStore.getState().getNearDueCards(unitCards, 2).map((c) => c.id)).toEqual(["soon", "mid"]);
  });

  it("excludes cards that are already due (they belong to getDueCards) and untouched cards (reps 0 / no progress)", () => {
    const now = Date.now();
    useSRSStore.setState({
      cards: {
        due: progress("due", now - 1000),
        future: progress("future", now + 86400000),
        zeroReps: progress("zeroReps", now + 86400000, 0),
      },
    });
    const unitCards = [card("due"), card("future"), card("zeroReps"), card("untouched")];
    expect(useSRSStore.getState().getNearDueCards(unitCards, 10).map((c) => c.id)).toEqual(["future"]);
  });
});

// ── getNewCards — prerequisite logic tests (#023) ────────────────────────────

describe("getNewCards() — prerequisite logic", () => {
  beforeEach(() => {
    // Task #572: getNewCards (Task #567) also filters on `introductions` — reset it
    // alongside `cards` so this describe's exact-count assertions can't be poisoned by
    // introductions state a differently-ordered test run leaves behind.
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
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

  // Task #589: getNewCards' introductions filter (Task #567, store/srsStore.ts:227) had zero
  // direct or regression test coverage anywhere in the repo — every existing test in this
  // describe block exercises only the prerequisite/progress filters, never the introductions
  // one. Deletion Test: removing the `.filter((card) => !introMap[card.id])` line makes this
  // test fail (manually verified — see completion.md for the exact revert/restore steps).
  it("excludes a card with an existing IntroductionRecord, even though it has no progress and no prerequisites (Task #567)", () => {
    const midPhase = makeCard("mid-phase", 1); // no prerequisites — would otherwise qualify
    const untouched = makeCard("untouched", 1);
    useSRSStore.setState({
      introductions: {
        "mid-phase": {
          cardId: "mid-phase",
          introducedDate: "2026-08-01",
          phaseStartDate: "2026-08-01",
          dayOfPhase: 3,
          consecutiveCorrect: 2,
          totalEncounters: 4,
          lastSeenDate: "2026-08-10",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    });
    const result = useSRSStore.getState().getNewCards([midPhase, untouched]);
    expect(result.map((c) => c.id)).toEqual(["untouched"]);
  });

  it("respects the limit parameter — returns exactly limit cards when more candidates qualify", () => {
    const cards = [
      makeCard("c1", 1),
      makeCard("c2", 1),
      makeCard("c3", 1),
      makeCard("c4", 1),
      makeCard("c5", 1),
    ];
    const result = useSRSStore.getState().getNewCards(cards, 3);
    // Task #572: toBeLessThanOrEqual(3) would still pass if the slice were broken and
    // returned 0 or 1 cards — the Deletion Test failure this finding named. All 5 fixture
    // cards have no progress, no introductions record, and no prerequisites, so all 5
    // qualify before the limit=3 slice; exactly 3 (the first 3 in tier-then-original
    // order) must come back.
    expect(result.length).toBe(3);
    expect(result.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
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

  // Interrupt-floor flex fallback (BRAND.md: 6-10 interrupts/day, never fewer) — maxPerDay
  // lets a caller introduce more than the normal 1/day when the day's other content is empty.
  it("canIntroduceNewCard(today, maxPerDay) returns true past the default cap when maxPerDay allows it", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-24")).toBe(false); // default cap=1, already used
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-24", 2)).toBe(true); // flexed to 2
  });

  it("canIntroduceNewCard(today, maxPerDay) still blocks once maxPerDay itself is reached", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    useSRSStore.getState().introduceCard("card-2", "2026-06-24");
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-24", 2)).toBe(false);
  });

  it("canIntroduceNewCard(today, maxPerDay) still respects the strandedAcrossDays pause regardless of maxPerDay", () => {
    useSRSStore.getState().introduceCard("stranded-flex", "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-flex", false, "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-flex", false, "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-flex", false, "2026-06-24");
    expect(useSRSStore.getState().introductions["stranded-flex"]?.strandedAcrossDays).toBe(true);
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-25", 10)).toBe(false);
  });

  it("getIntroductionDueCardIds excludes graduated cards", () => {
    useSRSStore.getState().introduceCard("card-1", "2026-06-24");
    for (let i = 0; i < 15; i++) {
      useSRSStore.getState().recordIntroductionResult("card-1", true, "2026-06-24");
    }
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-24");
    expect(due).not.toContain("card-1");
  });

  // F10 — cross-day stranded: canIntroduceNewCard uses strandedAcrossDays (set by triple-wrong,
  // cleared by correct) instead of the unreachable consecutiveWrongToday-at-threshold state.
  // This is a seam test: drives through introduceCard and recordIntroductionResult end-to-end
  // rather than injecting the unreachable state directly via setState.
  it("F10 seam: triple-wrong sets strandedAcrossDays, blocking canIntroduceNewCard on subsequent days until a correct answer clears it", () => {
    useSRSStore.getState().introduceCard("stranded-card", "2026-06-24");
    // Triple wrong on day 1 → triggers triple-wrong reset, sets strandedAcrossDays: true
    useSRSStore.getState().recordIntroductionResult("stranded-card", false, "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-card", false, "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-card", false, "2026-06-24");

    const afterReset = useSRSStore.getState().introductions["stranded-card"];
    expect(afterReset?.strandedAcrossDays).toBe(true);

    // Day 2: card is stranded AND lastSeenDate ("2026-06-24") !== today ("2026-06-25") → block
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-25")).toBe(false);

    // Correct answer on day 2 → clears strandedAcrossDays
    useSRSStore.getState().recordIntroductionResult("stranded-card", true, "2026-06-25");

    // Day 3: strandedAcrossDays cleared → must unblock even though lastSeenDate !== today
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-26")).toBe(true);
  });

  // #246 — same-day wrong review must NOT lift the strandedAcrossDays pause
  it("#246: a same-day WRONG answer does not unblock canIntroduceNewCard — only a correct answer does", () => {
    useSRSStore.getState().introduceCard("stranded-card2", "2026-06-24");
    // Triple wrong on day 1 → strandedAcrossDays: true
    useSRSStore.getState().recordIntroductionResult("stranded-card2", false, "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-card2", false, "2026-06-24");
    useSRSStore.getState().recordIntroductionResult("stranded-card2", false, "2026-06-24");

    // Blocked on day 2 before any review
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-25")).toBe(false);

    // One WRONG answer on day 2 — updates lastSeenDate to "2026-06-25" but must NOT clear strandedAcrossDays
    useSRSStore.getState().recordIntroductionResult("stranded-card2", false, "2026-06-25");

    const afterWrong = useSRSStore.getState().introductions["stranded-card2"];
    expect(afterWrong?.strandedAcrossDays).toBe(true); // still stranded
    expect(afterWrong?.lastSeenDate).toBe("2026-06-25"); // lastSeenDate advanced...

    // ...but the pause must still apply — old guard would have lifted it here (bug)
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-25")).toBe(false);

    // Must remain blocked on day 3 as well (no correct answer has occurred)
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-26")).toBe(false);
  });

  // Task #254/#258 — stranded card with corrupt phaseStartDate full self-heal path
  // A record with strandedAcrossDays:true AND a calendar-invalid phaseStartDate was permanently
  // stuck: the corrupt-date catch path returned early without calling recordResult. Task #254
  // fixed the strandedAcrossDays block; Task #258 also repairs phaseStartDate so the card
  // rejoins getIntroductionDueCardIds at Day-1 intensity rather than remaining orphaned.
  // A wrong answer must NOT repair or clear either field.
  it("#254/#258: correct answer on a corrupt-phaseStartDate record clears strandedAcrossDays AND repairs phaseStartDate to today, allowing the card to rejoin the due queue", () => {
    useSRSStore.setState({
      introductions: {
        "corrupt-stranded": {
          cardId: "corrupt-stranded",
          introducedDate: "2026-06-01",
          phaseStartDate: "not-a-date", // calendar-invalid — getDayOfPhase throws
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 5,
          lastSeenDate: "2026-06-24",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
          strandedAcrossDays: true, // permanently blocked without Task #254 fix
        },
      },
    });

    // Verify pre-condition: canIntroduceNewCard is blocked
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-25")).toBe(false);

    // Correct answer — clears strandedAcrossDays AND repairs phaseStartDate
    useSRSStore.getState().recordIntroductionResult("corrupt-stranded", true, "2026-06-25");

    const after = useSRSStore.getState().introductions["corrupt-stranded"];
    // strandedAcrossDays cleared — canIntroduceNewCard unblocked
    expect(after?.strandedAcrossDays).toBe(false);
    // phaseStartDate repaired to today — card can now rejoin getIntroductionDueCardIds
    expect(after?.phaseStartDate).toBe("2026-06-25");

    // canIntroduceNewCard must now be unblocked (Task #254 assertion)
    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-26")).toBe(true);

    // Card must now appear in getIntroductionDueCardIds (Task #258 assertion)
    // phaseStartDate = "2026-06-25", today = "2026-06-25" → dayOfPhase=1 → Infinity cap → appears
    const due = useSRSStore.getState().getIntroductionDueCardIds("2026-06-25");
    expect(due).toContain("corrupt-stranded");
  });

  it("#254: wrong answer does NOT clear strandedAcrossDays when phaseStartDate is corrupt (correct answer required)", () => {
    useSRSStore.setState({
      introductions: {
        "corrupt-stranded-wrong": {
          cardId: "corrupt-stranded-wrong",
          introducedDate: "2026-06-01",
          phaseStartDate: "not-a-date", // calendar-invalid
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 5,
          lastSeenDate: "2026-06-24",
          appearancesToday: 1,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
          strandedAcrossDays: true,
        },
      },
    });

    // Wrong answer — must NOT clear strandedAcrossDays
    useSRSStore.getState().recordIntroductionResult("corrupt-stranded-wrong", false, "2026-06-25");

    const after = useSRSStore.getState().introductions["corrupt-stranded-wrong"];
    expect(after?.strandedAcrossDays).toBe(true); // still stranded

    expect(useSRSStore.getState().canIntroduceNewCard("2026-06-26")).toBe(false); // still blocked
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

  // #234 — getIntroductionDueCardIds must not propagate getDayOfPhase throws for corrupt records
  it("#234: getIntroductionDueCardIds skips a corrupt-phaseStartDate record without throwing, still returns valid cards", () => {
    useSRSStore.setState({
      introductions: {
        "valid-card": {
          cardId: "valid-card",
          introducedDate: "2026-07-01",
          phaseStartDate: "2026-07-01",
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 0,
          lastSeenDate: "2026-07-01",
          appearancesToday: 0,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
        "corrupt-card": {
          cardId: "corrupt-card",
          introducedDate: "2026-07-01",
          phaseStartDate: "2026-02-30", // calendar-invalid — getDayOfPhase will throw
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 0,
          lastSeenDate: "2026-07-01",
          appearancesToday: 0,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    });
    let due: string[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => {
        due = useSRSStore.getState().getIntroductionDueCardIds("2026-07-01");
      }).not.toThrow();
      expect(due).toContain("valid-card");
      expect(due).not.toContain("corrupt-card");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/ERR-INTRO-DUE-corrupt-card/), expect.anything());
    } finally {
      errorSpy.mockRestore();
    }
  });

  // #247/#258 — recordIntroductionResult must not throw on a corrupt phaseStartDate; a correct
  // answer repairs phaseStartDate to `today` (Task #258) while consecutiveCorrect is untouched
  // (crediting the graduation counter itself is separately tracked, accepted debt).
  it("#247/#258: recordIntroductionResult repairs phaseStartDate to today on a correct answer against a corrupt record — consecutiveCorrect is not credited", () => {
    useSRSStore.setState({
      introductions: {
        "corrupt-result-card": {
          cardId: "corrupt-result-card",
          introducedDate: "2026-07-01",
          phaseStartDate: "2026-02-30", // calendar-invalid — getDayOfPhase will throw
          dayOfPhase: 1,
          consecutiveCorrect: 5,
          totalEncounters: 10,
          lastSeenDate: "2026-07-01",
          appearancesToday: 2,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        },
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => {
        useSRSStore.getState().recordIntroductionResult("corrupt-result-card", true, "2026-07-08");
      }).not.toThrow();
      const rec = useSRSStore.getState().introductions["corrupt-result-card"];
      expect(rec?.consecutiveCorrect).toBe(5);
      // B7: a regression that hoists the repair to run unconditionally, or drops it entirely,
      // would leave phaseStartDate at "2026-02-30" — the field the old test title claimed was
      // "skipped" but never actually asserted.
      expect(rec?.phaseStartDate).toBe("2026-07-08");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/ERR-INTRO-RESULT-corrupt-result-card/), expect.anything());
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// ── Cross-module tests: migration date guards & getDayOfPhase calendar validation ───────────────

describe("migrateSrsStore — #232 day-of-month rollover guard", () => {
  it("v2 → v3: phaseStartDate '2026-02-30' falls back to today (JS silently normalises Feb-30 to Mar-2)", () => {
    const state = {
      cards: {}, streak: 0, lastStudiedDate: null, activeSession: null,
      introductions: {
        "card-rollover": {
          cardId: "card-rollover",
          introducedDate: "2026-02-28",
          phaseStartDate: "2026-02-30", // day-of-month rollover — JS normalises to 2026-03-02
          dayOfPhase: 1, consecutiveCorrect: 0, totalEncounters: 1,
          lastSeenDate: "2026-02-28", appearancesToday: 1,
          consecutiveWrongToday: 0, lastSeenType: null, graduated: false,
        },
      },
    };
    const result = migrateSrsStore(state, 2) as { introductions: Record<string, { phaseStartDate: string }> };
    const intro = result.introductions["card-rollover"];
    // Must NOT preserve the rolled-over string or the silently-normalised downstream value
    expect(intro?.phaseStartDate).not.toBe("2026-02-30");
    expect(intro?.phaseStartDate).not.toBe("2026-03-02");
    // Must fall back to a valid YYYY-MM-DD date (today)
    expect(/^\d{4}-\d{2}-\d{2}$/.test(intro?.phaseStartDate ?? "")).toBe(true);
    expect(isNaN(new Date(intro?.phaseStartDate ?? "").getTime())).toBe(false);
  });
});

describe("migrateSrsStore — #233 null-record complete default", () => {
  it("v2 → v3: null introduction record is recovered with all required fields so recordResult doesn't NaN", () => {
    const state = {
      cards: {}, streak: 0, lastStudiedDate: null, activeSession: null,
      introductions: { "null-card": null },
    };
    const result = migrateSrsStore(state, 2) as { introductions: Record<string, Record<string, unknown>> };
    const intro = result.introductions["null-card"];
    expect(typeof intro?.totalEncounters).toBe("number");
    expect(typeof intro?.consecutiveCorrect).toBe("number");
    expect(typeof intro?.appearancesToday).toBe("number");
    expect(typeof intro?.consecutiveWrongToday).toBe("number");
    expect(intro?.graduated).toBe(false);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(String(intro?.phaseStartDate ?? ""))).toBe(true);
    // Verify totalEncounters is a real number (not NaN from undefined + 1)
    const n = intro?.totalEncounters as number;
    expect(isNaN(n)).toBe(false);
    expect(n).toBe(0); // null-record default sets totalEncounters to 0; NaN would make this fail
  });
});

describe("getDayOfPhase — #231 calendar-invalid date detection", () => {
  it("throws [ERR-INTRO-DATE] on month-overflow date '2026-13-45' (passes DATE_RE but isNaN catches it)", () => {
    expect(() => getDayOfPhase("2026-13-45", "2026-07-07")).toThrow("[ERR-INTRO-DATE]");
  });

  it("throws [ERR-INTRO-DATE] on day-of-month rollover '2026-02-30' (passes isNaN but round-trip check catches it)", () => {
    expect(() => getDayOfPhase("2026-02-30", "2026-07-07")).toThrow("[ERR-INTRO-DATE]");
  });

  it("throws [ERR-INTRO-DATE] when today is a day-of-month rollover '2026-02-30'", () => {
    expect(() => getDayOfPhase("2026-07-01", "2026-02-30")).toThrow("[ERR-INTRO-DATE]");
  });
});

// ── peekResumableSession / clearExpiredResumableSession — Task #597 ──────────
// getResumableSession (tests/session.test.ts, not touched here) mutates store state as a side
// effect during what its name presents as a pure getter — unsafe during React's render phase.
// These two are the render-safe split: a pure read + a separate explicit clear action.
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

function makeActiveSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    unitId: "a1-unit-01",
    queueIds: ["c1", "c2", "c3"],
    position: 0,
    sessionCorrect: 0,
    sessionTotal: 0,
    startedAt: Date.now(),
    ...overrides,
  };
}

describe("peekResumableSession — pure read, no mutation (Task #597)", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
  });

  it("returns null when there is no active session", () => {
    expect(useSRSStore.getState().peekResumableSession()).toBeNull();
  });

  it("returns the session unmodified when it has not expired", () => {
    const session = makeActiveSession({ position: 2 });
    useSRSStore.setState({ activeSession: session });
    expect(useSRSStore.getState().peekResumableSession()).toEqual(session);
  });

  it("returns null for an expired session but does NOT clear it from state — the defining difference from getResumableSession", () => {
    const expired = makeActiveSession({ startedAt: Date.now() - SESSION_EXPIRY_MS - 1000 });
    useSRSStore.setState({ activeSession: expired });

    expect(useSRSStore.getState().peekResumableSession()).toBeNull();
    // Deletion Test: if peekResumableSession were implemented by delegating to
    // getResumableSession (reintroducing the mutation this split exists to avoid), this
    // assertion fails — activeSession would be null here instead of the original session.
    expect(useSRSStore.getState().activeSession).toEqual(expired);
  });

  it("calling it repeatedly never changes store state, even across multiple calls on an expired session", () => {
    const expired = makeActiveSession({ startedAt: Date.now() - SESSION_EXPIRY_MS - 1000 });
    useSRSStore.setState({ activeSession: expired });

    useSRSStore.getState().peekResumableSession();
    useSRSStore.getState().peekResumableSession();
    useSRSStore.getState().peekResumableSession();

    expect(useSRSStore.getState().activeSession).toEqual(expired);
  });
});

describe("clearExpiredResumableSession — explicit purge action (Task #597)", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
  });

  it("is a no-op when there is no active session", () => {
    useSRSStore.getState().clearExpiredResumableSession();
    expect(useSRSStore.getState().activeSession).toBeNull();
  });

  it("does NOT clear a session that has not expired", () => {
    const session = makeActiveSession();
    useSRSStore.setState({ activeSession: session });
    useSRSStore.getState().clearExpiredResumableSession();
    expect(useSRSStore.getState().activeSession).toEqual(session);
  });

  it("clears a session that has expired", () => {
    const expired = makeActiveSession({ startedAt: Date.now() - SESSION_EXPIRY_MS - 1000 });
    useSRSStore.setState({ activeSession: expired });
    useSRSStore.getState().clearExpiredResumableSession();
    expect(useSRSStore.getState().activeSession).toBeNull();
  });
});
