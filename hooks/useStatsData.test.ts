// @vitest-environment jsdom
// ============================================================
// useStatsData.test.ts — behavioral tests for useStatsData hook
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockUseLangPack, mockUseSRSStore } = vi.hoisted(() => ({
  mockUseLangPack: vi.fn(),
  mockUseSRSStore: vi.fn(),
}));

vi.mock("@/hooks/useLangPack", () => ({
  useLangPack: mockUseLangPack,
}));

vi.mock("@/store/srsStore", () => ({
  useSRSStore: mockUseSRSStore,
  // Inline real isMastered logic so tests run without the full store
  isMastered: (p: { state?: string; stability?: number } | undefined) =>
    p?.state === "review" && (p?.stability ?? 0) >= 7,
}));

import { useStatsData } from "./useStatsData";
import type { Unit, Card } from "@/content/types";
import type { CardProgress } from "@/lib/srs";

function makeCard(id: string): Card {
  return { id, type: "recognize", prompt: `Prompt ${id}`, accepted: [`Answer ${id}`], tags: [], tier: 1 };
}

function makeUnit(id: string, cards: Card[]): Unit {
  return { id, name: `Unit ${id}`, level: "A1", theme: "test", emoji: "📚", prerequisiteUnits: [], cards };
}

function makeProgress(overrides: Partial<CardProgress> = {}): CardProgress {
  return {
    cardId: "c1",
    state: "review",
    stability: 7,
    difficulty: 5,
    retrievability: 0.9,
    dueDate: Date.now(),
    lapses: 0,
    reps: 5,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useStatsData — loading state", () => {
  it("returns loading:true and empty arrays when useLangPack is still loading", () => {
    mockUseLangPack.mockReturnValue({ units: [], loading: true });
    mockUseSRSStore.mockReturnValue({ cards: {} });

    const { result } = renderHook(() => useStatsData());
    expect(result.current.loading).toBe(true);
    expect(result.current.hardest).toHaveLength(0);
    expect(result.current.atRisk).toHaveLength(0);
  });
});

describe("useStatsData — hardest", () => {
  it("returns cards sorted by highest difficulty first", () => {
    const cards = [makeCard("c1"), makeCard("c2"), makeCard("c3")];
    const unit = makeUnit("u1", cards);
    mockUseLangPack.mockReturnValue({ units: [unit], loading: false });
    mockUseSRSStore.mockReturnValue({
      cards: {
        c1: makeProgress({ cardId: "c1", difficulty: 3 }),
        c2: makeProgress({ cardId: "c2", difficulty: 7 }),
        c3: makeProgress({ cardId: "c3", difficulty: 5 }),
      },
    });

    const { result } = renderHook(() => useStatsData());
    expect(result.current.hardest[0]?.progress.difficulty).toBe(7);
    expect(result.current.hardest[1]?.progress.difficulty).toBe(5);
    expect(result.current.hardest[2]?.progress.difficulty).toBe(3);
  });
});

describe("useStatsData — atRisk", () => {
  it("includes mastered cards with dueDate more than 7 days in the past", () => {
    const card = makeCard("c1");
    const unit = makeUnit("u1", [card]);
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    mockUseLangPack.mockReturnValue({ units: [unit], loading: false });
    mockUseSRSStore.mockReturnValue({
      cards: {
        c1: makeProgress({ cardId: "c1", state: "review", stability: 7, dueDate: eightDaysAgo }),
      },
    });

    const { result } = renderHook(() => useStatsData());
    expect(result.current.atRisk).toHaveLength(1);
    expect(result.current.atRisk[0]?.card.id).toBe("c1");
  });

  it("excludes mastered cards with dueDate less than 7 days in the past", () => {
    const card = makeCard("c1");
    const unit = makeUnit("u1", [card]);
    const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;
    mockUseLangPack.mockReturnValue({ units: [unit], loading: false });
    mockUseSRSStore.mockReturnValue({
      cards: {
        c1: makeProgress({ cardId: "c1", state: "review", stability: 7, dueDate: oneDayAgo }),
      },
    });

    const { result } = renderHook(() => useStatsData());
    expect(result.current.atRisk).toHaveLength(0);
  });
});
