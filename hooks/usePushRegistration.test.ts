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
    // Round-15 audit fix: usePushRegistration now gates on useIsHydrated(useEntitlementStore)
    // and useIsHydrated(useSettingsStore) — defaults to hydrated=true so every pre-existing
    // test in this file, written before hydration mattered here, is unaffected; the
    // dedicated hydration-race describe block below overrides these per-test.
    entitlementHydrated: true as boolean,
    settingsHydrated: true as boolean,
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
// useEntitlementStore/useSettingsStore are called both as selector hooks AND passed whole
// to useIsHydrated(store) (lib/storage.ts), which reads store.persist.hasHydrated()/
// onFinishHydration() directly on the function object itself — a plain arrow function
// mock throws. Object.assign attaches the .persist shape onto the callable mock.
vi.mock("@/store/entitlementStore", () => ({
  useEntitlementStore: Object.assign(
    (selector: (s: typeof state.entitlement) => unknown) => selector(state.entitlement),
    { persist: { hasHydrated: () => state.entitlementHydrated, onFinishHydration: () => () => {} } },
  ),
}));
vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: Object.assign(
    // Mirrors real Zustand persist behavior (store/settingsStore.ts's actual pre-hydration
    // default is interruptEnabled: false) — while !settingsHydrated, the selector must see
    // that default, not the real persisted value, or the hydration-race test can't reproduce
    // the scenario it's named after (a real Pro+enabled user reading as gate-failed).
    (selector: (s: typeof state.settings) => unknown) =>
      selector(state.settingsHydrated ? state.settings : { interruptEnabled: false }),
    { persist: { hasHydrated: () => state.settingsHydrated, onFinishHydration: () => () => {} } },
  ),
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
  state.entitlementHydrated = true;
  state.settingsHydrated = true;
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
//
// Round-15 audit finding (5-way convergence: Agent A, B, K, S, V — the round's headline):
// round 14's fix only worked when THIS hook's own effect body got a chance to re-run with
// new deps while still mounted (the interruptEnabled-toggle case below). It silently failed
// for its two most direct, most emphasized scenarios: (1) a licenseType/validUntil change
// (Deactivate, background revalidation) causes components/InterruptHandler.tsx's OWN
// Pro-gate to unmount InterruptHandlerCore — and this hook inside it — in the SAME commit,
// before the effect body ever runs again to reach the round-14 cleanup branch; only the
// effect's CLEANUP FUNCTION still fires, and round 14 never called unregisterPushToken from
// there. (2) sign-out sets `userId` to null BEFORE the effect re-runs, so the round-14
// `if (userId)` guard (reading the now-null CURRENT value) always skipped the call — there
// was no way to recover WHO to unregister. Separately, Agent S found the proactive branch
// could itself fire a spurious DELETE during a cross-store hydration race on cold start.
// Fixed by tracking who was actually registered in a ref (correct even across an unmount or
// a userId->null transition) and gating the whole effect behind both stores' real hydration.
describe("usePushRegistration — cleans up a stale token when the gate no longer holds (round-14/15 audit fix)", () => {
  it("unregisters the token when a Pro user's license downgrades to free (dep change, stays mounted)", async () => {
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

  // Round-15 headline regression test: this is the REAL production shape of the bug — the
  // parent component (components/InterruptHandler.tsx) stops rendering this hook's owner
  // ENTIRELY when its own Pro-gate flips, an actual unmount, not a dep change on an
  // already-mounted instance (which `rerender()` above tests, and which was never broken).
  // Deletion Test: removing the effect-cleanup's `void unregisterFor(prev.userId)` call
  // (leaving only `cancelled = true; unlisten?.();`) makes this test fail — no call at all.
  it("unregisters the token when the whole hook unmounts after a successful registration — the real InterruptHandler Pro-gate shape, not just a dep change while mounted", async () => {
    const { unmount } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    state.tokenHandler!("a1b2c3"); // deliver a real token so registeredForRef gets set
    await vi.waitFor(() => expect(mocks.registerPushToken).toHaveBeenCalledTimes(1));
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();

    unmount();

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
    // Round-16 audit finding (Agent K/B): the pre-round-16 combined-effect design could
    // double-fire this call (once from the multi-dep effect's cleanup, once more from a
    // dep-change re-run's gate-failure branch) — no prior test asserted call COUNT here,
    // only that it was called WITH the right args at least once, so a double-fire would
    // have passed silently. Deletion Test: reintroducing the unregister call inside the
    // multi-dep effect's own cleanup (in addition to the empty-deps effect below) makes
    // this specific assertion fail with 2 calls, even though the .toHaveBeenCalledWith
    // assertion above still passes either way.
    expect(mocks.unregisterPushToken).toHaveBeenCalledTimes(1);
  });

  // Round-17 audit finding (Agent W): the true-unmount cleanup above fires exactly once —
  // if registerPushToken() is STILL IN FLIGHT at that moment, the cleanup finds
  // registeredForRef.current still null and no-ops (nothing to unregister yet). When the
  // registration THEN resolves, uploadToken's success branch used to set the ref
  // unconditionally — but no code will ever run again for this hook instance to read it,
  // permanently orphaning the row just created on the server. Deletion Test: removing the
  // `trulyUnmountedRef.current` check in uploadToken's success branch (reverting to an
  // unconditional `registeredForRef.current = {...}`) makes this test fail — no
  // unregisterPushToken call at all, since the ref would be set post-unmount with nothing
  // left to ever read or clean it up.
  it("self-cleans an in-flight registration that resolves AFTER the hook has already truly unmounted, instead of orphaning the row", async () => {
    let resolveRegister!: (v: { ok: true }) => void;
    mocks.registerPushToken.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRegister = resolve; }),
    );

    const { unmount } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    state.tokenHandler!("a1b2c3"); // triggers uploadToken -> registerPushToken (now pending)
    await vi.waitFor(() => expect(mocks.registerPushToken).toHaveBeenCalledTimes(1));

    // True unmount happens WHILE the registration is still in flight.
    unmount();
    // Nothing to unregister yet — the ref was never populated (registration hadn't
    // resolved when the true-unmount cleanup ran).
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();

    // The registration now resolves, AFTER the true-unmount cleanup already ran and found
    // nothing to clean up.
    resolveRegister({ ok: true });

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
  });

  // Control case for the fix above: an in-flight registration that resolves BEFORE a dep
  // change (not a true unmount) must NOT self-clean via the same path — the next effect
  // instance still owns re-registering normally. trulyUnmountedRef is set ONLY by the
  // true-unmount cleanup, never by the multi-dep effect's own cleanup, specifically so
  // this case is unaffected.
  it("does not self-clean an in-flight registration that resolves after an ordinary dep change (not a true unmount)", async () => {
    let resolveRegister!: (v: { ok: true }) => void;
    mocks.registerPushToken.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRegister = resolve; }),
    );

    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    state.tokenHandler!("a1b2c3");
    await vi.waitFor(() => expect(mocks.registerPushToken).toHaveBeenCalledTimes(1));

    // Gate-preserving dep change (validUntil advances) — a real re-render, not an unmount.
    state.entitlement.validUntil = Date.now() + 86_400_000;
    rerender();

    resolveRegister({ ok: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();
  });

  // Round-16 audit finding (4-way convergence: Agent N, Security Agent S, Agent B, Red
  // Agent R): round 15's cleanup lived inside the multi-dep effect, so it fired on EVERY
  // dependency change, not only a true unmount. A dep change that leaves the gate TRUE
  // (e.g. validUntil advancing on a routine background license revalidation, licenseType/
  // interruptEnabled unchanged) spuriously deleted a still-valid registration, racing an
  // unordered re-registration attempt that could leave a fully entitled Pro user's push
  // registration permanently wiped if the network calls resolved out of order. Deletion
  // Test: reintroducing the round-15 cleanup's `void unregisterFor(prev.userId)` inside
  // the multi-dep effect makes this test fail — a validUntil-only change would fire it.
  it("does not unregister when a dependency changes but the gate stays true (e.g. a license revalidation refreshing validUntil)", async () => {
    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    state.tokenHandler!("a1b2c3");
    await vi.waitFor(() => expect(mocks.registerPushToken).toHaveBeenCalledTimes(1));
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();

    // Gate stays true throughout: licenseType/interruptEnabled unchanged, only validUntil
    // advances (a real markValidated() call from a routine background revalidation).
    state.entitlement.validUntil = Date.now() + 86_400_000;
    rerender();

    // Let any (incorrect) async unregister work surface before asserting.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();
  });

  // Round-16 audit finding, second half of the same headline bug (Agent B, Red Agent R):
  // a dep change that flips the gate TRUE->FALSE while the hook stays mounted (toggling
  // interrupts off, a license downgrade) fired the round-15 cleanup's unregister AND the
  // gate-failure branch's own explicit unregister for the same transition — one logical
  // event, two racing DELETE calls. The two pre-existing "dep change, stays mounted" tests
  // above never populate registeredForRef via a real token delivery first, so the
  // double-fire was structurally unreachable in either of them (registeredForRef.current
  // was already null going in) — this test closes that gap by delivering a token first.
  // Deletion Test: reintroducing the round-15 cleanup's unregister call inside the
  // multi-dep effect makes mockUnregisterPushToken fire twice instead of once here.
  it("unregisters exactly once when the gate flips from true to false while the hook stays mounted, after a real prior registration", async () => {
    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    state.tokenHandler!("a1b2c3");
    await vi.waitFor(() => expect(mocks.registerPushToken).toHaveBeenCalledTimes(1));
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();

    state.entitlement.licenseType = "free";
    rerender();

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
    // Give any second, racing call a chance to surface before asserting the count.
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.unregisterPushToken).toHaveBeenCalledTimes(1);
  });

  // Round-15 regression test: sign-out AFTER a real registration must still target the
  // account that was actually registered — the CURRENT userId is already null by the time
  // this fires, so only the ref (not the closure's userId) can supply the right target.
  // Deletion Test: reverting to reading the current `userId` instead of the ref's captured
  // value makes this test fail (would try to call with `null` or skip the call entirely).
  it("unregisters the PREVIOUSLY-registered account when the user signs out after a real registration", async () => {
    const { rerender } = renderHook(() => usePushRegistration());
    await vi.waitFor(() => expect(typeof state.tokenHandler).toBe("function"));
    state.tokenHandler!("a1b2c3");
    await vi.waitFor(() => expect(mocks.registerPushToken).toHaveBeenCalledTimes(1));

    state.auth.userId = null;
    rerender();

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
  });

  // Deletion Test: removing the `if (target)` guard (or the cleanup block entirely) makes
  // this test fail differently — either a TypeError from unregisterPushToken(null, ...) or,
  // if the guard is removed but the block stays, a spurious call this test asserts against.
  it("does not attempt to unregister when the user signs out with no prior registration in this session and no current userId to fall back to", async () => {
    state.auth.userId = null; // never signed in this render — nothing was ever registered
    renderHook(() => usePushRegistration());

    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();
  });

  it("cleans up on mount even when the gate never held (e.g. already Free) — a harmless no-op DELETE, not conditioned on a prior real registration", async () => {
    state.entitlement.licenseType = "free";
    renderHook(() => usePushRegistration());

    await vi.waitFor(() => expect(mocks.unregisterPushToken).toHaveBeenCalledWith("user-1", "device-1"));
  });

  // Round-15 audit finding (Agent S): entitlementStore/settingsStore hydrate independently
  // via separate Tauri IPC loads — interruptEnabled's pre-hydration default (false) could
  // make a real Pro+enabled user look gate-failed for one render, firing a spurious DELETE
  // against a currently-valid registration. Deletion Test: removing the
  // `if (!entitlementHydrated || !settingsHydrated) return;` guard makes this test fail —
  // unregisterPushToken would be called during the still-hydrating render.
  it("does not fire a destructive unregister while settingsStore is still hydrating, even though the not-yet-loaded interruptEnabled default would otherwise read as gate-failed", async () => {
    state.settingsHydrated = false; // entitlementStore already resolved subscription+true; settingsStore hasn't
    renderHook(() => usePushRegistration());

    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();
    expect(mocks.registerPushToken).not.toHaveBeenCalled(); // also doesn't register prematurely
  });
});
