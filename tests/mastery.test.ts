import { describe, it, expect } from "vitest";
import { isMastered, MASTERY_STABILITY_DAYS } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";

function progress(overrides: Partial<CardProgress>): CardProgress {
  return {
    cardId: "test",
    state: "new",
    stability: 0,
    difficulty: 5,
    retrievability: 1,
    dueDate: Date.now(),
    lapses: 0,
    reps: 0,
    ...overrides,
  };
}

describe("isMastered()", () => {
  it("returns false for undefined", () => {
    expect(isMastered(undefined)).toBe(false);
  });

  it("returns false for state=new regardless of stability", () => {
    expect(isMastered(progress({ state: "new", stability: 100 }))).toBe(false);
  });

  it("returns false for state=learning regardless of stability", () => {
    expect(isMastered(progress({ state: "learning", stability: 100 }))).toBe(false);
  });

  it("returns false for state=relearning regardless of stability", () => {
    expect(isMastered(progress({ state: "relearning", stability: 100 }))).toBe(false);
  });

  it("returns false for state=review with stability below threshold", () => {
    expect(isMastered(progress({ state: "review", stability: MASTERY_STABILITY_DAYS - 0.1 }))).toBe(false);
  });

  it("returns false for state=review with stability=0", () => {
    expect(isMastered(progress({ state: "review", stability: 0 }))).toBe(false);
  });

  it("returns true for state=review with stability exactly at threshold", () => {
    expect(isMastered(progress({ state: "review", stability: MASTERY_STABILITY_DAYS }))).toBe(true);
  });

  it("returns true for state=review with stability above threshold", () => {
    expect(isMastered(progress({ state: "review", stability: 21 }))).toBe(true);
  });
});

describe("MASTERY_STABILITY_DAYS", () => {
  it("is a positive number", () => {
    expect(MASTERY_STABILITY_DAYS).toBeGreaterThan(0);
  });
});

