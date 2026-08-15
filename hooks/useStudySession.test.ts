// @vitest-environment jsdom
// ============================================================
// hooks/useStudySession.test.ts — behavioral tests for useStudySession hook
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudySession } from "./useStudySession";
import type { Card, Tier } from "@/content/types";
import { useSRSStore } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";
import { INTERRUPT_SESSION_FLOOR } from "@/lib/queue";
import { ALL_UNITS } from "@/content/index";

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

// ── interrupt flex loop: per-iteration daily-cap recheck (Task #562, Wave 3) ──────
// Deletion Test: a version that computes canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)
// once before the loop (the pre-#562 shape) would call it exactly once, see true, and then
// introduce the loop's full INTERRUPT_SESSION_MAX_NEW (3) batch regardless of the mock
// flipping to false on a later call — only a genuine per-iteration recheck stops the loop
// after 2 introductions here.

describe("useStudySession — interrupt flex loop per-iteration recheck (Task #562)", () => {
  it("stops flexing new cards the moment canIntroduceNewCard flips false mid-batch, not after the full per-session batch", () => {
    const catalog = ["f1", "f2", "f3", "f4", "f5"].map((id) => makeCard(id));
    const catalogMap = Object.fromEntries(catalog.map((c) => [c.id, c]));
    const introduceCard = vi.fn();
    let flexCallCount = 0;
    // Normal daily cap: already used (false). Flex checks: true for the first 2 calls,
    // false from the 3rd onward — simulates INTERRUPT_FLEX_DAILY_MAX being reached
    // mid-batch (e.g. by other same-day sessions' introductions), not before the loop starts.
    const canIntroduceNewCard = vi.fn((_today: string, maxPerDay?: number) => {
      if (maxPerDay === undefined) return false;
      flexCallCount++;
      return flexCallCount <= 2;
    });
    const { result } = renderHook(() =>
      useStudySession(
        defaultParams({
          initialQueue: [],
          allCardMap: catalogMap,
          isInterrupt: true,
          canIntroduceNewCard,
          introduceCard,
          getNearDueCards: vi.fn(() => []),
        }),
      ),
    );

    expect(introduceCard).toHaveBeenCalledTimes(2);
    expect(introduceCard.mock.calls.map((c) => c[0])).toEqual(["f1", "f2"]);
    expect(result.current.queue.map((c) => c.id)).toEqual(["f1", "f2"]);
    // The 3rd flex-shaped call (the one that returned false and stopped the loop) proves
    // the recheck genuinely happens as part of the loop condition, not just once beforehand.
    expect(flexCallCount).toBe(3);
  });
});

// ── cold-start freeze fix (Task #573, Wave 3) ──────────────────────────────────────
// app/study/page.tsx calls useStudySession unconditionally, before its own packLoading
// early return — any session whose FIRST render happens while the pack is still loading
// (still-loading es-language pack, specialty-pack load, cold push-tap launch) previously
// froze the queue permanently empty: useState(initialQueue) only consumes its initializer
// on that first render, and the mount effect's empty `[]` dependency array meant it ran
// exactly once, against that same empty snapshot, and never got a second chance once real
// pack data actually arrived.

describe("useStudySession — cold-start freeze fix (Task #573)", () => {
  it("does not run the fill pass against an empty allCardMap on the first render, then re-syncs the queue once real pack data arrives on a later render", () => {
    const introduceCard = vi.fn();
    const canIntroduceNewCard = vi.fn(() => false); // isolates this test to the resync itself
    const realCards = ["p1", "p2", "p3"].map((id) => makeCard(id));
    const realCardMap = Object.fromEntries(realCards.map((c) => [c.id, c]));

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useStudySession>[0]) => useStudySession(props),
      {
        initialProps: defaultParams({
          initialQueue: [],
          allCardMap: {}, // app/study/page.tsx's real shape while packLoading is true
          canIntroduceNewCard,
          introduceCard,
        }),
      },
    );

    expect(result.current.queue).toHaveLength(0);

    // Pack finishes loading — the caller re-renders useStudySession with the real
    // initialQueue/allCardMap. Pre-#573, useState's initializer and the mount effect's
    // `[]` deps were both already "spent" on the first render above, permanently
    // freezing the queue empty regardless of what arrives here.
    rerender(
      defaultParams({
        initialQueue: realCards,
        allCardMap: realCardMap,
        canIntroduceNewCard,
        introduceCard,
      }),
    );

    expect(result.current.queue.map((c) => c.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("runs the real fill pass exactly once, even if allCardMap keeps changing reference after real data first arrives", () => {
    const introduceCard = vi.fn();
    const canIntroduceNewCard = vi.fn(() => true); // normal daily cap open on every render
    const catalogA = ["a1", "a2"].map((id) => makeCard(id));
    const catalogB = ["b1", "b2"].map((id) => makeCard(id)); // a distinct later allCardMap reference

    const { rerender } = renderHook(
      (props: Parameters<typeof useStudySession>[0]) => useStudySession(props),
      {
        initialProps: defaultParams({
          initialQueue: catalogA,
          allCardMap: Object.fromEntries(catalogA.map((c) => [c.id, c])),
          canIntroduceNewCard,
          introduceCard,
        }),
      },
    );
    // Real mount, real data available immediately — fills normally, exactly once.
    expect(introduceCard).toHaveBeenCalledTimes(1);

    // A later, unrelated allCardMap reference change (e.g. navigating to a different
    // unit's catalog without a full remount) must NOT re-trigger the fill pass a second
    // time — mountFillDoneRef must hold once the real pass has already run.
    rerender(
      defaultParams({
        initialQueue: catalogA,
        allCardMap: Object.fromEntries(catalogB.map((c) => [c.id, c])),
        canIntroduceNewCard,
        introduceCard,
      }),
    );
    expect(introduceCard).toHaveBeenCalledTimes(1);
  });
});

// ── seam: normal-cap intro + interrupt flex fill interaction, real store (Task #574) ──
// Rule 13 (Test the Seams): app/study/page.tsx's mount effect calls introduceNext() via
// BOTH the normal daily-cap path and (for interrupt sessions) the flex loop, sharing a
// single `introducedIds` Set — a normal-cap introduction counts as one of the flex loop's
// INTERRUPT_SESSION_MAX_NEW (3) slots, it is not additive with them. That interaction was
// correct by inspection but untested; this test wires the real store/srsStore.ts actions
// (no mocked canIntroduceNewCard/introduceCard/getNearDueCards) so a real regression in
// either cap actually fails a test, not just a code-review read.

describe("useStudySession — seam: normal-cap intro consumes 1 of the 3 flex slots (real store, Task #574)", () => {
  beforeEach(() => {
    useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
  });

  it("a normal-cap introduction on mount consumes 1 of the 3 per-session flex slots — the flex loop introduces only 2 more, not 3", () => {
    const UNIT = ALL_UNITS[0]!;
    const noPrereq = UNIT.cards.filter((c) => !c.prerequisites || c.prerequisites.length === 0);
    expect(noPrereq.length).toBeGreaterThanOrEqual(11);
    // Untouched (no progress) — candidates for normal-cap + flex introduction.
    const untouchedCards = noPrereq.slice(0, 5);
    // Already-studied, not-yet-due — candidates for the near-due floor fill.
    const nearDueSourceCards = noPrereq.slice(5, 11);
    const allCardMap = Object.fromEntries([...untouchedCards, ...nearDueSourceCards].map((c) => [c.id, c]));

    const progress: Record<string, CardProgress> = Object.fromEntries(
      nearDueSourceCards.map((c) => [c.id, {
        cardId: c.id,
        state: "review",
        stability: 10,
        difficulty: 5,
        retrievability: 0.9,
        dueDate: Date.now() + 24 * 60 * 60 * 1000, // studied, not yet due
        lapses: 0,
        reps: 1,
      } satisfies CardProgress])
    );
    useSRSStore.setState({ cards: progress, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
    const store = useSRSStore.getState();

    const { result } = renderHook(() =>
      useStudySession({
        initialQueue: [],
        allCardMap,
        isGlobal: false,
        isInterrupt: true,
        unitId: UNIT.id,
        getResumableSession: store.getResumableSession,
        clearActiveSession: store.clearActiveSession,
        commitSession: store.commitSession,
        canIntroduceNewCard: store.canIntroduceNewCard,
        introduceCard: store.introduceCard,
        getNearDueCards: (limit) => store.getNearDueCards(nearDueSourceCards, limit),
        cards: store.cards,
        introductions: store.introductions,
        enqueueReviewEvent: vi.fn(),
      })
    );

    const queueIds = result.current.queue.map((c) => c.id);
    expect(queueIds).toHaveLength(INTERRUPT_SESSION_FLOOR); // 6

    const untouchedIdSet = new Set(untouchedCards.map((c) => c.id));
    const nearDueIdSet = new Set(nearDueSourceCards.map((c) => c.id));
    const introducedInQueue = queueIds.filter((id) => untouchedIdSet.has(id));
    const nearDueInQueue = queueIds.filter((id) => nearDueIdSet.has(id));
    // 1 normal-cap + 2 flex = 3 total introductions, not 1 + 3 = 4 — the shared
    // introducedIds Set means the normal-cap pick consumes one of the flex loop's
    // own 3 slots rather than being additive with it.
    expect(introducedInQueue).toHaveLength(3);
    expect(nearDueInQueue).toHaveLength(3); // floor(6) - 3 introduced = 3
    // Real store: exactly 3 introduction records exist today, confirming the count
    // above isn't an artifact of queue dedup — 3 distinct cards were actually introduced.
    expect(Object.keys(useSRSStore.getState().introductions)).toHaveLength(3);
  });
});
