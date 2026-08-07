// @vitest-environment jsdom
// ===========================================
// APPMENULISTENER COMPONENT TESTS (Rule 14)
// ===========================================
// Co-located tests for AppMenuListener.tsx.
// Tests: subscribes to menu:settings, navigates to /settings when it fires,
// unsubscribes on unmount.
// ===========================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AppMenuListener } from "./AppMenuListener";

const { tauriState, mockPush } = vi.hoisted(() => ({
  tauriState: {
    listeners: new Map<string, (payload: unknown) => void>(),
  },
  mockPush: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({
  listen: vi.fn().mockImplementation((event: string, cb: (p: unknown) => void) => {
    tauriState.listeners.set(event, cb);
    return Promise.resolve(() => { tauriState.listeners.delete(event); });
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  tauriState.listeners.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AppMenuListener", () => {
  it("navigates to /settings when the menu:settings event fires", async () => {
    render(<AppMenuListener />);
    await vi.waitFor(() => expect(tauriState.listeners.has("menu:settings")).toBe(true));

    const callback = tauriState.listeners.get("menu:settings");
    callback?.(undefined);

    expect(mockPush).toHaveBeenCalledWith("/settings");
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes from menu:settings on unmount", async () => {
    const { unmount } = render(<AppMenuListener />);
    await vi.waitFor(() => expect(tauriState.listeners.has("menu:settings")).toBe(true));

    unmount();

    expect(tauriState.listeners.has("menu:settings")).toBe(false);
  });

  it("renders nothing", async () => {
    const { container } = render(<AppMenuListener />);
    await vi.waitFor(() => expect(tauriState.listeners.has("menu:settings")).toBe(true));

    expect(container.innerHTML).toBe("");
  });
});
