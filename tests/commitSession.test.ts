import { describe, it, expect, beforeEach } from "vitest";
import { useSRSStore, localDateStr } from "@/store/srsStore";
import type { ActiveSession } from "@/store/srsStore";

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    unitId: "u1",
    queueIds: ["c1"],
    position: 1,
    sessionCorrect: 1,
    sessionTotal: 1,
    startedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
});

describe("commitSession() — atomicity contract", () => {
  it("updates card progress, activeSession, and streak in a single action", () => {
    const session = makeSession();
    useSRSStore.getState().commitSession("c1", "good", session);
    const s = useSRSStore.getState();
    // Card was rated — a fresh card ("new", reps=0) graduates to "review" with reps=1 on "good".
    expect(s.cards["c1"]?.state).toBe("review");
    expect(s.cards["c1"]?.reps).toBe(1);
    // Session was persisted
    expect(s.activeSession).toEqual(session);
    // Streak was incremented (lastStudiedDate was null → new streak)
    expect(s.streak).toBe(1);
    expect(s.lastStudiedDate).toBe(localDateStr());
  });

  it("all three slices are consistent — no partial application", () => {
    // If any slice were absent, that would indicate the mutations happened in
    // separate set() calls and a crash between them would corrupt state.
    const session = makeSession({ sessionCorrect: 0 });
    useSRSStore.getState().commitSession("c1", "again", session);
    const s = useSRSStore.getState();
    // A fresh card ("new", reps=0) graded "again" stays in "learning" with reps=1.
    expect(s.cards["c1"]?.state).toBe("learning");
    expect(s.cards["c1"]?.reps).toBe(1);
    expect(s.activeSession).toEqual(session);
    expect(s.lastStudiedDate).toBe(localDateStr());
  });

  it("increments streak by 1 when last studied yesterday", () => {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    useSRSStore.setState({ streak: 7, lastStudiedDate: localDateStr(yd) });
    useSRSStore.getState().commitSession("c1", "good", makeSession());
    expect(useSRSStore.getState().streak).toBe(8);
  });

  it("resets streak to 1 when gap is longer than one day", () => {
    useSRSStore.setState({ streak: 42, lastStudiedDate: "2020-01-01" });
    useSRSStore.getState().commitSession("c1", "good", makeSession());
    expect(useSRSStore.getState().streak).toBe(1);
  });

  it("does not increment streak if already studied today", () => {
    const today = localDateStr();
    useSRSStore.setState({ streak: 5, lastStudiedDate: today });
    useSRSStore.getState().commitSession("c1", "good", makeSession());
    useSRSStore.getState().commitSession("c1", "hard", makeSession({ position: 2 }));
    expect(useSRSStore.getState().streak).toBe(5);
  });

  it("persists the exact session object supplied", () => {
    const session = makeSession({ unitId: "b2-unit-10", position: 3, sessionCorrect: 2, sessionTotal: 3 });
    useSRSStore.getState().commitSession("c1", "good", session);
    expect(useSRSStore.getState().activeSession).toEqual(session);
  });
});
