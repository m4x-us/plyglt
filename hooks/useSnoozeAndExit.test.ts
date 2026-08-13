// @vitest-environment jsdom
// ============================================================
// useSnoozeAndExit.test.ts — behavioral tests for Task #530's snooze button handler
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockRouterPush, mockSnoozeInterrupt, mockExitMandatoryMode, mockUseAuthStoreGetState, mockUseSyncStoreGetState } =
  vi.hoisted(() => ({
    mockRouterPush: vi.fn(),
    mockSnoozeInterrupt: vi.fn().mockResolvedValue(undefined),
    mockExitMandatoryMode: vi.fn().mockResolvedValue(undefined),
    mockUseAuthStoreGetState: vi.fn(() => ({ userId: null as string | null })),
    mockUseSyncStoreGetState: vi.fn(() => ({ deviceId: null as string | null })),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/lib/tauriInterrupt", () => ({
  snoozeInterrupt: mockSnoozeInterrupt,
  exitMandatoryMode: mockExitMandatoryMode,
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: { getState: mockUseAuthStoreGetState },
}));

vi.mock("@/store/syncStore", () => ({
  useSyncStore: { getState: mockUseSyncStoreGetState },
}));

import { useSnoozeAndExit } from "./useSnoozeAndExit";

beforeEach(() => {
  vi.clearAllMocks();
  mockSnoozeInterrupt.mockResolvedValue(undefined);
  mockExitMandatoryMode.mockResolvedValue(undefined);
  mockUseAuthStoreGetState.mockReturnValue({ userId: null });
  mockUseSyncStoreGetState.mockReturnValue({ deviceId: null });
});

describe("useSnoozeAndExit", () => {
  it("calls snoozeInterrupt with a gateContext when both userId and deviceId are known", async () => {
    mockUseAuthStoreGetState.mockReturnValue({ userId: "user-1" });
    mockUseSyncStoreGetState.mockReturnValue({ deviceId: "device-1" });
    const { result } = renderHook(() => useSnoozeAndExit(30));

    await act(async () => { await result.current(); });

    expect(mockSnoozeInterrupt).toHaveBeenCalledWith(30, { userId: "user-1", deviceId: "device-1" });
  });

  it("calls snoozeInterrupt with undefined gateContext when userId is null (signed out)", async () => {
    mockUseAuthStoreGetState.mockReturnValue({ userId: null });
    mockUseSyncStoreGetState.mockReturnValue({ deviceId: "device-1" });
    const { result } = renderHook(() => useSnoozeAndExit(30));

    await act(async () => { await result.current(); });

    expect(mockSnoozeInterrupt).toHaveBeenCalledWith(30, undefined);
  });

  it("calls snoozeInterrupt with undefined gateContext when deviceId is null (no local device id yet)", async () => {
    mockUseAuthStoreGetState.mockReturnValue({ userId: "user-1" });
    mockUseSyncStoreGetState.mockReturnValue({ deviceId: null });
    const { result } = renderHook(() => useSnoozeAndExit(30));

    await act(async () => { await result.current(); });

    expect(mockSnoozeInterrupt).toHaveBeenCalledWith(30, undefined);
  });

  it("passes the exact snoozeMinutes value the hook was called with", async () => {
    const { result } = renderHook(() => useSnoozeAndExit(45));

    await act(async () => { await result.current(); });

    expect(mockSnoozeInterrupt).toHaveBeenCalledWith(45, undefined);
  });

  it("calls exitMandatoryMode and navigates home after a successful snooze", async () => {
    const { result } = renderHook(() => useSnoozeAndExit(30));

    await act(async () => { await result.current(); });

    expect(mockExitMandatoryMode).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/learn");
  });

  it("still calls exitMandatoryMode and navigates home when snoozeInterrupt rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSnoozeInterrupt.mockRejectedValue(new Error("Snooze IPC failed"));
    const { result } = renderHook(() => useSnoozeAndExit(30));

    await act(async () => { await result.current(); });

    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-IPC-SNOOZE-\d+\] Snooze failed:$/);
    expect(mockExitMandatoryMode).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/learn");
    consoleErrorSpy.mockRestore();
  });

  it("still navigates home when exitMandatoryMode itself rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExitMandatoryMode.mockRejectedValue(new Error("exit_mandatory_mode IPC failed"));
    const { result } = renderHook(() => useSnoozeAndExit(30));

    await act(async () => { await result.current(); });

    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-IPC-EXIT-\d+\] exitMandatoryMode failed:$/);
    expect(mockRouterPush).toHaveBeenCalledWith("/learn");
    consoleErrorSpy.mockRestore();
  });
});
