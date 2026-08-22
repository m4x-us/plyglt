import { describe, it, expect, vi } from "vitest";
import {
  buildQueue,
  findUnitName,
  INTERRUPT_FLEX_DAILY_MAX,
  INTERRUPT_SESSION_FLOOR,
  INTERRUPT_SESSION_CAP,
  INTERRUPT_SESSION_MAX_NEW,
  INTERRUPT_SESSION_GROWTH_CAP,
  shouldGrowInterruptSession,
  selectNextGrowthCard,
} from "@/lib/queue";
import type { Card, Unit } from "@/content/types";

function card(id: string): Card {
  return { id, type: "produce", prompt: "p", accepted: ["a"], tags: [], tier: 1 };
}

function unit(name: string, cardIds: string[]): Unit {
  return {
    id: "u",
    name,
    level: "A1",
    theme: "t",
    emoji: "🧪",
    prerequisiteUnits: [],
    cards: cardIds.map(card),
  };
}

describe("buildQueue", () => {
  it("returns empty array when no due or new cards", () => {
    expect(buildQueue([], () => [], () => [])).toHaveLength(0);
  });

  it("returns due cards only when no new cards exist", () => {
    const c1 = card("c1"), c2 = card("c2");
    const result = buildQueue([c1, c2], () => ["c1", "c2"], () => []);
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("in global mode, new cards are never fetched", () => {
    const newSpy = vi.fn().mockReturnValue([]);
    buildQueue([card("c1")], () => ["c1"], newSpy, true);
    expect(newSpy).not.toHaveBeenCalled();
  });

  it("interleaves 1 new card after every 3 due cards", () => {
    // 6 due + 2 new → [d1,d2,d3,n1,d4,d5,d6,n2]
    const due = ["d1", "d2", "d3", "d4", "d5", "d6"].map(card);
    const news = ["n1", "n2"].map(card);
    const result = buildQueue(
      [...due, ...news],
      () => due.map((c) => c.id),
      () => news
    );
    expect(result.map((c) => c.id)).toEqual(["d1", "d2", "d3", "n1", "d4", "d5", "d6", "n2"]);
  });

  it("appends remaining new cards after all due cards are exhausted", () => {
    // 1 due + 3 new → [d1,n1,n2,n3] (1%3≠0, so no mid-session interleave)
    const due = [card("d1")];
    const news = ["n1", "n2", "n3"].map(card);
    const result = buildQueue(
      [...due, ...news],
      () => ["d1"],
      () => news
    );
    expect(result.map((c) => c.id)).toEqual(["d1", "n1", "n2", "n3"]);
  });

  it("deduplicates a card that appears in both due and new — keeps first occurrence", () => {
    const c1 = card("c1"), c2 = card("c2");
    const result = buildQueue(
      [c1, c2],
      () => ["c1"],     // c1 is due
      () => [c1, c2]   // c1 also in new pool (edge case)
    );
    // c1 appears from due; duplicate c1 from new is dropped; c2 from new is kept
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("preserves the order returned by getDueCards", () => {
    const cards = ["c1", "c2", "c3"].map(card);
    const result = buildQueue(cards, () => ["c3", "c1", "c2"], () => []);
    expect(result.map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
  });

  // Task #585: a due id with no matching card in the loaded pack (stale FSRS reference,
  // or a store/pack mismatch) is dropped, but must leave a diagnostic trace rather than
  // vanishing silently — see lib/queue.ts's buildQueue.
  it("drops a due id with no matching card and logs a diagnostic warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c1 = card("c1");
    const result = buildQueue([c1], () => ["c1", "ghost-id"], () => []);
    expect(result.map((c) => c.id)).toEqual(["c1"]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-QUEUE-STALE-DUE-ID-\d+\] getDueCards returned id "ghost-id"/);
    warnSpy.mockRestore();
  });

  it("does not log anything when every due id resolves to a real card", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    buildQueue([card("c1")], () => ["c1"], () => []);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("buildQueue — introduction cards", () => {
  // Forward-typed cast for the optional 5th parameter added in Task #048.
  // Becomes redundant (not erroneous) once lib/queue.ts accepts the real signature.
  const buildQueueExt = buildQueue as unknown as (
    cards: Card[],
    getDueCards: (cards: Card[]) => string[],
    getNewCards: (cards: Card[], limit?: number) => Card[],
    globalMode?: boolean,
    getIntroductionDueCardIds?: (today: string) => string[],
  ) => Card[];

  it("includes introduction-phase cards even when they have no FSRS reps", () => {
    const intro = card("intro-1");
    const result = buildQueueExt(
      [intro],
      () => [],           // no FSRS due cards
      () => [],           // no new cards
      false,
      () => ["intro-1"],  // introduction engine says intro-1 is due today
    );
    expect(result.map((c) => c.id)).toContain("intro-1");
  });

  it("places introduction cards after due FSRS cards but before new cards", () => {
    const due = card("due-1");
    const intro = card("intro-1");
    const newCard = card("new-1");
    const result = buildQueueExt(
      [due, intro, newCard],
      () => ["due-1"],
      () => [newCard],
      false,
      () => ["intro-1"],
    );
    const ids = result.map((c) => c.id);
    expect(ids.indexOf("due-1")).toBeLessThan(ids.indexOf("intro-1"));
    expect(ids.indexOf("intro-1")).toBeLessThan(ids.indexOf("new-1"));
  });

  it("a card excluded from getIntroductionDueCardIds still appears if it is FSRS-due; intro-only cards also appear", () => {
    const fsrsDue = card("fsrs-1");
    const introCard = card("intro-1");
    const result = buildQueueExt(
      [fsrsDue, introCard],
      () => ["fsrs-1"],    // fsrs-1 is due via FSRS
      () => [],
      false,
      () => ["intro-1"],   // intro-1 is due via introduction engine only
    );
    const ids = result.map((c) => c.id);
    expect(ids).toContain("fsrs-1");    // via FSRS
    expect(ids).toContain("intro-1");   // via introduction engine
  });

  it("globalMode includes introduction cards while still excluding new cards", () => {
    const newSpy = vi.fn().mockReturnValue([]);
    const intro = card("intro-1");
    const result = buildQueueExt(
      [intro, card("new-1")],
      () => [],
      newSpy,
      true,               // globalMode
      () => ["intro-1"],
    );
    expect(newSpy).not.toHaveBeenCalled();
    expect(result.map((c) => c.id)).toContain("intro-1");
  });

  // Task #585: same diagnostic-trace requirement as the due-id case above, for the
  // introduction-engine lookup path.
  it("drops an introduction id with no matching card and logs a diagnostic warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const intro = card("intro-1");
    const result = buildQueueExt(
      [intro],
      () => [],
      () => [],
      false,
      () => ["intro-1", "ghost-intro-id"],
    );
    expect(result.map((c) => c.id)).toEqual(["intro-1"]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-QUEUE-STALE-INTRO-ID-\d+\] getIntroductionDueCardIds returned id "ghost-intro-id"/);
    warnSpy.mockRestore();
  });
});

describe("findUnitName", () => {
  it("returns the unit name for a card that exists in a unit", () => {
    const units = [unit("Greetings", ["c1", "c2"])];
    expect(findUnitName("c1", units)).toBe("Greetings");
  });

  it("returns empty string for an unrecognised card ID", () => {
    expect(findUnitName("unknown", [])).toBe("");
  });
});

// Task #579: docs/INTERRUPT_ARCHITECTURE.md §10.1 documents INTERRUPT_FLEX_DAILY_MAX as
// "INTERRUPT_SESSION_MAX_NEW * 3" but a markdown table can't be mechanically checked — this
// guards the FORMULA (not just today's value) against silent drift between the two constants.
describe("INTERRUPT_FLEX_DAILY_MAX derivation", () => {
  it("stays 3x INTERRUPT_SESSION_MAX_NEW — matches docs/INTERRUPT_ARCHITECTURE.md §10.1's documented formula", () => {
    expect(INTERRUPT_FLEX_DAILY_MAX).toBe(INTERRUPT_SESSION_MAX_NEW * 3);
  });

  it("is exactly 9 today (INTERRUPT_SESSION_MAX_NEW=3 x 3) — matches the doc's literal value", () => {
    expect(INTERRUPT_FLEX_DAILY_MAX).toBe(9);
  });
});

// Round-11 audit finding (Agent W): INTERRUPT_FLEX_DAILY_MAX had a hardcoded-value pin above,
// but the three base constants it's built from/paired with — the exact numbers behind BRAND.md's
// "6-8 cards, 45-90 seconds" promise — had none anywhere in the suite. Every consuming test only
// ever compared against these SAME imported constants (toHaveLength(INTERRUPT_SESSION_FLOOR), not
// toHaveLength(6)), so a silent edit to any of the three would leave every test green. These pins
// close that gap — Deletion Test: change any literal on the right of a toBe() call below and the
// corresponding assertion fails, independent of any production code path.
describe("interrupt session size constants — hardcoded value pins", () => {
  it("INTERRUPT_SESSION_FLOOR is exactly 6 — BRAND.md's ratified session-floor promise", () => {
    expect(INTERRUPT_SESSION_FLOOR).toBe(6);
  });

  it("INTERRUPT_SESSION_CAP is exactly 8 — BRAND.md's ratified session-ceiling promise", () => {
    expect(INTERRUPT_SESSION_CAP).toBe(8);
  });

  it("INTERRUPT_SESSION_MAX_NEW is exactly 3 — Cowan (2001) working-memory cap on new cards per session", () => {
    expect(INTERRUPT_SESSION_MAX_NEW).toBe(3);
  });

  it("INTERRUPT_SESSION_GROWTH_CAP is exactly 20 — the time-based growth safety backstop", () => {
    expect(INTERRUPT_SESSION_GROWTH_CAP).toBe(20);
  });
});

// Task (2026-08-21): time-based session growth — a fast interrupt session keeps pulling in
// near-due cards after each rating until the user's own time budget elapses, instead of
// stopping at a fixed card count. See hooks/useInterruptSessionGrowth.ts for the wiring.
describe("shouldGrowInterruptSession", () => {
  it("returns true when elapsed time is under the target and the queue is below the growth cap", () => {
    expect(shouldGrowInterruptSession(10_000, 60, 8)).toBe(true);
  });

  it("returns false once elapsed time reaches the target (exact boundary, not just past it)", () => {
    expect(shouldGrowInterruptSession(60_000, 60, 8)).toBe(false);
  });

  it("returns false once elapsed time exceeds the target", () => {
    expect(shouldGrowInterruptSession(90_000, 60, 8)).toBe(false);
  });

  it("returns true one millisecond before the target elapses", () => {
    expect(shouldGrowInterruptSession(59_999, 60, 8)).toBe(true);
  });

  it("returns false once the queue reaches INTERRUPT_SESSION_GROWTH_CAP, even with time remaining", () => {
    expect(shouldGrowInterruptSession(1_000, 120, INTERRUPT_SESSION_GROWTH_CAP)).toBe(false);
  });

  it("returns true one card below the growth cap, with time remaining", () => {
    expect(shouldGrowInterruptSession(1_000, 120, INTERRUPT_SESSION_GROWTH_CAP - 1)).toBe(true);
  });

  it("respects a user-selected larger target (120s) that a smaller target (60s) would already have cut off", () => {
    expect(shouldGrowInterruptSession(90_000, 120, 8)).toBe(true);
    expect(shouldGrowInterruptSession(90_000, 60, 8)).toBe(false);
  });
});

describe("selectNextGrowthCard", () => {
  it("returns the first near-due candidate not already in the queue", () => {
    const queue = [card("a"), card("b")];
    const nearDue = [card("b"), card("c"), card("d")];
    expect(selectNextGrowthCard(queue, nearDue)).toEqual(card("c"));
  });

  it("returns the very first candidate when none are already queued", () => {
    const queue = [card("a")];
    const nearDue = [card("x"), card("y")];
    expect(selectNextGrowthCard(queue, nearDue)).toEqual(card("x"));
  });

  it("returns null when every candidate is already in the queue", () => {
    const queue = [card("a"), card("b")];
    const nearDue = [card("b"), card("a")];
    expect(selectNextGrowthCard(queue, nearDue)).toBeNull();
  });

  it("returns null when the candidate pool is empty", () => {
    expect(selectNextGrowthCard([card("a")], [])).toBeNull();
  });

  it("preserves the caller's soonest-due-first ordering — never picks a later candidate over an earlier unqueued one", () => {
    const queue: Card[] = [];
    const nearDue = [card("soonest"), card("later")];
    expect(selectNextGrowthCard(queue, nearDue)).toEqual(card("soonest"));
  });
});
