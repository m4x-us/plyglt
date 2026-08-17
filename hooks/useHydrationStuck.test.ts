// @vitest-environment jsdom
// ============================================================
// useHydrationStuck.test.ts — Task #644, generalized round-7 (packLoading gap fix)
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
  it("stays false before the timeout elapses while blocked stays true", () => {
    const { result } = renderHook(() => useHydrationStuck(true, 15000));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(14999);
    });
    expect(result.current).toBe(false);
  });

  it("becomes true once the timeout elapses while blocked stays true", () => {
    const { result } = renderHook(() => useHydrationStuck(true, 15000));
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(result.current).toBe(true);
  });

  it("never becomes true when blocked is false from the start", () => {
    const { result } = renderHook(() => useHydrationStuck(false, 15000));
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current).toBe(false);
  });

  it("cancels the pending timeout when blocked flips to false before it elapses", () => {
    const { result, rerender } = renderHook(({ b }) => useHydrationStuck(b, 15000), { initialProps: { b: true } });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    rerender({ b: false });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(false);
  });

  // Round-7 audit finding (Agent W "F-NEW-4" / Red Agent R CHAOS+CONTRACT, convergent):
  // the original version of this hook took only `hydratedStrict` as input, but its real
  // caller (app/study/page.tsx) gates its loading screen on a 3-way OR
  // (!hydrated || packLoading || !hydratedStrict). A version scoped to hydratedStrict
  // alone never observed a stuck packLoading condition at all — this test proves the
  // generalized `blocked` parameter correctly tracks whichever composite condition the
  // caller passes in, not a hardcoded hydration-only signal.
  it("becomes true after the timeout when the caller's real gate stays blocked via packLoading alone, even though hydratedStrict already resolved", () => {
    // Mirrors app/study/page.tsx's real gate: hydrated=true, hydratedStrict=true
    // (hydration itself resolved quickly)... but packLoading=true (the pack fetch
    // is the one still stuck) keeps the composite condition blocked.
    const composite = (hydrated: boolean, packLoading: boolean, hydratedStrict: boolean) =>
      !hydrated || packLoading || !hydratedStrict;
    const { result, rerender } = renderHook(
      ({ blocked }) => useHydrationStuck(blocked, 15000),
      { initialProps: { blocked: composite(true, true, true) } },
    );
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    // Deletion Test: a hook scoped to `hydratedStrict` alone (the pre-round-7 shape)
    // would have returned early on `if (hydratedStrict) return;` at mount — since
    // hydratedStrict is true here — and never started this timer at all, so `stuck`
    // would incorrectly stay false forever despite the composite condition remaining
    // blocked for the full 15s via packLoading.
    expect(result.current).toBe(true);
    rerender({ blocked: composite(true, false, true) }); // packLoading now resolved too
  });
});
