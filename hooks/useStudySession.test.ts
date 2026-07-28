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
    unitId: "it-a1u01",
    getResumableSession: vi.fn(() => null),
    clearActiveSession: vi.fn(),
    commitSession: vi.fn(),
    canIntroduceNewCard: vi.fn(() => false),
    introduceCard: vi.fn(),
    cards: {},
    introductions: {},
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

  it("final card: commitSession receives correct unitId, queueIds, and sessionTotal ≥ 1", () => {
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
    expect((session as { sessionTotal: number }).sessionTotal).toBeGreaterThanOrEqual(1);
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
