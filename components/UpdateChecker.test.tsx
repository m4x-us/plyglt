// @vitest-environment jsdom
// ============================================================
// UpdateChecker.test.tsx — behavioral tests for UpdateChecker (Task #102)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

const { mockCheckForUpdates, tauriState } = vi.hoisted(() => ({
  mockCheckForUpdates: vi.fn().mockResolvedValue({ available: false }),
  tauriState: { isTauri: false as boolean },
}));

vi.mock("@/lib/tauri", () => ({
  get isTauri() { return tauriState.isTauri; },
  checkForUpdates: mockCheckForUpdates,
}));

import { UpdateChecker } from "./UpdateChecker";

beforeEach(() => {
  tauriState.isTauri = false;
  vi.clearAllMocks();
  mockCheckForUpdates.mockResolvedValue({ available: false });
});

afterEach(() => {
  cleanup();
});

describe("UpdateChecker", () => {
  it("does not call checkForUpdates when isTauri is false", async () => {
    await act(async () => { render(<UpdateChecker />); });
    expect(mockCheckForUpdates).not.toHaveBeenCalled();
  });

  it("calls checkForUpdates on mount when isTauri is true", async () => {
    tauriState.isTauri = true;
    await act(async () => { render(<UpdateChecker />); });
    expect(mockCheckForUpdates).toHaveBeenCalledOnce();
  });

  it("logs UPDATE_AVAILABLE when an update is available", async () => {
    tauriState.isTauri = true;
    mockCheckForUpdates.mockResolvedValueOnce({
      available: true,
      version: "2.0.0",
      install: vi.fn(),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await act(async () => { render(<UpdateChecker />); });
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE_AVAILABLE"),
        expect.stringContaining("2.0.0")
      );
    });

    logSpy.mockRestore();
  });
});
