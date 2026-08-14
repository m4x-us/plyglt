// @vitest-environment jsdom
// ============================================================
// usePushInterruptTap.test.ts — Tests for the iOS push-tap routing hook (Task #522)
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { state, mockPush } = vi.hoisted(() => ({
  state: {
    isTauri: true as boolean,
    tapHandler: null as (() => void) | null,
    pendingTap: false as boolean,
    takeCalls: 0,
  },
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/tauri", () => ({
  get isTauri() {
    return state.isTauri;
  },
}));

vi.mock("@/lib/tauriPush", () => ({
  onPushTap: vi.fn((handler: () => void) => {
    state.tapHandler = handler;
    return Promise.resolve(() => {
      state.tapHandler = null;
    });
  }),
  takePendingPushTap: vi.fn(() => {
    state.takeCalls += 1;
    const wasPending = state.pendingTap;
    state.pendingTap = false;
    return Promise.resolve(wasPending);
  }),
}));

import { usePushInterruptTap } from "@/hooks/usePushInterruptTap";

beforeEach(() => {
  vi.clearAllMocks();
  state.isTauri = true;
  state.tapHandler = null;
  state.pendingTap = false;
  state.takeCalls = 0;
});

describe("usePushInterruptTap — cold start (pending tap flag)", () => {
  it("navigates to /study?mode=interrupt when the app was launched by a push tap", async () => {
    state.pendingTap = true;
    renderHook(() => usePushInterruptTap());
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt"));
  });

  it("does not navigate when no tap is pending", async () => {
    renderHook(() => usePushInterruptTap());
    await vi.waitFor(() => expect(state.takeCalls).toBe(1));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("usePushInterruptTap — warm start (push:notification-tapped event)", () => {
  it("navigates to /study?mode=interrupt when a tap event arrives while running", async () => {
    renderHook(() => usePushInterruptTap());
    // Proves a handler was actually registered (a function), not merely that it
    // isn't null — matches hooks/useInterruptDeepLink.test.ts's identical idiom.
    await vi.waitFor(() => expect(typeof state.tapHandler).toBe("function"));

    state.tapHandler!();

    expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt");
  });

  it("drains the native pending-tap flag after routing a warm tap, so the next launch cannot mis-route", async () => {
    renderHook(() => usePushInterruptTap());
    await vi.waitFor(() => expect(typeof state.tapHandler).toBe("function"));
    // Mount's own cold-start drain has run by the time the handler exists.
    await vi.waitFor(() => expect(state.takeCalls).toBe(1));

    state.pendingTap = true; // the native delegate sets this alongside the event
    state.tapHandler!();

    await vi.waitFor(() => expect(state.takeCalls).toBe(2));
    expect(state.pendingTap).toBe(false);
  });
});

describe("usePushInterruptTap — web (isTauri false)", () => {
  it("does not subscribe or drain at all in a web build", async () => {
    state.isTauri = false;
    renderHook(() => usePushInterruptTap());
    await Promise.resolve();
    await Promise.resolve();
    expect(state.tapHandler).toBeNull();
    expect(state.takeCalls).toBe(0);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
