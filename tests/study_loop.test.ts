import { describe, it, expect, beforeEach } from "vitest";
import { useSRSStore, MASTERY_STABILITY_DAYS } from "@/store/srsStore";
import { defaultProgress } from "@/lib/srs";
import type { Card } from "@/content/types";

function card(id: string): Card {
  return { id, type: "produce", prompt: "test", accepted: ["test"], tags: [], tier: 1 };
}

function masteredProgress(id: string) {
  return {
    ...defaultProgress(id),
    state: "review" as const,
    stability: MASTERY_STABILITY_DAYS + 3,
    dueDate: Date.now() + 7 * 86400000, // not due for 7 days
    reps: 3,
  };
}

beforeEach(() => {
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
});

describe("study loop — rate → schedule → due", () => {
  it("new card rated 'again' enters learning state", () => {
    useSRSStore.getState().rateCard("c1", "again");
    expect(useSRSStore.getState().getProgress("c1").state).toBe("learning");
  });

  it("new card rated 'good' graduates directly to review", () => {
    // FSRS v4: no multi-step learning — a non-again rating on a new card graduates immediately
    useSRSStore.getState().rateCard("c1", "good");
    expect(useSRSStore.getState().getProgress("c1").state).toBe("review");
    // Exact FSRS initial stability for a "good" grade on a new card (W[2] in lib/srs.ts).
    expect(useSRSStore.getState().getProgress("c1").stability).toBe(3.1262);
  });

  it("review card rated 'again' goes to relearning with +1 lapse", () => {
    useSRSStore.getState().rateCard("c1", "good"); // new → review
    const p = { ...useSRSStore.getState().getProgress("c1"), dueDate: Date.now() - 1 };
    useSRSStore.setState({ cards: { c1: p } });
    useSRSStore.getState().rateCard("c1", "again"); // review → relearning
    expect(useSRSStore.getState().getProgress("c1").state).toBe("relearning");
    expect(useSRSStore.getState().getProgress("c1").lapses).toBe(1);
  });

  it("review card is not due immediately after a good rating", () => {
    const c = card("c1");
    // stability: 4 days → dueDate is 4 days from now → not due yet
    useSRSStore.setState({
      cards: {
        c1: {
          ...defaultProgress("c1"),
          state: "review",
          stability: 4,
          dueDate: Date.now() + 4 * 86400000,
          reps: 2,
          lapses: 0,
          difficulty: 5,
          retrievability: 0.9,
        },
      },
    });
    expect(useSRSStore.getState().getDueCards([c])).toHaveLength(0);
  });

  it("review card is due when dueDate is in the past", () => {
    const c = card("c1");
    useSRSStore.setState({
      cards: {
        c1: {
          ...defaultProgress("c1"),
          state: "review",
          stability: 4,
          dueDate: Date.now() - 1,
          reps: 2,
          lapses: 0,
          difficulty: 5,
          retrievability: 0.5,
        },
      },
    });
    expect(useSRSStore.getState().getDueCards([c])).toContain("c1");
  });

  it("getStats correctly counts due, learning, and mastered across a mixed unit", () => {
    const cards = [card("c1"), card("c2"), card("c3")];
    useSRSStore.setState({
      cards: {
        c1: masteredProgress("c1"), // review + stability ≥ 7 + not due
        c2: {
          ...defaultProgress("c2"),
          state: "learning",
          stability: 1,
          dueDate: Date.now() - 1, // overdue
          reps: 1,
          lapses: 0,
          difficulty: 5,
          retrievability: 0.9,
        },
        // c3: no entry → new (not started)
      },
    });
    const stats = useSRSStore.getState().getStats(cards);
    expect(stats.due).toBe(1);           // c2 only (c1 not due; c3 has reps=0)
    expect(stats.learning).toBe(1);      // c2
    expect(stats.mastered).toBe(1);      // c1
    expect(stats.total).toBe(3);
    expect(stats.masteryPct).toBe(33);   // Math.round(1/3 * 100) — drives MASTERY_GATE unlock
  });
});
