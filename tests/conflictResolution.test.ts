import { describe, it, expect } from "vitest";
import { replayLatestEventPerCard } from "@/lib/conflictResolution";
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
      c1: { cardId: "c1", stability: 12, difficulty: 4, dueDate: 5000, lastReview: 1000, reviewCount: 1, lapses: 0 },
    });
  });

  it("two devices reviewing the same card before either syncs — both events counted, latest wins for current state", () => {
    const deviceA = makeEvent({ id: "a", cardId: "c1", reviewedAt: 1000, stability: 10, deviceId: "device-a", rating: 3 });
    const deviceB = makeEvent({ id: "b", cardId: "c1", reviewedAt: 2000, stability: 15, deviceId: "device-b", rating: 4 });
    const result = replayLatestEventPerCard([deviceA, deviceB]);
    // The later event (deviceB, reviewedAt 2000) wins for current stability/dueDate/lastReview —
    // exactly the "no per-field merge, just pick the winner" design from docs/SYNC_ARCHITECTURE.md §4.
    expect(result.c1).toEqual({ cardId: "c1", stability: 15, difficulty: 5, dueDate: 2000, lastReview: 2000, reviewCount: 2, lapses: 0 });
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

  it("lapses is a count(*) where rating === 1 (again), not a stored/incremented field", () => {
    const events = [
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, rating: 1 }), // again
      makeEvent({ id: "2", cardId: "c1", reviewedAt: 200, rating: 3 }), // good
      makeEvent({ id: "3", cardId: "c1", reviewedAt: 300, rating: 1 }), // again
      makeEvent({ id: "4", cardId: "c1", reviewedAt: 400, rating: 4 }), // easy
    ];
    expect(replayLatestEventPerCard(events).c1!.lapses).toBe(2);
  });

  it("groups multiple distinct cards independently — one card's events never affect another's derived state", () => {
    const events = [
      makeEvent({ id: "1", cardId: "c1", reviewedAt: 100, stability: 10, rating: 1 }),
      makeEvent({ id: "2", cardId: "c2", reviewedAt: 200, stability: 20, rating: 3 }),
      makeEvent({ id: "3", cardId: "c1", reviewedAt: 300, stability: 15, rating: 3 }),
    ];
    const result = replayLatestEventPerCard(events);
    expect(Object.keys(result).sort()).toEqual(["c1", "c2"]);
    expect(result.c1).toEqual({ cardId: "c1", stability: 15, difficulty: 5, dueDate: 2000, lastReview: 300, reviewCount: 2, lapses: 1 });
    expect(result.c2).toEqual({ cardId: "c2", stability: 20, difficulty: 5, dueDate: 2000, lastReview: 200, reviewCount: 1, lapses: 0 });
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
