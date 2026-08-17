// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSRSStore } from "@/store/srsStore";
import type { ActiveSession } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";
import type { Unit } from "@/content/types";
import { buildQueue, INTERRUPT_SESSION_FLOOR, INTERRUPT_SESSION_CAP } from "@/lib/queue";
import { selectQualifyingNewCard } from "@/lib/srs";
import { ALL_UNITS } from "@/content/index";
import { useStudySession } from "@/hooks/useStudySession";
import { useStudyQueueSetup } from "@/hooks/useStudyQueueSetup";

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

    // Task #571: introduceCard() is called at most once above (guarded by `if (first)`), and
    // the store started with introductions:{} (beforeEach) — the exact count is provable, not
    // just a lower bound. A subtly wrong implementation that introduced multiple cards per
    // mount (violating the one-new-card-per-day cap this feature exists to enforce) would
    // still pass a >= 1 assertion but must fail an exact one.
    expect(Object.keys(useSRSStore.getState().introductions).length).toBe(1);
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
        // Task #608 (Wave 6, hooks/useStudySession.ts): new required params after
        // migrating resume-decision resolution to the render-safe pair.
        peekResumableSession: store.peekResumableSession,
        clearExpiredResumableSession: store.clearExpiredResumableSession,
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

// Task #536: the seam test above (Task #543, Wave 1) proves the hook-to-store seam —
// it hands useStudySession a hand-picked `nearDueCards` array and a hardcoded empty
// initialQueue, never exercising the layer ABOVE the hook. Nothing proved that
// app/study/page.tsx's own wiring — real buildQueue(allCards, ...) feeding the
// INTERRUPT_SESSION_CAP slice into initialQueue, and the
// `getNearDueCards: (limit) => getNearDueCards(allCards, limit)` closure binding over
// that SAME `allCards` variable — is itself correct.
//
// Task #616 (Wave 7): the two tests below originally hand-copied the
// `isInterrupt ? full.slice(0, INTERRUPT_SESSION_CAP) : full` expression inline instead
// of exercising the real source — a Rule 18/B7 failure (deleting the real page-level
// slice line didn't fail either test). Wave 6's Task #612 extracted that exact
// computation out of app/study/page.tsx into hooks/useStudyQueueSetup.ts specifically so
// a test like this could import and call the real function instead. Both tests now do
// exactly that: renderHook(() => useStudyQueueSetup({...})) computes the real
// initialQueue/allCardMap/allCards, which then feed into useStudySession below — no
// hand-copied slice expression anywhere in this describe block anymore.
describe("seam: app/study/page.tsx wiring (buildQueue -> INTERRUPT_SESSION_CAP slice -> useStudySession) — real store", () => {
  it("caps a real FSRS-due backlog at INTERRUPT_SESSION_CAP via the page's own buildQueue+slice sequence, with no flex-fill needed", () => {
    // 12 real cards, all already due (reps>0, dueDate in the past) — exactly
    // page.tsx's `allCards` for an interrupt/global session (isGlobal || isInterrupt).
    const twelveCards = UNIT.cards.slice(0, 12);
    expect(twelveCards).toHaveLength(12);
    const progress: Record<string, CardProgress> = Object.fromEntries(
      twelveCards.map((c) => [c.id, {
        cardId: c.id,
        state: "review",
        stability: 10,
        difficulty: 5,
        retrievability: 0.9,
        dueDate: Date.now() - 60_000, // already ready
        lapses: 0,
        reps: 1,
      } satisfies CardProgress])
    );
    useSRSStore.setState({ cards: progress, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
    const store = useSRSStore.getState();

    const isGlobal = false;
    const isInterrupt = true;
    // Sanity check that buildQueue itself returns every due card unsliced — the real
    // backlog this scenario is meant to exercise (Task #544's server-side ceiling fix
    // has its own client-side counterpart proven right here: buildQueue does not itself
    // cap). This is a direct, independent call to the real buildQueue — not what feeds
    // useStudySession below, which instead comes from the real useStudyQueueSetup hook.
    const full = buildQueue(twelveCards, store.getDueCards, store.getNewCards, isGlobal || isInterrupt, store.getIntroductionDueCardIds);
    expect(full).toHaveLength(12);

    // A single fake unit wrapping the 12-card slice — real useStudyQueueSetup, not a
    // hand-copied reconstruction of its slice logic (Task #616).
    const fakeUnit: Unit = { ...UNIT, cards: twelveCards };
    const { result: setupResult } = renderHook(() =>
      useStudyQueueSetup({
        isGlobal,
        isInterrupt,
        unitId: "",
        allUnits: [fakeUnit],
        unitMap: { [fakeUnit.id]: fakeUnit },
        cards: store.cards,
        getDueCards: store.getDueCards,
        getNewCards: store.getNewCards,
        getIntroductionDueCardIds: store.getIntroductionDueCardIds,
      })
    );
    expect(setupResult.current.initialQueue).toHaveLength(INTERRUPT_SESSION_CAP);

    const { result } = renderHook(() =>
      useStudySession({
        initialQueue: setupResult.current.initialQueue,
        allCardMap: setupResult.current.allCardMap,
        isGlobal,
        isInterrupt,
        unitId: "",
        getResumableSession: store.getResumableSession,
        // Task #608 (Wave 6, hooks/useStudySession.ts): new required params after
        // migrating resume-decision resolution to the render-safe pair.
        peekResumableSession: store.peekResumableSession,
        clearExpiredResumableSession: store.clearExpiredResumableSession,
        clearActiveSession: store.clearActiveSession,
        commitSession: store.commitSession,
        canIntroduceNewCard: store.canIntroduceNewCard,
        introduceCard: store.introduceCard,
        // page.tsx's exact binding shape — closes over the SAME `allCards` reference
        // useStudyQueueSetup itself computed and returned, not a pre-filtered subset.
        getNearDueCards: (limit) => store.getNearDueCards(setupResult.current.allCards, limit),
        cards: store.cards,
        introductions: store.introductions,
        enqueueReviewEvent: vi.fn(),
      })
    );

    // Already at the cap — the mount-effect fill pass only triggers below
    // INTERRUPT_SESSION_FLOOR (hooks/useStudySession.ts), so no near-due/new-card
    // padding should occur here.
    expect(result.current.queue).toHaveLength(INTERRUPT_SESSION_CAP);
  });

  it("fills a real starved interrupt session (buildQueue -> empty) to INTERRUPT_SESSION_FLOOR via the page's own allCards-bound getNearDueCards closure", () => {
    // A wider real allCards pool than the fill target (Charles's Task #543 test used
    // an allCards set exactly equal to the near-due pool it expected back — this test
    // uses a pool larger than INTERRUPT_SESSION_FLOOR to prove getNearDueCards' own
    // nearest-due-first selection, sourced through page.tsx's real shared `allCards`
    // variable, not a hand-trimmed stand-in).
    const tenCards = UNIT.cards.slice(0, 10);
    expect(tenCards).toHaveLength(10);
    const progress: Record<string, CardProgress> = Object.fromEntries(
      tenCards.map((c, i) => [c.id, {
        cardId: c.id,
        state: "review",
        stability: 10,
        difficulty: 5,
        retrievability: 0.9,
        // Not yet due for any of them, staggered so the nearest-6 are deterministic.
        dueDate: Date.now() + (i + 1) * 60 * 60 * 1000,
        lapses: 0,
        reps: 1,
      } satisfies CardProgress])
    );
    useSRSStore.setState({ cards: progress, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
    const store = useSRSStore.getState();

    const isGlobal = false;
    const isInterrupt = true;
    // Sanity check, same reasoning as the sibling test above: direct, independent call
    // to the real buildQueue, not what feeds useStudySession below.
    const full = buildQueue(tenCards, store.getDueCards, store.getNewCards, isGlobal || isInterrupt, store.getIntroductionDueCardIds);
    // No card is due, globalMode (isGlobal || isInterrupt) blocks new-card selection
    // inside buildQueue itself, and there are no pending introductions — the page's
    // own buildQueue call genuinely starves here, exactly the cold-start/backlog-return
    // scenario the interrupt-floor fill pipeline exists for.
    expect(full).toHaveLength(0);

    const fakeUnit: Unit = { ...UNIT, cards: tenCards };
    const { result: setupResult } = renderHook(() =>
      useStudyQueueSetup({
        isGlobal,
        isInterrupt,
        unitId: "",
        allUnits: [fakeUnit],
        unitMap: { [fakeUnit.id]: fakeUnit },
        cards: store.cards,
        getDueCards: store.getDueCards,
        getNewCards: store.getNewCards,
        getIntroductionDueCardIds: store.getIntroductionDueCardIds,
      })
    );
    expect(setupResult.current.initialQueue).toHaveLength(0);

    const { result } = renderHook(() =>
      useStudySession({
        initialQueue: setupResult.current.initialQueue,
        allCardMap: setupResult.current.allCardMap,
        isGlobal,
        isInterrupt,
        unitId: "",
        getResumableSession: store.getResumableSession,
        // Task #608 (Wave 6, hooks/useStudySession.ts): new required params after
        // migrating resume-decision resolution to the render-safe pair.
        peekResumableSession: store.peekResumableSession,
        clearExpiredResumableSession: store.clearExpiredResumableSession,
        clearActiveSession: store.clearActiveSession,
        commitSession: store.commitSession,
        canIntroduceNewCard: store.canIntroduceNewCard,
        introduceCard: store.introduceCard,
        getNearDueCards: (limit) => store.getNearDueCards(setupResult.current.allCards, limit),
        cards: store.cards,
        introductions: store.introductions,
        enqueueReviewEvent: vi.fn(),
      })
    );

    expect(result.current.queue).toHaveLength(INTERRUPT_SESSION_FLOOR);
    // The 6 nearest-due cards (soonest dueDate first) out of the 10-card allCards
    // pool — proving the real store's sort-by-dueDate selection ran against the
    // full pool the page-level closure actually exposes, not a pre-trimmed stand-in.
    const expectedIds = tenCards.slice(0, INTERRUPT_SESSION_FLOOR).map((c) => c.id).sort();
    expect(result.current.queue.map((c) => c.id).sort()).toEqual(expectedIds);
  });
});
