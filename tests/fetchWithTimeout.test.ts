// === tests/fetchWithTimeout.test.ts ===
// Tests for lib/fetchWithTimeout.ts — bounded fetch() with an independent
// Promise.race backstop (Task #464/#465).

import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { FETCH_TIMEOUT_MS } from "@/lib/constants";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  // Task #465: FETCH_TIMEOUT_MS was previously declared independently in
  // lib/basePackLoader.ts, lib/specialtyPackLoader.ts, and lib/packLoader.ts — 3 copies
  // that could silently drift apart. This pins the ONE shared value; every call site now
  // imports it via lib/fetchWithTimeout.ts rather than declaring its own copy, so drift
  // is structurally impossible (there is only one declaration left to change).
  it("FETCH_TIMEOUT_MS is the single shared 20-second value", () => {
    expect(FETCH_TIMEOUT_MS).toBe(20_000);
  });

  it("resolves with the real fetch's response when it settles before the timeout", async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWithTimeout("https://example.test/pack.json");

    expect(result).toBe(mockResponse);
  });

  it("propagates a real fetch rejection (network error) rather than swallowing it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(fetchWithTimeout("https://example.test/pack.json")).rejects.toThrow("network down");
  });

  it("passes the abort signal to fetch and aborts it after FETCH_TIMEOUT_MS (the fast path)", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise(() => {}); // never settles — but honors the signal, like real fetch
    }));

    const promise = fetchWithTimeout("https://example.test/pack.json");
    // Prevent an unhandled rejection warning while we inspect state before awaiting.
    promise.catch(() => {});

    expect(capturedSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    expect(capturedSignal?.aborted).toBe(true);
  });

  // Task #464: the actual acceptance-criteria test — a fetch that never settles AND never
  // honors the abort signal (a non-conformant implementation, or one whose underlying
  // socket ignores the abort() call entirely) must not hang this function forever. Before
  // this fix, AbortController was the ONLY mechanism — nothing else bounded the operation.
  it("resolves to a timeout error within bounded time even when fetch never settles and never honors abort", async () => {
    vi.useFakeTimers();
    // A fetch that returns a promise which NEVER resolves/rejects — completely ignores
    // the abort signal (does not even read init.signal). This is exactly the pathological
    // case the independent Promise.race backstop exists for.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const promise = fetchWithTimeout("https://example.test/pack.json");
    const assertion = expect(promise).rejects.toThrow(/ERR-FETCH-TIMEOUT-BACKSTOP/);

    // Advancing exactly FETCH_TIMEOUT_MS is enough — the backstop's own independent timer
    // fires at that point regardless of fetch's (non-)behavior.
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await assertion;
  });

  it("clears BOTH the abort timer and the backstop's own timer in the finally block when fetch settles first", async () => {
    // Task #472: the previous version of this test only advanced timers past the timeout
    // after resolution and asserted nothing threw. That proves nothing — Promise.race
    // already attaches a rejection handler to the backstop promise at race-call time, so
    // even an uncleared backstop timer firing later becomes an already-handled rejection
    // with no observable effect (no throw, no unhandled-rejection warning). Spying on
    // setTimeout/clearTimeout directly and asserting clearTimeout was called with the
    // SPECIFIC id setTimeout returned for each timer is the only way to prove the
    // `finally` block's two clearTimeout calls actually ran, rather than assuming it from
    // an absence of side effects.
    //
    // Task #475: #472's rewrite proved only the backstop timer (results[1]) — the abort
    // timer (results[0], cleared by the SAME finally block one line above
    // clearTimeout(backstopTimeoutId!)) was never captured or asserted. Confirmed by the
    // Deletion Test: commenting out clearTimeout(abortTimeoutId) in
    // lib/fetchWithTimeout.ts left this test (and all others in this file) green. Both
    // ids are now asserted, closing that gap.
    vi.useFakeTimers();
    const mockResponse = { ok: true, status: 200 } as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const result = await fetchWithTimeout("https://example.test/pack.json");
    expect(result).toBe(mockResponse);

    // Two independent timers are armed, in this order (lib/fetchWithTimeout.ts): the abort
    // timer first, then the backstop's own timer. Capture BOTH setTimeout calls' returned
    // ids specifically, and assert clearTimeout was called with each one.
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    const abortTimeoutId = setTimeoutSpy.mock.results[0]!.value;
    const backstopTimeoutId = setTimeoutSpy.mock.results[1]!.value;
    expect(clearTimeoutSpy).toHaveBeenCalledWith(abortTimeoutId);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(backstopTimeoutId);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
