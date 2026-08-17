// @vitest-environment jsdom
// ============================================================
// useHydrationStuck.test.ts — Task #644, generalized round-7 (packLoading gap fix)
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHydrationStuck, HYDRATION_STUCK_TIMEOUT_MS } from "./useHydrationStuck";

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

  // Round-9 audit finding (Agent A / Agent W / Agent K, 3-way convergent, Rule 18):
  // every test above passes an explicit timeoutMs override (15000) — none exercises
  // the hook's actual DEFAULT parameter, so nothing in this file would fail if
  // HYDRATION_STUCK_TIMEOUT_MS itself silently regressed (confirmed via a live
  // Deletion Test: reverting the round-8 45000ms value back to 15000ms left every
  // test in this file, and app/study/page.test.tsx's hydration-stuck tests, green).
  // This test calls the hook with no second argument — the real production shape
  // (app/study/page.tsx: useHydrationStuck(stillLoading), no override) — and pins
  // the boundary against the imported constant, not a re-typed literal.
  it("uses HYDRATION_STUCK_TIMEOUT_MS as its default when no timeoutMs override is passed", () => {
    // Pin the exact expected value first — a test that only derives its timer
    // boundaries FROM the imported constant (advanceTimersByTime(TIMEOUT - 1)/
    // (TIMEOUT)) is tautological: it moves with the constant and can never catch
    // a regression of the constant's own value. This assertion is the one that
    // actually locks 15000 in; deleting/changing it is what a Deletion Test on
    // this test must target, not the relative-boundary assertions below.
    expect(HYDRATION_STUCK_TIMEOUT_MS).toBe(15000);

    const { result } = renderHook(() => useHydrationStuck(true));
    act(() => {
      vi.advanceTimersByTime(HYDRATION_STUCK_TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
