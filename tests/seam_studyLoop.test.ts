// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSRSStore } from "@/store/srsStore";
import type { ActiveSession } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";
import { buildQueue, INTERRUPT_SESSION_FLOOR } from "@/lib/queue";
import { selectQualifyingNewCard } from "@/lib/srs";
import { ALL_UNITS } from "@/content/index";
import { useStudySession } from "@/hooks/useStudySession";

// Three real Italian cards from the Greetings unit — imported directly
// from content/index.ts with no mocks. Exercises the production data-format
// contract across the full pipeline hand-off.
const UNIT = ALL_UNITS[0]!;
const SAMPLE_CARDS = UNIT.cards.slice(0, 3);

beforeEach(() => {
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
});

describe("seam: session-start → auto-introduction", () => {
  it("auto-introduces one new card when session starts with canIntroduceNewCard true", () => {
    const today = "2026-06-29";
    const { canIntroduceNewCard, introduceCard, getDueCards, getNewCards, getIntroductionDueCardIds, cards, introductions } =
      useSRSStore.getState();

    expect(SAMPLE_CARDS.length).toBeGreaterThanOrEqual(2);
    expect(canIntroduceNewCard(today)).toBe(true);

    // Calls the same production selector hooks/useStudySession.ts uses on mount — this seam
    // test's value is exercising real content (ALL_UNITS) and the real store/buildQueue
    // pipeline, not re-deriving the selection logic (a hand-duplicated copy here previously
    // drifted from production after a Batch 18 fix added prerequisite gating to the real
    // selector but not to this test's inline copy).
    const cardMap = Object.fromEntries(SAMPLE_CARDS.map((c) => [c.id, c]));
    const first = selectQualifyingNewCard(cardMap, cards, introductions);
    if (first) introduceCard(first.id, today);

    // On the next session load buildQueue now includes the introduced card
    // via getIntroductionDueCardIds — the existing wiring in app/study/page.tsx.
    buildQueue(SAMPLE_CARDS, getDueCards, getNewCards, false, getIntroductionDueCardIds);

    expect(Object.keys(useSRSStore.getState().introductions).length).toBeGreaterThanOrEqual(1);
  });
});

describe("seam: content/index.ts cards → buildQueue → rateCardAndSaveSession", () => {
  it("buildQueue returns a non-empty queue from real cards with a fresh store state", () => {
    const { getDueCards, getNewCards } = useSRSStore.getState();
    const queue = buildQueue(SAMPLE_CARDS, getDueCards, getNewCards, false);
    // Fresh store: no due cards, all SAMPLE_CARDS are new and under SESSION_NEW_LIMIT (15).
    expect(queue.length).toBe(SAMPLE_CARDS.length);
    expect(queue.map((c) => c.id)).toEqual(SAMPLE_CARDS.map((c) => c.id));
  });

  it("rateCardAndSaveSession advances card reps to 1 after a good rating", () => {
    const { getDueCards, getNewCards } = useSRSStore.getState();
    const queue = buildQueue(SAMPLE_CARDS, getDueCards, getNewCards, false);
    const firstCard = queue[0]!;
    const session: ActiveSession = {
      unitId: UNIT.id,
      queueIds: queue.map((c) => c.id),
      position: 1,
      sessionCorrect: 1,
      sessionTotal: 1,
      startedAt: Date.now(),
    };
    useSRSStore.getState().rateCardAndSaveSession(firstCard.id, "good", session);
    expect(useSRSStore.getState().cards[firstCard.id]!.reps).toBe(1);
  });

  it("rateCardAndSaveSession persists the active session with position === 1", () => {
    const { getDueCards, getNewCards } = useSRSStore.getState();
    const queue = buildQueue(SAMPLE_CARDS, getDueCards, getNewCards, false);
    const firstCard = queue[0]!;
    const session: ActiveSession = {
      unitId: UNIT.id,
      queueIds: queue.map((c) => c.id),
      position: 1,
      sessionCorrect: 1,
      sessionTotal: 1,
      startedAt: Date.now(),
    };
    useSRSStore.getState().rateCardAndSaveSession(firstCard.id, "good", session);
    expect(useSRSStore.getState().activeSession?.position).toBe(1);
  });

  it("recordIntroductionResult increments totalEncounters to 1 after the first result", () => {
    const { introduceCard, recordIntroductionResult } = useSRSStore.getState();
    const cardId = SAMPLE_CARDS[0]!.id;
    const today = "2026-06-28";
    introduceCard(cardId, today);
    recordIntroductionResult(cardId, true, today);
    expect(useSRSStore.getState().introductions[cardId]!.totalEncounters).toBe(1);
  });

  it("rateCardAndSaveSession is atomic — reps and session.position update in the same store tick", () => {
    const { getDueCards, getNewCards } = useSRSStore.getState();
    const queue = buildQueue(SAMPLE_CARDS, getDueCards, getNewCards, false);
    const firstCard = queue[0]!;
    const session: ActiveSession = {
      unitId: UNIT.id,
      queueIds: queue.map((c) => c.id),
      position: 1,
      sessionCorrect: 1,
      sessionTotal: 1,
      startedAt: Date.now(),
    };

    // Capture every intermediate state the store transitions through.
    // rateCardAndSaveSession calls set() exactly once — both fields must
    // appear in the same snapshot with no partial-write snapshot in between.
    const snapshots: Array<{ reps: number | undefined; position: number | undefined }> = [];
    const unsub = useSRSStore.subscribe((state) => {
      snapshots.push({
        reps: state.cards[firstCard.id]?.reps,
        position: state.activeSession?.position,
      });
    });
    useSRSStore.getState().rateCardAndSaveSession(firstCard.id, "good", session);
    unsub();

    // rateCardAndSaveSession's single set() call produces exactly one snapshot — more than
    // one would mean the update isn't atomic (a partial write followed by a second set()).
    expect(snapshots.length).toBe(1);
    // No snapshot should show reps updated without position — that is a partial write
    const partialWrite = snapshots.find((s) => (s.reps ?? 0) > 0 && s.position === undefined);
    expect(partialWrite).toBeUndefined();
    // Final snapshot confirms both fields settled to the expected values
    const final = snapshots[snapshots.length - 1]!;
    expect(final.reps).toBe(1);
    expect(final.position).toBe(1);
  });
});

// Task #543: neither app/study/page.tsx nor hooks/useStudySession.ts had a single test
// exercising the REAL interrupt-floor fill pipeline end to end — app/study/page.test.tsx
// mocks useStudySession entirely, and hooks/useStudySession.test.ts mocks getNearDueCards
// entirely (both by design, for their own unit-level concerns). This seam test wires the
// real useStudySession hook against real store/srsStore.ts actions (no mocked getNearDueCards,
// no mocked canIntroduceNewCard/introduceCard) via a minimal renderHook harness, proving the
// Batch 23 interrupt-session floor actually reaches INTERRUPT_SESSION_FLOOR (6) cards with no
// intermediate layer faked (Rule 13/Rule 20).
describe("seam: interrupt-session floor-fill — real useStudySession + real srsStore", () => {
  it("fills an empty interrupt-mode initialQueue to the real INTERRUPT_SESSION_FLOOR via real near-due cards", () => {
    const nearDueCards = UNIT.cards.slice(0, INTERRUPT_SESSION_FLOOR);
    expect(nearDueCards).toHaveLength(INTERRUPT_SESSION_FLOOR);
    const allCardMap = Object.fromEntries(nearDueCards.map((c) => [c.id, c]));

    // Real progress for each: reps > 0 (already studied) and dueDate a day in the future
    // (not yet due) — exactly what store/srsStore.ts's real getNearDueCards filters for.
    // Every one of these cards also has progress, so lib/srs.ts's real
    // selectQualifyingNewCard finds nothing to introduce (`!cards[c.id]` excludes them) —
    // isolating this test to the near-due fill path specifically.
    const progress: Record<string, CardProgress> = Object.fromEntries(
      nearDueCards.map((c) => [c.id, {
        cardId: c.id,
        state: "review",
        stability: 10,
        difficulty: 5,
        retrievability: 0.9,
        dueDate: Date.now() + 24 * 60 * 60 * 1000,
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
        getNearDueCards: (limit) => store.getNearDueCards(nearDueCards, limit),
        cards: store.cards,
        introductions: store.introductions,
        enqueueReviewEvent: vi.fn(),
      })
    );

    expect(result.current.queue).toHaveLength(INTERRUPT_SESSION_FLOOR);
    expect(result.current.queue.map((c) => c.id).sort()).toEqual(nearDueCards.map((c) => c.id).sort());
  });
});
