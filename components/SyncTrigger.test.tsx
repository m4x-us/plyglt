// ===========================================
// SYNC TRIGGER COMPONENT TESTS
// ===========================================
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SyncTrigger, SYNC_INTERVAL_MS } from "./SyncTrigger";

const mockAuthState = { status: "signed-out" as "signed-in" | "signed-out" | "loading" };
vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

const mockSyncNow = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/hooks/useSync", () => ({
  useSync: () => ({ syncNow: mockSyncNow }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSyncNow.mockResolvedValue({ ok: true });
  mockAuthState.status = "signed-out";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SyncTrigger — signed out", () => {
  it("renders nothing and never calls syncNow", () => {
    const { container } = render(<SyncTrigger />);
    expect(container.innerHTML).toBe("");
    expect(mockSyncNow).not.toHaveBeenCalled();
  });
});

describe("SyncTrigger — signed in", () => {
  it("calls syncNow once immediately on mount", async () => {
    mockAuthState.status = "signed-in";
    render(<SyncTrigger />);
    await vi.waitFor(() => expect(mockSyncNow).toHaveBeenCalledTimes(1));
  });

  it("calls syncNow again after SYNC_INTERVAL_MS elapses, and again after a second interval", () => {
    vi.useFakeTimers();
    mockAuthState.status = "signed-in";
    render(<SyncTrigger />);
    expect(mockSyncNow).toHaveBeenCalledTimes(1); // the immediate on-mount call

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(mockSyncNow).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(mockSyncNow).toHaveBeenCalledTimes(3);
  });

  it("stops the periodic timer on unmount — no further syncNow calls after cleanup", () => {
    vi.useFakeTimers();
    mockAuthState.status = "signed-in";
    const { unmount } = render(<SyncTrigger />);
    expect(mockSyncNow).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(SYNC_INTERVAL_MS * 3);
    expect(mockSyncNow).toHaveBeenCalledTimes(1);
  });

  it("does not throw, and logs instead, when syncNow unexpectedly rejects", async () => {
    mockAuthState.status = "signed-in";
    mockSyncNow.mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<SyncTrigger />)).not.toThrow();
    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());

    consoleSpy.mockRestore();
  });

  it("logs a console.error when syncNow RESOLVES (not rejects) to {ok:false} on the initial sign-in-triggered sync (Task #521)", async () => {
    // Distinct from the rejection test above: syncNow() never throws — a real,
    // persistent sync failure resolves to {ok:false, error}. Task #521 exists
    // because this exact case shipped without a test during Task #518's follow-up.
    mockAuthState.status = "signed-in";
    mockSyncNow.mockResolvedValueOnce({ ok: false, error: "network error" });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SyncTrigger />);
    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalledTimes(1));
    expect(consoleSpy.mock.calls[0]?.[1]).toBe("network error");

    consoleSpy.mockRestore();
  });

  it("logs a console.error when syncNow resolves to {ok:false} on a periodic interval sync, not just the initial one (Task #521)", async () => {
    vi.useFakeTimers();
    mockAuthState.status = "signed-in";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SyncTrigger />);
    await vi.advanceTimersByTimeAsync(0); // let the immediate on-mount call settle
    consoleSpy.mockClear();

    mockSyncNow.mockResolvedValueOnce({ ok: false, error: "server error" });
    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[1]).toBe("server error");

    consoleSpy.mockRestore();
  });

  it("does not log anything when syncNow resolves to {ok:true} (Task #521)", async () => {
    mockAuthState.status = "signed-in";
    mockSyncNow.mockResolvedValueOnce({ ok: true });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SyncTrigger />);
    await vi.waitFor(() => expect(mockSyncNow).toHaveBeenCalledTimes(1));
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
