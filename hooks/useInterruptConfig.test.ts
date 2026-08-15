// @vitest-environment jsdom
// ============================================================
// useInterruptConfig.test.ts — behavioral tests for computeDue()
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Unit, Card } from "@/content/types";

const { mockUseSettingsStore, mockGetState, mockUseAuthStore, mockUseSyncStore } = vi.hoisted(() => ({
  mockUseSettingsStore: vi.fn(),
  mockGetState: vi.fn(),
  // Task #529: selector-style mocks — call the selector against a fixed default state
  // object so `useAuthStore((s) => s.userId)` and `useSyncStore((s) => s.deviceId)` behave
  // like the real Zustand hooks without pulling in real store/authStore.ts (which wires a
  // live Supabase onAuthStateChange listener at module load) or store/syncStore.ts.
  mockUseAuthStore: vi.fn((selector: (s: { userId: string | null }) => unknown) => selector({ userId: null })),
  mockUseSyncStore: vi.fn((selector: (s: { deviceId: string | null }) => unknown) => selector({ deviceId: null })),
}));

vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: mockUseSettingsStore,
  isInDnd: vi.fn(),
}));

vi.mock("@/store/srsStore", () => ({
  useSRSStore: { getState: mockGetState },
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock("@/store/syncStore", () => ({
  useSyncStore: mockUseSyncStore,
}));

import { useInterruptConfig } from "./useInterruptConfig";

function makeCard(id: string): Card {
  return { id, type: "recognize", prompt: `Prompt ${id}`, accepted: [`Answer ${id}`], tags: [], tier: 1 };
}

function makeUnit(id: string, cards: Card[]): Unit {
  return { id, name: `Unit ${id}`, level: "A1", theme: "test", emoji: "📚", prerequisiteUnits: [], cards };
}

// Card-aware store stub — mirrors real srsStore.ts's contract: getStats/getNewCards derive
// their result from which cards are passed in, not from a flat pre-baked number, so summing
// across multiple units behaves the same way the real store would.
function makeState(overrides: Partial<{
  dueCardIds: string[];
  introductionDueIds: string[];
  canIntroduceNewCard: boolean;
  newCardIds: string[];
  nearDueIds: string[];
}> = {}) {
  const { dueCardIds = [], introductionDueIds = [], canIntroduceNewCard = false, newCardIds = [], nearDueIds = [] } = overrides;
  return {
    getStats: (unitCards: Card[]) => ({
      due: unitCards.filter((c) => dueCardIds.includes(c.id)).length,
      learning: 0,
      mastered: 0,
      total: unitCards.length,
      masteryPct: 0,
    }),
    getIntroductionDueCardIds: () => introductionDueIds,
    canIntroduceNewCard: () => canIntroduceNewCard,
    getNewCards: (unitCards: Card[], limit = 20) =>
      unitCards.filter((c) => newCardIds.includes(c.id)).slice(0, limit),
    getNearDueCards: (unitCards: Card[], limit: number) =>
      unitCards.filter((c) => nearDueIds.includes(c.id)).slice(0, limit),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSettingsStore.mockReturnValue({
    interruptEnabled: true,
    intervalHours: 3,
    mandatory: false,
    dndStart: "22:00",
    dndEnd: "08:00",
    wakeEnabled: true,
    unlockEnabled: true,
    idleEnabled: true,
    idleThresholdMinutes: 15,
  });
  mockGetState.mockReturnValue(makeState());
});

describe("useInterruptConfig — computeDue", () => {
  it("returns 0 when units is empty", () => {
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([])).toBe(0);
  });

  it("returns 0 when nothing is due, no introduction cards, and no qualifying new card", () => {
    const unit = makeUnit("u1", [makeCard("u1-c1")]);
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(0);
  });

  it("counts traditional FSRS-due cards (existing behavior)", () => {
    const cards = [makeCard("u1-c1"), makeCard("u1-c2"), makeCard("u1-c3")];
    const unit = makeUnit("u1", cards);
    mockGetState.mockReturnValue(makeState({ dueCardIds: ["u1-c1", "u1-c2", "u1-c3"] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(3);
  });

  // Deletion Test: today's implementation (summing only getStats().due) would return 0
  // for this scenario — zero FSRS reviews due, one introduction-cadence card due.
  it("returns non-zero when the only due content is an introduction-cadence card", () => {
    const card = makeCard("u1-c1");
    const unit = makeUnit("u1", [card]);
    mockGetState.mockReturnValue(makeState({ introductionDueIds: [card.id] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(1);
  });

  // Deletion Test: today's implementation would also return 0 here — zero FSRS reviews
  // due, zero introduction cards due, but a qualifying new card is ready to be introduced.
  it("returns non-zero when the only due content is a qualifying new card", () => {
    const newCard = makeCard("u1-c1");
    const unit = makeUnit("u1", [newCard]);
    mockGetState.mockReturnValue(makeState({ canIntroduceNewCard: true, newCardIds: [newCard.id] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(1);
  });

  // Superseded by "flexes past the daily cap" below (BRAND.md: 6-10 interrupts/day, never
  // fewer) — canIntroduceNewCard:false alone no longer means "count 0," since the flex
  // fallback finds the same untouched card and counts it instead.

  it("only counts one new card across all units, even if multiple units have qualifying new cards", () => {
    const cardA = makeCard("u1-c1");
    const cardB = makeCard("u2-c1");
    const unitA = makeUnit("u1", [cardA]);
    const unitB = makeUnit("u2", [cardB]);
    mockGetState.mockReturnValue(
      makeState({ canIntroduceNewCard: true, newCardIds: [cardA.id, cardB.id] })
    );
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unitA, unitB])).toBe(1);
  });

  it("does not count an introduction-due card id that isn't in any passed unit", () => {
    const card = makeCard("u1-c1");
    const unit = makeUnit("u1", [card]);
    mockGetState.mockReturnValue(makeState({ introductionDueIds: [card.id, "not-in-any-unit"] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(1);
  });

  it("sums FSRS-due, introduction-due, and one qualifying new card together", () => {
    const dueCard = makeCard("u1-c1");
    const dueCardUnit = makeUnit("u1", [dueCard]);
    const introCard = makeCard("u2-c1");
    const introUnit = makeUnit("u2", [introCard]);
    const newCard = makeCard("u3-c1");
    const newUnit = makeUnit("u3", [newCard]);
    mockGetState.mockReturnValue(
      makeState({
        dueCardIds: [dueCard.id],
        introductionDueIds: [introCard.id],
        canIntroduceNewCard: true,
        newCardIds: [newCard.id],
      })
    );
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([dueCardUnit, introUnit, newUnit])).toBe(3);
  });

  // Interrupt-floor flex fallback (BRAND.md: 6-10 interrupts/day, never fewer). Deletion Test:
  // without the fallback, this scenario — canIntroduceNewCard false (today's cap already used)
  // but an untouched card still exists in the catalog — returns 0 today, silently skipping the
  // interrupt. The fallback must still find that untouched card and count it.
  it("flexes past the daily cap: counts an untouched card when today's normal supply is otherwise empty", () => {
    const newCard = makeCard("u1-c1");
    const unit = makeUnit("u1", [newCard]);
    mockGetState.mockReturnValue(makeState({ canIntroduceNewCard: false, newCardIds: [newCard.id] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(1);
  });

  it("does not flex when reviews are due — the normal review count already makes the day non-empty", () => {
    const dueCard = makeCard("u1-c1");
    const unit = makeUnit("u1", [dueCard]);
    mockGetState.mockReturnValue(makeState({ dueCardIds: [dueCard.id], canIntroduceNewCard: false, newCardIds: [] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(1); // review count only — no flex needed or applied
  });

  // Batch 23: the session floor can fill with a near-due review pulled slightly early,
  // so the fire-gate must count that scenario too. Deletion Test: without the near-due
  // mirror, this returns 0 and the interrupt never fires despite a servable session.
  it("counts a near-due card when nothing is due, nothing is new, and no untouched card exists (Batch 23)", () => {
    const studied = makeCard("u1-c1");
    const unit = makeUnit("u1", [studied]);
    mockGetState.mockReturnValue(makeState({ canIntroduceNewCard: false, nearDueIds: [studied.id] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(1);
  });

  it("stays at 0 when the flex check also finds no untouched card AND no near-due card anywhere (truly nothing left)", () => {
    const card = makeCard("u1-c1");
    const unit = makeUnit("u1", [card]);
    mockGetState.mockReturnValue(makeState({ canIntroduceNewCard: false, newCardIds: [] }));
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.computeDue([unit])).toBe(0);
  });
});

// Task #529 — userId/deviceId exposure for lib/interruptGate.ts's caller (InterruptHandler.tsx)
describe("useInterruptConfig — userId / deviceId", () => {
  it("returns null for both when signed out with no local device id yet", () => {
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.userId).toBeNull();
    expect(result.current.deviceId).toBeNull();
  });

  it("returns the real userId/deviceId from the underlying stores when present", () => {
    mockUseAuthStore.mockImplementation((selector: (s: { userId: string | null }) => unknown) =>
      selector({ userId: "user-123" })
    );
    mockUseSyncStore.mockImplementation((selector: (s: { deviceId: string | null }) => unknown) =>
      selector({ deviceId: "device-abc" })
    );
    const { result } = renderHook(() => useInterruptConfig());
    expect(result.current.userId).toBe("user-123");
    expect(result.current.deviceId).toBe("device-abc");
  });
});
