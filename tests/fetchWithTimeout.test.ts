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

  it("the backstop timer does not fire (no unhandled rejection) when fetch settles first", async () => {
    vi.useFakeTimers();
    const mockResponse = { ok: true, status: 200 } as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWithTimeout("https://example.test/pack.json");
    expect(result).toBe(mockResponse);

    // Advancing time past the timeout after resolution must not throw or reject anything —
    // the backstop's timer was cleared in the `finally` block.
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1000);
  });
});
