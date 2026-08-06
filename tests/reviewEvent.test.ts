import { describe, it, expect } from "vitest";
import { createReviewEvent, GRADE_TO_RATING } from "@/lib/reviewEvent";
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

describe("GRADE_TO_RATING", () => {
  it("maps all 4 FSRS grades to their exact numeric rating", () => {
    expect(GRADE_TO_RATING.again).toBe(1);
    expect(GRADE_TO_RATING.hard).toBe(2);
    expect(GRADE_TO_RATING.good).toBe(3);
    expect(GRADE_TO_RATING.easy).toBe(4);
  });

  it("is frozen — mutation attempts throw in strict mode", () => {
    expect(() => {
      "use strict";
      (GRADE_TO_RATING as Record<string, number>).again = 99;
    }).toThrow();
  });
});

describe("createReviewEvent", () => {
  it("builds an event with every field mapped correctly from the resulting CardProgress", () => {
    const progress = makeProgress({ stability: 20, difficulty: 3.5, dueDate: 1893999999999 });
    const event = createReviewEvent("a1u01-t1-001", "good", progress, "device-abc", 1700000000000, "event-id-1");
    expect(event).toEqual({
      id: "event-id-1",
      cardId: "a1u01-t1-001",
      reviewedAt: 1700000000000,
      rating: 3,
      stability: 20,
      difficulty: 3.5,
      dueDate: 1893999999999,
      deviceId: "device-abc",
    });
  });

  it("maps grade 'again' to rating 1", () => {
    const event = createReviewEvent("c1", "again", makeProgress(), "d1", 0, "id1");
    expect(event.rating).toBe(1);
  });

  it("maps grade 'easy' to rating 4", () => {
    const event = createReviewEvent("c1", "easy", makeProgress(), "d1", 0, "id1");
    expect(event.rating).toBe(4);
  });

  it("is pure — same inputs produce a deep-equal event on repeated calls", () => {
    const progress = makeProgress();
    const first = createReviewEvent("c1", "hard", progress, "d1", 500, "id1");
    const second = createReviewEvent("c1", "hard", progress, "d1", 500, "id1");
    expect(second).toEqual(first);
  });
});
