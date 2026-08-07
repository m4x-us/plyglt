import { describe, it, expect } from "vitest";
import { replayLatestEventPerCard, syncedStateToCardProgress, type SyncedCardState } from "@/lib/conflictResolution";
import type { ReviewEvent } from "@/lib/reviewEvent";

function makeEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: "id-1",
    cardId: "c1",
    reviewedAt: 1000,
    rating: 3,
    stability: 10,
    difficulty: 5,
    dueDate: 2000,
    deviceId: "device-1",
    ...overrides,
  };
}

describe("replayLatestEventPerCard", () => {
  it("returns an empty object for an empty event list", () => {
    expect(replayLatestEventPerCard([])).toEqual({});
  });

  it("single event for a single card produces the exact expected SyncedCardState", () => {
    const event = makeEvent({ cardId: "c1", reviewedAt: 1000, rating: 3, stability: 12, difficulty: 4, dueDate: 5000 });
    const result = replayLatestEventPerCard([event]);
    expect(result).toEqual({
      c1: { cardId: "c1", stability: 12, difficulty: 4, dueDate: 5000, lastReview: 1000, reviewCount: 1, lapses: 0, rating: 3, state: "review" },
    });
  });

  it("two devices reviewing the same card before either syncs — both events counted, latest wins for current state", () => {
    const deviceA = makeEvent({ id: "a", cardId: "c1", reviewedAt: 1000, stability: 10, deviceId: "device-a", rating: 3 });
    const deviceB = makeEvent({ id: "b", cardId: "c1", reviewedAt: 2000, stability: 15, deviceId: "device-b", rating: 4 });
    const result = replayLatestEventPerCard([deviceA, deviceB]);
    // The later event (deviceB, reviewedAt 2000) wins for current stability/dueDate/lastReview —
    // exactly the "no per-field merge, just pick the winner" design from docs/SYNC_ARCHITECTURE.md §4.
    expect(result.c1).toEqual({ cardId: "c1", stability: 15, difficulty: 5, dueDate: 2000, lastReview: 2000, reviewCount: 2, lapses: 0, rating: 4, state: "review" });
  });

  it("order of events in the input array does not affect which one wins (latest reviewedAt, not array position)", () => {
    const later = makeEvent({ id: "later", cardId: "c1", reviewedAt: 5000, stability: 99 });
    const earlier = makeEvent({ id: "earlier", cardId: "c1", reviewedAt: 1000, stability: 1 });
    const resultLaterFirst = replayLatestEventPerCard([later, earlier]);
    const resultEarlierFirst = replayLatestEventPerCard([earlier, later]);
    expect(resultLaterFirst.c1!.stability).toBe(99);
    expect(resultEarlierFirst.c1!.stability).toBe(99);
  });

  it("reviewCount is a real count(*) over the merged event set, correct regardless of how many devices wrote concurrently", () => {
    const events = [
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, rating: 3 }),
      makeEvent({ id: "2", cardId: "c1", reviewedAt: 200, rating: 3 }),
      makeEvent({ id: "3", cardId: "c1", reviewedAt: 300, rating: 3 }),
    ];
    expect(replayLatestEventPerCard(events).c1!.reviewCount).toBe(3);
  });

  it("an again rating BEFORE the card ever graduated is not a lapse — it's a learning failure, and state stays 'learning'", () => {
    // A card that fails twice before its first success (common during the introduction
    // engine's intensive Day 1 phase, BRAND.md) never left new/learning per
    // lib/srs.ts's scheduleCard() — a naive count(*) of again-ratings would wrongly
    // count both as lapses and flip state to "relearning". Regression test for that bug.
    const events = [
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, rating: 1 }), // again — still learning
      makeEvent({ id: "2", cardId: "c1", reviewedAt: 200, rating: 1 }), // again — still learning
    ];
    const result = replayLatestEventPerCard(events).c1!;
    expect(result.lapses).toBe(0);
    expect(result.state).toBe("learning");
  });

  it("an again rating AFTER the card has graduated is a real lapse, and state becomes 'relearning'", () => {
    const events = [
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, rating: 1 }), // again — still learning, not a lapse
      makeEvent({ id: "2", cardId: "c1", reviewedAt: 200, rating: 3 }), // good — graduates to review
      makeEvent({ id: "3", cardId: "c1", reviewedAt: 300, rating: 1 }), // again — real lapse, post-graduation
      makeEvent({ id: "4", cardId: "c1", reviewedAt: 400, rating: 4 }), // easy — recovers to review
    ];
    const result = replayLatestEventPerCard(events).c1!;
    // Only the event-3 again counts — event-1's again happened before any graduation.
    expect(result.lapses).toBe(1);
    // Latest event (id 4, easy) is non-again, so the card is back in "review".
    expect(result.state).toBe("review");
  });

  it("chronological order for the graduation walk is by reviewedAt, not array position", () => {
    // Same three events as the "real lapse" case above, but supplied out of order —
    // the graduation walk must sort by reviewedAt itself, not trust input order.
    const events = [
      makeEvent({ id: "3", cardId: "c1", reviewedAt: 300, rating: 1 }),
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, rating: 1 }),
      makeEvent({ id: "2", cardId: "c1", reviewedAt: 200, rating: 3 }),
    ];
    const result = replayLatestEventPerCard(events).c1!;
    expect(result.lapses).toBe(1);
  });

  it("groups multiple distinct cards independently — one card's events never affect another's derived state", () => {
    const events = [
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, stability: 10, rating: 1 }),
      makeEvent({ id: "2", cardId: "c2", reviewedAt: 200, stability: 20, rating: 3 }),
      makeEvent({ id: "3", cardId: "c1", reviewedAt: 300, stability: 15, rating: 3 }),
    ];
    const result = replayLatestEventPerCard(events);
    expect(Object.keys(result).sort()).toEqual(["c1", "c2"]);
    // c1: id-1 (again, still learning — not a lapse) then id-3 (good, graduates). Latest is id-3.
    expect(result.c1).toEqual({ cardId: "c1", stability: 15, difficulty: 5, dueDate: 2000, lastReview: 300, reviewCount: 2, lapses: 0, rating: 3, state: "review" });
    expect(result.c2).toEqual({ cardId: "c2", stability: 20, difficulty: 5, dueDate: 2000, lastReview: 200, reviewCount: 1, lapses: 0, rating: 3, state: "review" });
  });

  it("is pure — calling it twice with the same input produces deep-equal output, and does not mutate the input array", () => {
    const events = [makeEvent({ id: "1", cardId: "c1" }), makeEvent({ id: "2", cardId: "c1", reviewedAt: 2000 })];
    const inputSnapshot = JSON.parse(JSON.stringify(events));
    const first = replayLatestEventPerCard(events);
    const second = replayLatestEventPerCard(events);
    expect(second).toEqual(first);
    expect(events).toEqual(inputSnapshot);
  });
});

function makeSyncedState(overrides: Partial<SyncedCardState> = {}): SyncedCardState {
  return {
    cardId: "c1",
    stability: 12,
    difficulty: 4,
    dueDate: 5000,
    lastReview: 1000,
    reviewCount: 1,
    lapses: 0,
    rating: 3,
    state: "review",
    ...overrides,
  };
}

describe("syncedStateToCardProgress", () => {
  it("carries state/stability/difficulty/dueDate/lapses through unchanged, and reviewCount into reps", () => {
    const state = makeSyncedState({ stability: 12, difficulty: 4, dueDate: 5000, reviewCount: 3, lapses: 1, state: "review" });
    expect(syncedStateToCardProgress(state)).toEqual({
      cardId: "c1", state: "review", stability: 12, difficulty: 4, retrievability: 1, dueDate: 5000, lapses: 1, reps: 3,
    });
  });

  it("carries a 'learning' state through unchanged (not re-derived — replayLatestEventPerCard already computed it correctly)", () => {
    const state = makeSyncedState({ state: "learning" });
    expect(syncedStateToCardProgress(state).state).toBe("learning");
  });

  it("carries a 'relearning' state through unchanged", () => {
    const state = makeSyncedState({ state: "relearning" });
    expect(syncedStateToCardProgress(state).state).toBe("relearning");
  });

  it("sets retrievability to 1 — the next real read recomputes it from dueDate/stability, this is not the authoritative value", () => {
    const state = makeSyncedState();
    expect(syncedStateToCardProgress(state).retrievability).toBe(1);
  });
});
