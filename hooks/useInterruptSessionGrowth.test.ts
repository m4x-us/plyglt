// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInterruptSessionGrowth } from "./useInterruptSessionGrowth";
import type { Card } from "@/content/types";

function makeCard(id: string): Card {
  return { id, type: "produce", prompt: "p", accepted: ["a"], tags: [], tier: 1 };
}

describe("useInterruptSessionGrowth", () => {
  it("returns the same queue reference (no-op) when isInterrupt is false, even with time and cap room", () => {
    const getNearDueCards = vi.fn(() => [makeCard("x")]);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));
    const queue = [makeCard("a")];
    const grown = result.current(false, queue, Date.now(), 60);
    expect(grown).toBe(queue);
    expect(getNearDueCards).not.toHaveBeenCalled();
  });

  it("appends one near-due card when isInterrupt is true and time remains", () => {
    const getNearDueCards = vi.fn(() => [makeCard("x")]);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));
    const queue = [makeCard("a")];
    const sessionStartedAt = Date.now();
    const grown = result.current(true, queue, sessionStartedAt, 60);
    expect(grown).toEqual([makeCard("a"), makeCard("x")]);
  });

  it("returns the same queue reference once the time budget has elapsed", () => {
    const getNearDueCards = vi.fn(() => [makeCard("x")]);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));
    const queue = [makeCard("a")];
    const sessionStartedAt = Date.now() - 61_000; // 61s ago, past a 60s budget
    const grown = result.current(true, queue, sessionStartedAt, 60);
    expect(grown).toBe(queue);
  });

  it("returns the same queue reference when no near-due candidate is available", () => {
    const getNearDueCards = vi.fn(() => [] as Card[]);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));
    const queue = [makeCard("a")];
    const grown = result.current(true, queue, Date.now(), 60);
    expect(grown).toBe(queue);
  });

  it("skips a near-due candidate already present in the queue and picks the next one", () => {
    const getNearDueCards = vi.fn(() => [makeCard("a"), makeCard("b")]);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));
    const queue = [makeCard("a")]; // "a" already queued — must not be re-added
    const grown = result.current(true, queue, Date.now(), 60);
    expect(grown).toEqual([makeCard("a"), makeCard("b")]);
  });

  // Cost control: getNearDueCards scans+sorts the entire cross-unit catalog — calling it
  // fresh on every growth trigger would multiply that cost by up to the growth cap instead
  // of paying it once per session. Deletion Test: removing the ref-caching in
  // useInterruptSessionGrowth.ts makes this test fail (call count would be 3, not 1).
  it("calls getNearDueCards at most once across multiple growth triggers in the same hook instance", () => {
    const getNearDueCards = vi.fn(() => [makeCard("x"), makeCard("y"), makeCard("z")]);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));

    let queue = [makeCard("a")];
    queue = result.current(true, queue, Date.now(), 60);
    queue = result.current(true, queue, Date.now(), 60);
    queue = result.current(true, queue, Date.now(), 60);

    expect(queue.map((c) => c.id)).toEqual(["a", "x", "y", "z"]);
    expect(getNearDueCards).toHaveBeenCalledTimes(1);
  });

  it("respects INTERRUPT_SESSION_GROWTH_CAP even with a very large time budget remaining", () => {
    const manyNearDue = Array.from({ length: 30 }, (_, i) => makeCard(`nd${i}`));
    const getNearDueCards = vi.fn(() => manyNearDue);
    const { result } = renderHook(() => useInterruptSessionGrowth(getNearDueCards));

    let queue: Card[] = Array.from({ length: 19 }, (_, i) => makeCard(`q${i}`)); // 19, one below the cap (20)
    queue = result.current(true, queue, Date.now(), 120); // grows to 20 — at the cap
    expect(queue).toHaveLength(20);
    queue = result.current(true, queue, Date.now(), 120); // must not exceed the cap
    expect(queue).toHaveLength(20);
  });
});
