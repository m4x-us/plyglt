// @vitest-environment jsdom
// ============================================================
// usePushRegistration.test.ts — Tests for the iOS APNs registration hook (Task #522)
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { state, mocks } = vi.hoisted(() => ({
  state: {
    isTauri: true as boolean,
    permissionGranted: true as boolean,
    registerSupported: true as boolean,
    cachedToken: null as string | null,
    tokenHandler: null as ((token: string) => void) | null,
    auth: { userId: "user-1" as string | null },
    entitlement: { licenseType: "subscription" as string, validUntil: null as number | null },
    settings: { interruptEnabled: true as boolean },
    sync: { deviceId: "device-1" as string | null },
  },
  mocks: {
    registerPushToken: vi.fn(() => Promise.resolve({ ok: true as const })),
    unregisterPushToken: vi.fn(() => Promise.resolve({ ok: true as const })),
    registerForPushNotifications: vi.fn(() => Promise.resolve(state.registerSupported)),
    onPushToken: vi.fn((handler: (token: string) => void) => {
      state.tokenHandler = handler;
      return Promise.resolve(() => {
        state.tokenHandler = null;
      });
    }),
  },
}));

vi.mock("@/lib/tauri", () => ({
  get isTauri() {
    return state.isTauri;
  },
  isNotificationPermissionGranted: vi.fn(() => Promise.resolve(state.permissionGranted)),
}));

vi.mock("@/lib/tauriPush", () => ({
  registerForPushNotifications: mocks.registerForPushNotifications,
  getPushToken: vi.fn(() => Promise.resolve(state.cachedToken)),
  onPushToken: mocks.onPushToken,
}));

vi.mock("@/lib/pushTokenClient", () => ({
  registerPushToken: mocks.registerPushToken,
  unregisterPushToken: mocks.unregisterPushToken,
}));

vi.mock("@/lib/featureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/featureFlags")>();
  return {
    ...actual,
    getFeatureFlags: () => ({ interruptEngine: true, vacationMode: true, analytics: true }),
  };
});

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (s: typeof state.auth) => unknown) => selector(state.auth),
}));
vi.mock("@/store/entitlementStore", () => ({
  useEntitlementStore: (selector: (s: typeof state.entitlement) => unknown) => selector(state.entitlement),
}));
vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: (selector: (s: typeof state.settings) => unknown) => selector(state.settings),
}));
vi.mock("@/store/syncStore", () => ({
  useSyncStore: { getState: () => state.sync },
}));

import { usePushRegistration } from "@/hooks/usePushRegistration";

beforeEach(() => {
  vi.clearAllMocks();
  state.isTauri = true;
  state.permissionGranted = true;
  state.registerSupported = true;
  state.cachedToken = null;
  state.tokenHandler = null;
  state.auth.userId = "user-1";
  state.entitlement.licenseType = "subscription";
  state.entitlement.validUntil = null;
  state.settings.interruptEnabled = true;
  state.sync.deviceId = "device-1";
});

describe("usePushRegistration — happy path", () => {
  it("uploads an event-delivered token with the exact push_tokens row shape", async () => {
    renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));

    state.tokenHandler!("a1b2c3");

    await vi.waitFor(() =>
      expect(mocks.registerPushToken).toHaveBeenCalledWith({
        userId: "user-1",
        platform: "ios",
        deviceId: "device-1",
        token: "a1b2c3",
        appEnv: "sandbox", // vitest runs with NODE_ENV=test, the non-production branch
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    );
  });

  it("uploads a token the OS delivered before the listener attached (cached-token path)", async () => {
    state.cachedToken = "cached-ff00";
    renderHook(() => usePushRegistration());
    await vi.waitFor(() =>
      expect(mocks.registerPushToken).toHaveBeenCalledWith(
        expect.objectContaining({ token: "cached-ff00" })
      )
    );
  });
});

describe("usePushRegistration — gates", () => {
  async function expectNoRegistration() {
    // Two microtask turns let any (incorrect) async work surface before asserting.
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.registerForPushNotifications).not.toHaveBeenCalled();
    expect(mocks.registerPushToken).not.toHaveBeenCalled();
  }

  it("does nothing outside Tauri", async () => {
    state.isTauri = false;
    renderHook(() => usePushRegistration());
    await expectNoRegistration();
  });

  it("does nothing when signed out", async () => {
    state.auth.userId = null;
    renderHook(() => usePushRegistration());
    await expectNoRegistration();
  });

  it("does nothing on a free license — push interrupts are Pro", async () => {
    state.entitlement.licenseType = "free";
    renderHook(() => usePushRegistration());
    await expectNoRegistration();
  });

  it("does nothing while interrupts are disabled in settings", async () => {
    state.settings.interruptEnabled = false;
    renderHook(() => usePushRegistration());
    await expectNoRegistration();
  });

  it("does not register before notification permission is granted — the settings toggle owns the prompt", async () => {
    state.permissionGranted = false;
    renderHook(() => usePushRegistration());
    await expectNoRegistration();
  });

  it("attaches no token listener when the platform reports unsupported (non-iOS)", async () => {
    state.registerSupported = false;
    renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(mocks.registerForPushNotifications).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(state.tokenHandler).toBeNull();
    expect(mocks.registerPushToken).not.toHaveBeenCalled();
  });

  // Round-12 audit finding (Agent W): onPushToken (a real async Tauri IPC round-trip) had
  // no `cancelled` check immediately after it resolved, unlike getPushToken's result two
  // lines below — a dep change (sign-out, license downgrade, toggling interruptEnabled)
  // that tears down the effect WHILE onPushToken is still in flight left the returned
  // unlisten function assigned to the outer `unlisten` var AFTER cleanup already ran,
  // permanently leaking a live listener closed over the stale userId. Deletion Test:
  // removing the `if (cancelled) { un(); return; }` guard restores the leak, and
  // unlistenSpy below is never called.
  it("does not leak a live token listener when the effect is torn down while onPushToken's registration is still in flight", async () => {
    let resolveOnPushToken!: (unlisten: () => void) => void;
    const unlistenSpy = vi.fn();
    mocks.onPushToken.mockImplementationOnce((handler: (token: string) => void) => {
      state.tokenHandler = handler;
      return new Promise<() => void>((resolve) => {
        resolveOnPushToken = resolve;
      });
    });

    const { unmount } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(mocks.onPushToken).toHaveBeenCalledTimes(1));

    // Tear down the effect (e.g. sign-out / dep change) BEFORE the in-flight
    // onPushToken registration resolves — the exact race window this fix closes.
    unmount();

    // The registration now resolves, delivering a real unlisten function.
    resolveOnPushToken(unlistenSpy);
    await vi.waitFor(() => expect(unlistenSpy).toHaveBeenCalledTimes(1));
  });

  it("skips the upload when no sync deviceId exists yet, without erroring", async () => {
    state.sync.deviceId = null;
    renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));

    state.tokenHandler!("a1b2c3");

    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.registerPushToken).not.toHaveBeenCalled();
  });
});

// Round-14 audit finding (3-way convergence: Agent A, B, W): nothing in the app ever called
// unregisterPushToken — a device that registered while Pro/signed-in kept receiving push
// notifications indefinitely after sign-out, a subscription lapse, or disabling interrupts,
// since the server-side dispatch has no entitlement concept at all and never learns the
// client-side gate closed. Fixed by proactively cleaning up whenever the gate no longer holds.
describe("usePushRegistration — cleans up a stale token when the gate no longer holds (round-14 audit fix)", () => {
  it("unregisters the token when a Pro user's license downgrades to free", async () => {
    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();

    state.entitlement.licenseType = "free";
    rerender();

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
  });

  it("unregisters the token when interrupts are disabled after being enabled", async () => {
    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));

    state.settings.interruptEnabled = false;
    rerender();

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
  });

  // Deletion Test: removing the `if (userId) { ... }` guard (or the cleanup block entirely)
  // makes this test fail differently — either a TypeError from unregisterPushToken(null, ...)
  // or, if the guard is removed but the block stays, a spurious call this test asserts against.
  it("does not attempt to unregister when the user signs out — no userId to scope the delete to", async () => {
    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));

    state.auth.userId = null;
    rerender();

    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();
  });

  it("cleans up on mount even when the gate never held (e.g. already Free) — a harmless no-op DELETE, not conditioned on a prior real registration", async () => {
    state.entitlement.licenseType = "free";
    renderHook(() => usePushRegistration());

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
  });
});
