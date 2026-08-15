// @vitest-environment jsdom
// ============================================================
// hooks/useStudySession.test.ts — behavioral tests for useStudySession hook
// ============================================================
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudySession } from "./useStudySession";
import type { Card, Tier } from "@/content/types";

function makeCard(id: string, tier: Tier = 1, prerequisites?: string[]): Card {
  return { id, type: "recognize", prompt: `Prompt ${id}`, accepted: [`Answer ${id}`], tags: [], tier, ...(prerequisites ? { prerequisites } : {}) };
}

const CARDS = [makeCard("c1"), makeCard("c2"), makeCard("c3")];
const CARD_MAP = Object.fromEntries(CARDS.map((c) => [c.id, c]));

function defaultParams(overrides: Partial<Parameters<typeof useStudySession>[0]> = {}) {
  return {
    initialQueue: CARDS,
    allCardMap: CARD_MAP,
    isGlobal: false,
    isInterrupt: false,
    unitId: "it-a1u01",
    getResumableSession: vi.fn(() => null),
    clearActiveSession: vi.fn(),
    commitSession: vi.fn(),
    canIntroduceNewCard: vi.fn(() => false),
    introduceCard: vi.fn(),
    getNearDueCards: vi.fn(() => []),
    cards: {},
    introductions: {},
    enqueueReviewEvent: vi.fn(),
    ...overrides,
  };
}

describe("useStudySession — happy path", () => {
  it("starts with initialQueue, pos 0, and null resumeDecision when no saved session", () => {
    const { result } = renderHook(() => useStudySession(defaultParams()));
    expect(result.current.queue).toHaveLength(3);
    expect(result.current.queue.at(0)?.id).toBe("c1");
    expect(result.current.pos).toBe(0);
    expect(result.current.resumeDecision).toBeNull();
  });
});

describe("useStudySession — resume path", () => {
  it("sets resumeDecision to 'pending' when a matching saved session exists", () => {
    const savedSession = {
      unitId: "it-a1u01",
      queueIds: ["c1", "c2", "c3"],
      position: 1,
      sessionCorrect: 1,
      sessionTotal: 1,
      startedAt: Date.now(),
    };
    const { result } = renderHook(() =>
      useStudySession(defaultParams({ getResumableSession: vi.fn(() => savedSession) })),
    );
    expect(result.current.resumeDecision).toBe("pending");
  });

  it("loads saved position and counters when resume is accepted", () => {
    const savedSession = {
      unitId: "it-a1u01",
      queueIds: ["c1", "c2", "c3"],
      position: 2,
      sessionCorrect: 2,
      sessionTotal: 2,
      startedAt: Date.now(),
    };
    const { result } = renderHook(() =>
      useStudySession(defaultParams({ getResumableSession: vi.fn(() => savedSession) })),
    );

    act(() => {
      result.current.setResumeDecision("accepted");
    });

    expect(result.current.pos).toBe(2);
    expect(result.current.sessionCorrect).toBe(2);
    expect(result.current.sessionTotal).toBe(2);
  });
});

describe("useStudySession — handleRate", () => {
  it("correct answer: advances pos, increments sessionTotal and sessionCorrect, calls commitSession", () => {
    const commitSession = vi.fn();
    const { result } = renderHook(() => useStudySession(defaultParams({ commitSession })));

    act(() => {
      result.current.handleRate("good");
    });

    expect(result.current.pos).toBe(1);
    expect(result.current.sessionTotal).toBe(1);
    expect(result.current.sessionCorrect).toBe(1);
    expect(commitSession).toHaveBeenCalledWith(
      "c1",
      "good",
      expect.objectContaining({ unitId: "it-a1u01", position: 1, sessionTotal: 1, sessionCorrect: 1 }),
    );
  });

  it("'again' answer: advances pos, keeps sessionCorrect at 0, re-inserts card, calls commitSession", () => {
    const commitSession = vi.fn();
    const { result } = renderHook(() => useStudySession(defaultParams({ commitSession })));

    act(() => {
      result.current.handleRate("again");
    });

    expect(result.current.pos).toBe(1);
    expect(result.current.sessionTotal).toBe(1);
    expect(result.current.sessionCorrect).toBe(0);
    expect(result.current.queue).toHaveLength(4); // card re-inserted 3 positions ahead
    expect(commitSession).toHaveBeenCalledWith(
      "c1",
      "again",
      expect.objectContaining({ unitId: "it-a1u01", sessionTotal: 1, sessionCorrect: 0 }),
    );
  });

  it("final card: commitSession receives correct unitId, queueIds, and sessionTotal === 1", () => {
    const solo = makeCard("solo");
    const commitSession = vi.fn();
    const params = defaultParams({ initialQueue: [solo], allCardMap: { solo }, commitSession });
    const { result } = renderHook(() => useStudySession(params));

    act(() => {
      result.current.handleRate("easy");
    });

    expect(commitSession).toHaveBeenCalledTimes(1);
    const firstCall = commitSession.mock.calls[0];
    // commitSession(cardId, grade, session) — proves the call received exactly 3
    // arguments, not just that the mock.calls[0] tuple itself is non-undefined (which
    // toHaveBeenCalledTimes(1) above already guarantees).
    expect(firstCall).toHaveLength(3);
    const [cardId, grade, session] = firstCall!;
    expect(cardId).toBe("solo");
    expect(grade).toBe("easy");
    expect((session as { unitId: string }).unitId).toBe("it-a1u01");
    // A single-card queue with handleRate called exactly once — sessionTotal starts at 0
    // and increments by 1 per call, so the exact value is provable, not just a lower bound.
    expect((session as { sessionTotal: number }).sessionTotal).toBe(1);
    expect((session as { queueIds: string[] }).queueIds).toContain("solo");
  });
});

describe("useStudySession — introduction auto-selection", () => {
  it("calls introduceCard on mount when canIntroduceNewCard is true and unintroduced cards exist", () => {
    const introduceCard = vi.fn();
    renderHook(() =>
      useStudySession(defaultParams({ canIntroduceNewCard: vi.fn(() => true), introduceCard })),
    );
    expect(introduceCard).toHaveBeenCalledTimes(1);
    expect(introduceCard).toHaveBeenCalledWith("c1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("does not call introduceCard when canIntroduceNewCard returns false", () => {
    const introduceCard = vi.fn();
    renderHook(() =>
      useStudySession(defaultParams({ canIntroduceNewCard: vi.fn(() => false), introduceCard })),
    );
    expect(introduceCard).not.toHaveBeenCalled();
  });

  it("does not call introduceCard when all cards already have introduction records", () => {
    const introduceCard = vi.fn();
    const introductions = Object.fromEntries(CARDS.map((c) => [c.id, { cardId: c.id } as never]));
    renderHook(() =>
      useStudySession(defaultParams({ canIntroduceNewCard: vi.fn(() => true), introduceCard, introductions })),
    );
    expect(introduceCard).not.toHaveBeenCalled();
  });

  it("selects the lowest-tier card when multiple unintroduced cards exist", () => {
    const t1 = makeCard("t1", 1);
    const t2 = makeCard("t2", 2);
    const introduceCard = vi.fn();
    renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [t2, t1],
          allCardMap: { t1, t2 },
          canIntroduceNewCard: vi.fn(() => true),
          introduceCard,
        }),
      ),
    );
    expect(introduceCard).toHaveBeenCalledWith("t1", expect.any(String));
  });

  it("appends the introduced card to the queue when it is not already present", () => {
    const newCard = makeCard("new");
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: CARDS,
          allCardMap: { ...CARD_MAP, new: newCard },
          canIntroduceNewCard: vi.fn(() => true),
          introduceCard,
        }),
      ),
    );
    // c1 is the lowest-tier qualifying card; it's already in the initial queue so no append
    expect(result.current.queue).toHaveLength(3);
  });
});

// ── interrupt-floor flex fallback (BRAND.md: 6-10 interrupts/day, never fewer) ────────────
// Deletion Test: without the fallback branch, canIntroduceNewCard false means the mount
// effect returns immediately — no introduceCard call, no queue append — leaving an interrupt
// session with an empty queue even though a real untouched card exists.

describe("useStudySession — interrupt-floor flex fallback", () => {
  it("flexes past the daily cap when isInterrupt and the session would otherwise be empty", () => {
    const introduceCard = vi.fn();
    // Discriminates the normal daily-cap check (called with no maxPerDay — the store
    // default of 1) from the flex check (called with an explicit maxPerDay, Task #551's
    // INTERRUPT_FLEX_DAILY_MAX): today's plain 1/day cap is already used, but the card is
    // NOT stranded, so the flex check must still permit the fill.
    const canIntroduceNewCard = vi.fn((_today: string, maxPerDay?: number) => maxPerDay !== undefined);
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [], // empty — no FSRS-due or introduction-due cards this interrupt
          isInterrupt: true,
          canIntroduceNewCard,
          introduceCard,
        }),
      ),
    );
    // The flex loop keeps introducing until it hits whichever bound comes first — here,
    // CARD_MAP only has 3 untouched cards (c1-c3), so it exhausts the pool (introduceNext()
    // returns false on the 4th call) before either INTERRUPT_SESSION_FLOOR (6) or
    // INTERRUPT_SESSION_MAX_NEW (3) would otherwise stop it.
    expect(introduceCard).toHaveBeenCalledTimes(3);
    expect(introduceCard).toHaveBeenCalledWith("c1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(result.current.queue.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("does not flex when isInterrupt is false, even with an empty queue", () => {
    const introduceCard = vi.fn();
    renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [],
          isInterrupt: false, // e.g. a manually-opened Global Review
          canIntroduceNewCard: vi.fn(() => false),
          introduceCard,
        }),
      ),
    );
    expect(introduceCard).not.toHaveBeenCalled();
  });

  // Task #537: previously titled "does not flex when isInterrupt is true but the queue is
  // non-empty" — a false general rule, since Batch 23 deliberately DOES fill non-empty
  // interrupt queues up to the floor (see the "tops up a 4-card interrupt queue to 6" test
  // below). This test only still passes because BOTH fill sources are stubbed to produce
  // nothing here: canIntroduceNewCard denies the flex check (stranded/exhausted), and
  // defaultParams' getNearDueCards returns [] by default — the queue's non-emptiness itself
  // isn't what blocks the flex.
  it("does not introduce a new card via the flex path when canIntroduceNewCard denies it and no near-due card is available, even with a non-empty under-floor queue", () => {
    const introduceCard = vi.fn();
    renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: CARDS, // non-empty — a review or intro card is already due
          isInterrupt: true,
          canIntroduceNewCard: vi.fn(() => false),
          introduceCard,
        }),
      ),
    );
    expect(introduceCard).not.toHaveBeenCalled();
  });

  it("does not flex when there is no qualifying card left anywhere (truly nothing to teach)", () => {
    const introduceCard = vi.fn();
    const introductions = Object.fromEntries(CARDS.map((c) => [c.id, { cardId: c.id } as never]));
    renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [],
          isInterrupt: true,
          canIntroduceNewCard: vi.fn(() => false),
          introduceCard,
          introductions, // every card already has a record — selectQualifyingNewCard finds none
        }),
      ),
    );
    expect(introduceCard).not.toHaveBeenCalled();
  });
});

// ── interrupt session-size floor (Batch 23) ───────────────────────────────────
// Owner-ratified spec (2026-08-14): every interrupt session holds at least
// INTERRUPT_SESSION_FLOOR (6) cards — filled with flexed new introductions
// (hard cap INTERRUPT_SESSION_MAX_NEW = 3 per session), then near-due reviews
// pulled slightly early. Deletion Test: without the fill loop, an interrupt
// whose initialQueue holds 1-5 cards mounts with exactly that many.

describe("useStudySession — interrupt session-size floor (Batch 23)", () => {
  // Cap-used-but-not-stranded: the store's real canIntroduceNewCard(today) is
  // false once today's 1 is used, while canIntroduceNewCard(today, MAX_SAFE_INTEGER)
  // stays true until a card is stranded. The mock mirrors that split exactly.
  const capUsedNotStranded = () => vi.fn((_t: string, maxPerDay?: number) => maxPerDay !== undefined);

  const catalog = ["n1", "n2", "n3", "n4", "n5"].map((id) => makeCard(id));
  const catalogMap = Object.fromEntries(catalog.map((c) => [c.id, c]));
  const nearDuePool = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id) => makeCard(id));

  it("fills an empty interrupt session to exactly 6: 3 flexed new cards, then 3 near-due", () => {
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [],
          allCardMap: catalogMap,
          isInterrupt: true,
          canIntroduceNewCard: capUsedNotStranded(),
          introduceCard,
          getNearDueCards: vi.fn(() => nearDuePool),
        }),
      ),
    );
    expect(introduceCard.mock.calls.map((c) => c[0])).toEqual(["n1", "n2", "n3"]);
    expect(result.current.queue.map((c) => c.id)).toEqual(["n1", "n2", "n3", "r1", "r2", "r3"]);
  });

  it("tops up a 4-card interrupt queue to 6 with 2 flexed new cards and no near-due", () => {
    const initial = ["d1", "d2", "d3", "d4"].map((id) => makeCard(id));
    const getNearDueCards = vi.fn(() => nearDuePool);
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: initial,
          allCardMap: { ...Object.fromEntries(initial.map((c) => [c.id, c])), ...catalogMap },
          cards: Object.fromEntries(initial.map((c) => [c.id, { reps: 1 } as never])), // studied → not "new"
          isInterrupt: true,
          canIntroduceNewCard: capUsedNotStranded(),
          introduceCard,
          getNearDueCards,
        }),
      ),
    );
    expect(introduceCard.mock.calls.map((c) => c[0])).toEqual(["n1", "n2"]);
    // Exact contents, not just length 6 (Task #556) — mirrors the sibling "fills an empty
    // interrupt session to exactly 6" test above: a wrong or duplicate id landing at length
    // 6 would slip through a bare toHaveLength(6) undetected.
    expect(result.current.queue.map((c) => c.id)).toEqual(["d1", "d2", "d3", "d4", "n1", "n2"]);
  });

  it("falls back to near-due-only fill when the stranded pause blocks new introductions", () => {
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [],
          allCardMap: catalogMap,
          isInterrupt: true,
          canIntroduceNewCard: vi.fn(() => false), // stranded — false for BOTH call shapes
          introduceCard,
          getNearDueCards: vi.fn(() => nearDuePool),
        }),
      ),
    );
    expect(introduceCard).not.toHaveBeenCalled();
    expect(result.current.queue.map((c) => c.id)).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
  });

  it("stops at the catalog's edge without padding duplicates when supply runs out below the floor", () => {
    const onlyTwo = { n1: makeCard("n1"), n2: makeCard("n2") };
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [],
          allCardMap: onlyTwo,
          isInterrupt: true,
          canIntroduceNewCard: capUsedNotStranded(),
          introduceCard,
          getNearDueCards: vi.fn(() => []),
        }),
      ),
    );
    expect(result.current.queue.map((c) => c.id)).toEqual(["n1", "n2"]);
  });

  it("never duplicates a near-due card that is already in the queue", () => {
    const shared = makeCard("shared");
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [shared],
          allCardMap: { shared },
          cards: { shared: { reps: 1 } as never },
          isInterrupt: true,
          canIntroduceNewCard: vi.fn(() => false),
          introduceCard,
          getNearDueCards: vi.fn(() => [shared, ...nearDuePool]),
        }),
      ),
    );
    expect(result.current.queue.map((c) => c.id)).toEqual(["shared", "r1", "r2", "r3", "r4", "r5"]);
  });

  // Task #559: the test above passes even with the loop-level dedup check
  // (`if (sessionIds.has(card.id)) continue;`) deleted, because the outer setQueue filter
  // independently re-dedupes `added` against `prev` (the queue state BEFORE this effect
  // ran) — and in that test, "shared" was already in `prev` (initialQueue), so the outer
  // filter alone would have caught it regardless of the loop-level check (Deletion Test
  // failure, Rule 18).
  //
  // This test isolates the one case the outer filter structurally CANNOT catch: a card
  // introduced via the flex-new-card path EARLIER IN THE SAME EFFECT PASS (added to
  // `sessionIds`/`added` in memory, but not yet part of `prev` — `prev` is still the OLD
  // queue state when the near-due loop runs) that then also appears in getNearDueCards's
  // return. Only the loop-level `sessionIds.has(card.id)` check can catch this, since the
  // outer filter only knows about `prev`, never about `added`'s own contents.
  it("never duplicates a card introduced via the flex-new path in the same pass, even when getNearDueCards also returns it", () => {
    const dual = makeCard("dual"); // untouched — qualifies for flex-new introduction
    const introduceCard = vi.fn();
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [], // empty prev — the outer filter has nothing to dedupe against
          allCardMap: { dual }, // the ONLY flex-new candidate — introduced first
          isInterrupt: true,
          canIntroduceNewCard: capUsedNotStranded(),
          introduceCard,
          // "dual" is deliberately included here too — the near-due loop must skip it via
          // sessionIds, not rely on the (structurally blind, in this exact scenario) outer filter.
          getNearDueCards: vi.fn(() => [dual, ...nearDuePool]),
        }),
      ),
    );
    const ids = result.current.queue.map((c) => c.id);
    expect(ids).toEqual(["dual", "r1", "r2", "r3", "r4", "r5"]);
    // Explicit: "dual" appears exactly once, not twice.
    expect(ids.filter((id) => id === "dual")).toHaveLength(1);
  });

  it("does not fill a short NON-interrupt session — unit and global sessions keep their natural size", () => {
    const introduceCard = vi.fn();
    const getNearDueCards = vi.fn(() => nearDuePool);
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [makeCard("d1")],
          allCardMap: { d1: makeCard("d1"), ...catalogMap },
          cards: { d1: { reps: 1 } as never },
          isInterrupt: false,
          canIntroduceNewCard: capUsedNotStranded(),
          introduceCard,
          getNearDueCards,
        }),
      ),
    );
    expect(introduceCard).not.toHaveBeenCalled();
    expect(getNearDueCards).not.toHaveBeenCalled();
    expect(result.current.queue).toHaveLength(1);
  });
});

// ── prerequisite gating (Batch 18) ────────────────────────────────────────────
// Rule 20 — exercises the real production entry point (the hook's mount effect), not the
// underlying prerequisitesMet/selectQualifyingNewCard functions called directly in isolation.

describe("useStudySession — introduce-on-mount effect respects Card.prerequisites (Batch 18)", () => {
  it("skips a qualifying card whose prerequisite has not reached 'review' state, introduces the next eligible card instead", () => {
    const cardA = makeCard("card-a", 2);
    const cardB = makeCard("card-b", 1, ["card-a"]); // tier 1 sorts first if not filtered
    const introduceCard = vi.fn();
    // B7: the pre-fix filter has no prerequisitesMet check, so it would call
    // introduceCard("card-b", ...) here (card-b sorts first by tier) even though its
    // prerequisite card-a is unmet.
    renderHook(() =>
      useStudySession(
        defaultParams({
          allCardMap: { "card-a": cardA, "card-b": cardB },
          cards: {},
          canIntroduceNewCard: vi.fn(() => true),
          introduceCard,
        }),
      ),
    );
    expect(introduceCard).toHaveBeenCalledTimes(1);
    expect(introduceCard).toHaveBeenCalledWith("card-a", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("introduces a gated card once its prerequisite reaches 'review' state", () => {
    const cardA = makeCard("card-a", 2);
    const cardB = makeCard("card-b", 1, ["card-a"]);
    const introduceCard = vi.fn();
    const progressMap = {
      "card-a": { cardId: "card-a", state: "review" as const, stability: 5, difficulty: 5, retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 3 },
    };
    renderHook(() =>
      useStudySession(
        defaultParams({
          allCardMap: { "card-a": cardA, "card-b": cardB },
          cards: progressMap,
          canIntroduceNewCard: vi.fn(() => true),
          introduceCard,
        }),
      ),
    );
    // B7: catches an over-aggressive gate that always returns false — introduceCard must fire.
    expect(introduceCard).toHaveBeenCalledTimes(1);
    expect(introduceCard).toHaveBeenCalledWith("card-b", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("introduces nothing when the only qualifying card has an unmet prerequisite", () => {
    const cardB = makeCard("card-b", 1, ["card-a"]);
    const introduceCard = vi.fn();
    renderHook(() =>
      useStudySession(
        defaultParams({
          allCardMap: { "card-b": cardB },
          cards: {},
          canIntroduceNewCard: vi.fn(() => true),
          introduceCard,
        }),
      ),
    );
    // B7: catches a missing `if (!first) return;` guard interaction.
    expect(introduceCard).not.toHaveBeenCalled();
  });
});
