// @vitest-environment jsdom
// ============================================================
// hooks/useSync.test.ts — behavioral tests for useSync's upload/download/merge orchestration
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReviewEvent } from "@/lib/reviewEvent";

const { mockUploadReviewEvents, mockDownloadReviewEvents } = vi.hoisted(() => ({
  mockUploadReviewEvents: vi.fn(),
  mockDownloadReviewEvents: vi.fn(),
}));
vi.mock("@/lib/syncClient", () => ({
  uploadReviewEvents: mockUploadReviewEvents,
  downloadReviewEvents: mockDownloadReviewEvents,
}));

// conflictResolution.ts is left unmocked deliberately — it's pure, and using the
// real replay/mapping logic gives genuine coverage of the download+merge path,
// not just proof that the mocked pieces were called.

const mockAuthState = vi.hoisted(() => ({ status: "signed-in" as "signed-in" | "signed-out" | "loading", userId: "user-1" as string | null }));
vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

const mockSyncState = vi.hoisted(() => ({
  pendingEvents: [] as ReviewEvent[],
  lastSyncedAt: null as number | null,
  lastSyncError: null as string | null,
}));
const mockSyncSetState = vi.hoisted(() => vi.fn());
vi.mock("@/store/syncStore", () => ({
  useSyncStore: {
    getState: () => mockSyncState,
    // Supports both the plain-object and updater-function forms of Zustand's setState —
    // hooks/useSync.ts uses the function form specifically so the race-condition fix
    // (filtering against CURRENT pendingEvents, not the pre-await snapshot) is testable.
    setState: (
      updater: Partial<typeof mockSyncState> | ((s: typeof mockSyncState) => Partial<typeof mockSyncState>)
    ) => {
      const patch = typeof updater === "function" ? updater(mockSyncState) : updater;
      mockSyncSetState(patch);
      Object.assign(mockSyncState, patch);
    },
  },
}));

const mockSRSState = vi.hoisted(() => ({ cards: {} as Record<string, unknown> }));
const mockSRSSetState = vi.hoisted(() => vi.fn());
vi.mock("@/store/srsStore", () => ({
  useSRSStore: {
    getState: () => mockSRSState,
    setState: (updater: (s: typeof mockSRSState) => Partial<typeof mockSRSState>) => {
      const patch = updater(mockSRSState);
      mockSRSSetState(patch);
      Object.assign(mockSRSState, patch);
    },
  },
}));

import { useSync } from "@/hooks/useSync";

function makeEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: "event-1", cardId: "c1", reviewedAt: 1000, rating: 3,
    stability: 12, difficulty: 4, dueDate: 5000, deviceId: "device-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState.status = "signed-in";
  mockAuthState.userId = "user-1";
  mockSyncState.pendingEvents = [];
  mockSyncState.lastSyncedAt = null;
  mockSyncState.lastSyncError = null;
  mockSRSState.cards = {};
  mockDownloadReviewEvents.mockResolvedValue({ ok: true, events: [] });
  mockUploadReviewEvents.mockResolvedValue({ ok: true });
});

describe("useSync — not signed in", () => {
  it("returns ok:false without calling upload or download", async () => {
    mockAuthState.status = "signed-out";
    mockAuthState.userId = null;
    const { result } = renderHook(() => useSync());

    const outcome = await result.current.syncNow();

    expect(outcome).toEqual({ ok: false, error: "Not signed in." });
    expect(mockUploadReviewEvents).not.toHaveBeenCalled();
    expect(mockDownloadReviewEvents).not.toHaveBeenCalled();
  });
});

describe("useSync — signed in, no pending events", () => {
  it("skips the upload call entirely and goes straight to download", async () => {
    const { result } = renderHook(() => useSync());
    const outcome = await result.current.syncNow();

    expect(mockUploadReviewEvents).not.toHaveBeenCalled();
    expect(mockDownloadReviewEvents).toHaveBeenCalledWith("user-1");
    expect(outcome).toEqual({ ok: true });
  });
});

describe("useSync — upload path", () => {
  it("uploads pending events with the signed-in user's id and clears the local queue on success", async () => {
    const event = makeEvent();
    mockSyncState.pendingEvents = [event];
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect(mockUploadReviewEvents).toHaveBeenCalledWith("user-1", [event]);
    expect(mockSyncSetState).toHaveBeenCalledWith({ pendingEvents: [] });
  });

  it("on upload failure: returns the real error, does NOT clear pendingEvents, and does NOT call download (silent-retry-safe)", async () => {
    const event = makeEvent();
    mockSyncState.pendingEvents = [event];
    mockUploadReviewEvents.mockResolvedValue({ ok: false, error: "network error" });
    const { result } = renderHook(() => useSync());

    const outcome = await result.current.syncNow();

    expect(outcome).toEqual({ ok: false, error: "network error" });
    // pendingEvents itself is untouched — the only setState call this path makes
    // is the lastSyncError write (Task #520), asserted separately below.
    expect(mockSyncState.pendingEvents).toEqual([event]);
    expect(mockDownloadReviewEvents).not.toHaveBeenCalled();
  });

  it("on upload failure: records lastSyncError and leaves lastSyncedAt untouched (Task #520)", async () => {
    mockSyncState.pendingEvents = [makeEvent()];
    mockSyncState.lastSyncedAt = 1_000_000;
    mockUploadReviewEvents.mockResolvedValue({ ok: false, error: "network error" });
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect(mockSyncSetState).toHaveBeenCalledWith({ lastSyncError: "network error" });
    expect(mockSyncState.lastSyncedAt).toBe(1_000_000);
  });

  it("a review enqueued while the upload is in flight is NOT lost — only the events actually uploaded are cleared", async () => {
    // Regression test: syncNow() must not blindly reset pendingEvents to [] on upload
    // success. It must clear only the specific ids it uploaded, re-reading current
    // state at clear time — otherwise a real review recorded during the upload's
    // network round-trip (uploadReviewEvents is an await; enqueueReviewEvent can run
    // in that window) would be silently dropped: never uploaded, and no longer queued.
    const uploadedEvent = makeEvent({ id: "uploaded-1" });
    const raceEvent = makeEvent({ id: "race-1" });
    mockSyncState.pendingEvents = [uploadedEvent];
    mockUploadReviewEvents.mockImplementation(async () => {
      // Simulates a real review being recorded while this request is in flight.
      mockSyncState.pendingEvents = [...mockSyncState.pendingEvents, raceEvent];
      return { ok: true };
    });
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect(mockSyncState.pendingEvents).toEqual([raceEvent]);
  });
});

describe("useSync — download+merge path", () => {
  it("replays the downloaded event set with the real conflictResolution logic and patches matching cards into srsStore", async () => {
    mockDownloadReviewEvents.mockResolvedValue({
      ok: true,
      events: [
        makeEvent({ id: "a", cardId: "c1", reviewedAt: 1000, rating: 3, stability: 10, difficulty: 5, dueDate: 2000 }),
        makeEvent({ id: "b", cardId: "c1", reviewedAt: 5000, rating: 4, stability: 20, difficulty: 3, dueDate: 9000 }),
      ],
    });
    const { result } = renderHook(() => useSync());

    const outcome = await result.current.syncNow();

    expect(outcome).toEqual({ ok: true });
    // b (reviewedAt: 5000) is the latest event for c1 — its fields win per
    // docs/SYNC_ARCHITECTURE.md §4's "latest event wins" design.
    expect(mockSRSState.cards.c1).toEqual({
      cardId: "c1", state: "review", stability: 20, difficulty: 3,
      retrievability: 1, dueDate: 9000, lapses: 0, reps: 2,
    });
  });

  it("on download failure: returns the real error and does not touch srsStore's cards", async () => {
    mockDownloadReviewEvents.mockResolvedValue({ ok: false, error: "permission denied" });
    const { result } = renderHook(() => useSync());

    const outcome = await result.current.syncNow();

    expect(outcome).toEqual({ ok: false, error: "permission denied" });
    expect(mockSRSSetState).not.toHaveBeenCalled();
  });

  it("on download failure: records lastSyncError (Task #520)", async () => {
    mockDownloadReviewEvents.mockResolvedValue({ ok: false, error: "permission denied" });
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect(mockSyncSetState).toHaveBeenCalledWith({ lastSyncError: "permission denied" });
  });

  it("on a fully successful sync: sets lastSyncedAt to the current time and clears any prior lastSyncError (Task #520)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    mockSyncState.lastSyncError = "stale error from a previous failed attempt";
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect(mockSyncSetState).toHaveBeenCalledWith({ lastSyncedAt: 1_700_000_000_000, lastSyncError: null });
    expect(mockSyncState.lastSyncedAt).toBe(1_700_000_000_000);
    expect(mockSyncState.lastSyncError).toBeNull();
    vi.useRealTimers();
  });

  it("does not call srsStore.setState at all when the merged result is empty", async () => {
    mockDownloadReviewEvents.mockResolvedValue({ ok: true, events: [] });
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect(mockSRSSetState).not.toHaveBeenCalled();
  });

  it("a card that failed twice before ever graduating merges as state 'learning', not 'relearning' (regression, severity-7 audit finding)", async () => {
    mockDownloadReviewEvents.mockResolvedValue({
      ok: true,
      events: [
        makeEvent({ id: "a", cardId: "c1", reviewedAt: 1000, rating: 1 }),
        makeEvent({ id: "b", cardId: "c1", reviewedAt: 2000, rating: 1 }),
      ],
    });
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();

    expect((mockSRSState.cards.c1 as { state: string }).state).toBe("learning");
  });
});

describe("useSync — concurrency guard (Task #520 audit finding: SyncTrigger's timer and a debounced triggerSyncSoon can race)", () => {
  it("two overlapping syncNow() calls share a single execution — only one download round-trip happens, and both callers see the same result", async () => {
    const { result } = renderHook(() => useSync());

    const p1 = result.current.syncNow();
    const p2 = result.current.syncNow();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(mockDownloadReviewEvents).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
  });

  it("the guard clears once the in-flight sync settles, so a later call starts a genuinely new execution", async () => {
    const { result } = renderHook(() => useSync());

    await result.current.syncNow();
    await result.current.syncNow();

    expect(mockDownloadReviewEvents).toHaveBeenCalledTimes(2);
  });
});

describe("useSync — triggerSyncSoon (Task #518: sync a review quickly, not on the 5-minute timer)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call syncNow synchronously — it waits for the debounce window", () => {
    const { result } = renderHook(() => useSync());

    result.current.triggerSyncSoon();

    expect(mockUploadReviewEvents).not.toHaveBeenCalled();
    expect(mockDownloadReviewEvents).not.toHaveBeenCalled();
  });

  it("calls syncNow (via download, since there are no pending events) after the debounce window elapses", async () => {
    const { result } = renderHook(() => useSync());

    result.current.triggerSyncSoon();
    await vi.advanceTimersByTimeAsync(2000);

    expect(mockDownloadReviewEvents).toHaveBeenCalledWith("user-1");
  });

  it("collapses a burst of calls into a single sync — one debounce window, not one per call", async () => {
    const { result } = renderHook(() => useSync());

    result.current.triggerSyncSoon();
    await vi.advanceTimersByTimeAsync(500);
    result.current.triggerSyncSoon();
    await vi.advanceTimersByTimeAsync(500);
    result.current.triggerSyncSoon();
    await vi.advanceTimersByTimeAsync(2000);

    expect(mockDownloadReviewEvents).toHaveBeenCalledTimes(1);
  });
});
