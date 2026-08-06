import { describe, it, expect, beforeEach } from "vitest";
import { useSyncStore } from "@/store/syncStore";
import type { CardProgress } from "@/lib/srs";

function makeProgress(overrides: Partial<CardProgress> = {}): CardProgress {
  return {
    cardId: "a1u01-t1-001",
    state: "review",
    stability: 12.5,
    difficulty: 4.2,
    retrievability: 0.91,
    dueDate: 1893456000000,
    lapses: 1,
    reps: 6,
    ...overrides,
  };
}

beforeEach(() => {
  useSyncStore.setState({ deviceId: null, pendingEvents: [] });
});

describe("useSyncStore — defaults", () => {
  it("starts with deviceId null and an empty pendingEvents array", () => {
    const s = useSyncStore.getState();
    expect(s.deviceId).toBe(null);
    expect(s.pendingEvents).toEqual([]);
  });
});

describe("enqueueReviewEvent", () => {
  it("generates and persists a deviceId on the first call", () => {
    useSyncStore.getState().enqueueReviewEvent("c1", "good", makeProgress());
    const deviceId = useSyncStore.getState().deviceId;
    expect(typeof deviceId).toBe("string");
    expect(deviceId!.length).toBeGreaterThan(0);
  });

  it("reuses the same deviceId across multiple calls rather than generating a new one each time", () => {
    useSyncStore.getState().enqueueReviewEvent("c1", "good", makeProgress());
    const firstDeviceId = useSyncStore.getState().deviceId;
    useSyncStore.getState().enqueueReviewEvent("c2", "hard", makeProgress());
    const secondDeviceId = useSyncStore.getState().deviceId;
    expect(secondDeviceId).toBe(firstDeviceId);
  });

  it("appends a review event with the correct cardId, rating, and resulting CardProgress fields", () => {
    const progress = makeProgress({ stability: 30, difficulty: 2.5, dueDate: 1900000000000 });
    useSyncStore.getState().enqueueReviewEvent("a1u01-t1-005", "easy", progress);
    const events = useSyncStore.getState().pendingEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      cardId: "a1u01-t1-005",
      rating: 4, // "easy" per GRADE_TO_RATING
      stability: 30,
      difficulty: 2.5,
      dueDate: 1900000000000,
    });
  });

  it("appends to the existing queue rather than replacing it — two reviews produce two events", () => {
    useSyncStore.getState().enqueueReviewEvent("c1", "good", makeProgress());
    useSyncStore.getState().enqueueReviewEvent("c2", "again", makeProgress());
    const events = useSyncStore.getState().pendingEvents;
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.cardId)).toEqual(["c1", "c2"]);
  });

  it("each enqueued event gets a distinct client-generated id, even for the same card reviewed twice", () => {
    useSyncStore.getState().enqueueReviewEvent("c1", "good", makeProgress());
    useSyncStore.getState().enqueueReviewEvent("c1", "hard", makeProgress());
    const events = useSyncStore.getState().pendingEvents;
    expect(events[0]!.id).not.toBe(events[1]!.id);
  });
});
