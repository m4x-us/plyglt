import { describe, it, expect, beforeEach } from "vitest";
import { useSRSStore } from "@/store/srsStore";
import type { ActiveSession } from "@/store/srsStore";
import { buildQueue } from "@/lib/queue";
import { ALL_UNITS } from "@/content/index";

// Three real Italian cards from the Greetings unit — imported directly
// from content/index.ts with no mocks. Exercises the production data-format
// contract across the full pipeline hand-off.
const UNIT = ALL_UNITS[0]!;
const SAMPLE_CARDS = UNIT.cards.slice(0, 3);

beforeEach(() => {
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
});

describe("seam: pack load → buildQueue → rateCard → saveActiveSession", () => {
  it("buildQueue returns a non-empty queue from real cards with a fresh store state", () => {
    const { getDueCards, getNewCards } = useSRSStore.getState();
    const queue = buildQueue(SAMPLE_CARDS, getDueCards, getNewCards, false);
    expect(queue.length).toBeGreaterThan(0);
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

    expect(snapshots.length).toBeGreaterThan(0);
    // No snapshot should show reps updated without position — that is a partial write
    const partialWrite = snapshots.find((s) => (s.reps ?? 0) > 0 && s.position === undefined);
    expect(partialWrite).toBeUndefined();
    // Final snapshot confirms both fields settled to the expected values
    const final = snapshots[snapshots.length - 1]!;
    expect(final.reps).toBe(1);
    expect(final.position).toBe(1);
  });
});
