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
});
