// @vitest-environment jsdom
// ============================================================
// hooks/useStudySession.test.ts — behavioral tests for useStudySession hook
// ============================================================
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudySession } from "./useStudySession";
import type { Card } from "@/content/types";

function makeCard(id: string): Card {
  return { id, type: "recognize", prompt: `Prompt ${id}`, accepted: [`Answer ${id}`], tags: [], tier: 1 };
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
    expect(firstCall).toBeDefined();
    const [cardId, grade, session] = firstCall!;
    expect(cardId).toBe("solo");
    expect(grade).toBe("easy");
    expect((session as { unitId: string }).unitId).toBe("it-a1u01");
    expect((session as { sessionTotal: number }).sessionTotal).toBeGreaterThanOrEqual(1);
    expect((session as { queueIds: string[] }).queueIds).toContain("solo");
  });
});
