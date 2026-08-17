// @vitest-environment jsdom
// ============================================================
// useHydrationStuck.test.ts — Task #644
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHydrationStuck } from "./useHydrationStuck";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useHydrationStuck", () => {
  it("stays false before the timeout elapses while hydratedStrict is false", () => {
    const { result } = renderHook(() => useHydrationStuck(false, 15000));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(14999);
    });
    expect(result.current).toBe(false);
  });

  it("becomes true once the timeout elapses while hydratedStrict stays false", () => {
    const { result } = renderHook(() => useHydrationStuck(false, 15000));
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(result.current).toBe(true);
  });

  it("never becomes true when hydratedStrict is true from the start", () => {
    const { result } = renderHook(() => useHydrationStuck(true, 15000));
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current).toBe(false);
  });

  it("cancels the pending timeout when hydratedStrict flips to true before it elapses", () => {
    const { result, rerender } = renderHook(({ h }) => useHydrationStuck(h, 15000), { initialProps: { h: false } });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    rerender({ h: true });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(false);
  });
});
