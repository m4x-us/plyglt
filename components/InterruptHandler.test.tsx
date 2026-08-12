// @vitest-environment jsdom
// ===========================================
// INTERRUPTHANDLER COMPONENT TESTS (Rule 14)
// ===========================================
// Co-located tests for InterruptHandler.tsx.
// Tests: no listener when isTauri=false, DnD guard, updateInterruptConfig sync.
// ===========================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useSettingsStore } from "@/store/settingsStore";
import { validateLicense } from "@/lib/entitlement";
import { onDeepLinkUrl, getCurrentDeepLinkUrls, listen } from "@/lib/tauri";
import { InterruptHandler } from "./InterruptHandler";

const mockOnDeepLinkUrl = vi.mocked(onDeepLinkUrl);
const mockGetCurrentDeepLinkUrls = vi.mocked(getCurrentDeepLinkUrls);

// ── vi.hoisted: all values referenced inside vi.mock factories must be hoisted ─
// vi.mock factories are hoisted to the top of the file; any const defined in the
// module body is in the temporal dead zone when the factory runs.
const {
  tauriState,
  navState,
  mockUpdateInterruptConfig,
  mockPush,
  mockEnterMandatoryMode,
  mockUseLangPack,
  mockIsNotificationPermissionGranted,
  mockRequestNotificationPermission,
  mockSendNativeNotification,
} = vi.hoisted(() => ({
  tauriState: {
    isTauri: false as boolean,
    // Captures listen callbacks by event name so tests can fire them manually.
    listeners: new Map<string, (payload: unknown) => void>(),
  },
  // Mutable so tests can simulate a route change (Task #166 resubscription-race regression
  // test below) — real usePathname() returns a fresh value on every render.
  navState: { pathname: "/" },
  mockUpdateInterruptConfig: vi.fn().mockResolvedValue(undefined),
  mockPush: vi.fn(),
  mockEnterMandatoryMode: vi.fn().mockResolvedValue(undefined),
  mockUseLangPack: vi.fn().mockReturnValue({ units: [], unitMap: {}, lang: { code: "it" }, loading: false, error: null }),
  mockIsNotificationPermissionGranted: vi.fn().mockResolvedValue(true),
  mockRequestNotificationPermission: vi.fn().mockResolvedValue("granted"),
  mockSendNativeNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── tauri mock ────────────────────────────────────────────────────────────────
vi.mock("@/lib/tauri", () => ({
  get isTauri() { return tauriState.isTauri; },
  listen: vi.fn().mockImplementation((event: string, cb: (p: unknown) => void) => {
    tauriState.listeners.set(event, cb);
    return Promise.resolve(() => { tauriState.listeners.delete(event); });
  }),
  enableAutostart: vi.fn(),
  disableAutostart: vi.fn(),
  openExternalUrl: vi.fn(),
  invoke: vi.fn(),
  // hooks/useInterruptDeepLink.ts's deep-link subscription — harmless no-op
  // defaults so tests exercising isTauri=true (Tests 3-4 below) don't throw
  // on these being undefined. hooks/useInterruptDeepLink.test.ts covers the
  // hook's own routing logic directly; these tests only need it to not crash.
  onDeepLinkUrl: vi.fn().mockResolvedValue(() => {}),
  getCurrentDeepLinkUrls: vi.fn().mockResolvedValue(null),
  isNotificationPermissionGranted: (...args: unknown[]) => mockIsNotificationPermissionGranted(...args),
  requestNotificationPermission: (...args: unknown[]) => mockRequestNotificationPermission(...args),
  sendNativeNotification: (...args: unknown[]) => mockSendNativeNotification(...args),
}));

// ── tauriInterrupt mock — interrupt and tray badge IPC wrappers ───────────────
vi.mock("@/lib/tauriInterrupt", () => ({
  updateInterruptConfig: mockUpdateInterruptConfig,
  enterMandatoryMode: mockEnterMandatoryMode,
  snoozeInterrupt: vi.fn().mockResolvedValue(undefined),
  exitMandatoryMode: vi.fn().mockResolvedValue(undefined),
  updateTrayBadge: vi.fn(),
}));

// ── next/navigation ───────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => navState.pathname,
}));

// ── useLangPack — default: empty units so totalDue=0; override per-test for mandatory tests ─
vi.mock("@/hooks/useLangPack", () => ({
  useLangPack: mockUseLangPack,
  LOAD_PACK_ERROR_MESSAGES: {},
}));

// ── srsStore — minimal stub so getStats().due can be controlled per-test ─────
vi.mock("@/store/srsStore", () => ({
  useSRSStore: {
    getState: () => ({ getStats: () => ({ due: 1 }) }),
  },
}));

// ── validateLicense — silent no-op in background ──────────────────────────────
vi.mock("@/lib/entitlement", () => ({
  validateLicense: vi.fn().mockResolvedValue({ ok: true, validUntil: null }),
}));

// ── @tauri-apps/plugin-store — prevent real Tauri IPC calls from storage.ts ───
// lib/storage.ts dynamically imports this when isTauri=true. Without the mock,
// @tauri-apps/plugin-store calls `invoke` on undefined Tauri internals and
// produces an unhandled rejection that pollutes other tests.
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
    values: vi.fn().mockResolvedValue([]),
    entries: vi.fn().mockResolvedValue([]),
    length: vi.fn().mockResolvedValue(0),
    onChange: vi.fn().mockReturnValue(() => {}),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

beforeEach(() => {
  tauriState.isTauri = false;
  tauriState.listeners.clear();
  navState.pathname = "/";
  vi.clearAllMocks();
  mockUpdateInterruptConfig.mockResolvedValue(undefined);
  mockEnterMandatoryMode.mockResolvedValue(undefined);
  mockUseLangPack.mockReturnValue({ units: [], unitMap: {}, lang: { code: "it" }, loading: false, error: null });
  mockIsNotificationPermissionGranted.mockResolvedValue(true);
  mockRequestNotificationPermission.mockResolvedValue("granted");
  mockSendNativeNotification.mockResolvedValue(undefined);
  // Reset settings to deterministic defaults
  useSettingsStore.setState({
    interruptEnabled: true,
    intervalHours: 3,
    mandatory: false,
    dndStart: "22:00",
    dndEnd: "08:00",
    wakeEnabled: true,
    unlockEnabled: true,
    idleEnabled: true,
    idleThresholdMinutes: 15,
  });
});

afterEach(() => {
  cleanup();
});

describe("InterruptHandler", () => {
  // ── Test 1: no interrupt:fire listener when isTauri is false ─────────────────
  it("does not register the interrupt:fire listener when isTauri is false", async () => {
    tauriState.isTauri = false;
    await act(async () => {
      render(<InterruptHandler />);
    });
    // The effect short-circuits on !isTauri — no listener registered
    expect(tauriState.listeners.has("interrupt:fire")).toBe(false);
    // Same short-circuit applies to useInterruptDeepLink's subscription (Task #171)
    expect(mockOnDeepLinkUrl).not.toHaveBeenCalled();
    expect(mockGetCurrentDeepLinkUrls).not.toHaveBeenCalled();
  });

  // ── Test 1b: useInterruptDeepLink is actually wired when isTauri is true (Task #171) ─
  it("subscribes to the deep-link gateway when isTauri is true — proves useInterruptDeepLink is wired in, not just present", async () => {
    tauriState.isTauri = true;
    await act(async () => {
      render(<InterruptHandler />);
    });
    // Full routing behavior (which URLs trigger navigation) is covered directly in
    // hooks/useInterruptDeepLink.test.ts — this proves InterruptHandler actually calls
    // the hook rather than merely importing it unused.
    expect(mockOnDeepLinkUrl).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentDeepLinkUrls).toHaveBeenCalledTimes(1);
  });

  // ── Test 2: DnD guard — no navigation when isInDnd() is true ─────────────────
  it("does not navigate to /study when isInDnd is true", async () => {
    // Set DnD BEFORE enabling isTauri — avoids triggering Zustand persist's
    // setItem path with isTauri=true before the plugin-store mock is in effect.
    useSettingsStore.setState({
      interruptEnabled: true,
      dndStart: "00:00",   // covers the entire day
      dndEnd: "23:59",
    });
    tauriState.isTauri = true;

    await act(async () => {
      render(<InterruptHandler />);
    });

    // Manually fire the interrupt:fire event (isTauri=true so listener is registered)
    const callback = tauriState.listeners.get("interrupt:fire");
    // Proves a listener was actually registered (a function), not merely that the Map.get
    // result isn't undefined — the sibling test above proves the negative case (no listener
    // when !isTauri) via listeners.has(...) directly.
    expect(typeof callback).toBe("function");
    if (callback) {
      await act(async () => { callback(false); }); // false = non-mandatory
    }

    // isInDnd() returned true — guard fired — no navigation
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Test 4: enterMandatoryMode IPC failure is caught — navigation still proceeds ─
  it("logs error and still navigates when enterMandatoryMode rejects", async () => {
    // Disable DnD explicitly — beforeEach sets dndStart=22:00/dndEnd=08:00 which would
    // cause isInDnd() to return true when tests run after 22:00, skipping the callback.
    useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
    // Provide one unit with a card so totalDue > 0 (guard passes)
    mockUseLangPack.mockReturnValueOnce({
      units: [{ id: "u1", cards: [] }],
      unitMap: {},
      lang: { code: "it" },
      loading: false,
      error: null,
    });
    mockEnterMandatoryMode.mockRejectedValueOnce(new Error("Tauri IPC failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    tauriState.isTauri = true;
    await act(async () => { render(<InterruptHandler />); });

    const callback = tauriState.listeners.get("interrupt:fire");
    await act(async () => { if (callback) await callback(true); }); // mandatory=true

    // Error must be caught and logged — not propagated as unhandled rejection
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("IH-MANDATORY"),
      expect.any(Error)
    );
    // Navigation must still happen despite the IPC failure
    expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt");

    errorSpy.mockRestore();
  });

  // Task #166 live-testing fix (2026-08-10): the passive (non-mandatory) notification
  // path previously imported @tauri-apps/plugin-notification directly with zero test
  // coverage — now routed through lib/tauri.ts's gateway (already mocked above).
  describe("passive notification (isMandatory=false)", () => {
    function setupDueUnit() {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
    }

    it("sends a native notification with the due count when permission is already granted", async () => {
      setupDueUnit();
      mockIsNotificationPermissionGranted.mockResolvedValue(true);
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); }); // mandatory=false

      expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "1 card ready — 2 min study break?");
    });

    it("requests permission first when not yet granted, then sends on grant", async () => {
      setupDueUnit();
      mockIsNotificationPermissionGranted.mockResolvedValue(false);
      mockRequestNotificationPermission.mockResolvedValue("granted");
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "1 card ready — 2 min study break?");
    });

    it("does not send a notification when permission is refused", async () => {
      setupDueUnit();
      mockIsNotificationPermissionGranted.mockResolvedValue(false);
      mockRequestNotificationPermission.mockResolvedValue("denied");
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockSendNativeNotification).not.toHaveBeenCalled();
    });
  });

  // ── Test 3: updateInterruptConfig called when interruptEnabled changes ─────────
  it("calls updateInterruptConfig when interruptEnabled changes", async () => {
    // Use distinct values for the 4 new OS trigger fields so any argument-order swap
    // between them (wakeEnabled/unlockEnabled/idleEnabled/idleThresholdMinutes) is detectable.
    useSettingsStore.setState({
      interruptEnabled: false,
      intervalHours: 2,
      mandatory: false,
      wakeEnabled: false,
      unlockEnabled: true,
      idleEnabled: false,
      idleThresholdMinutes: 45,
    });

    await act(async () => {
      render(<InterruptHandler />);
    });
    // Called once on initial mount
    expect(mockUpdateInterruptConfig).toHaveBeenCalledOnce();

    // Changing interruptEnabled in the store triggers the effect's dep change
    await act(async () => {
      useSettingsStore.setState({ interruptEnabled: true });
    });
    expect(mockUpdateInterruptConfig).toHaveBeenCalledTimes(2);
    // toHaveBeenCalledTimes(2) guarantees calls[1] exists — non-null assertion is safe.
    // Assert all 7 arguments to catch any positional swap among the OS trigger fields.
    expect(mockUpdateInterruptConfig.mock.calls[1]).toEqual([
      true,   // enabled
      2,      // intervalHours
      false,  // mandatory
      false,  // wakeEnabled
      true,   // unlockEnabled
      false,  // idleEnabled
      45,     // idleThresholdMinutes
    ]);
  });

  // ── Test: validateLicense NOT called on mount — EntitlementValidator.tsx owns revalidation ─
  it("does not call validateLicense on mount", async () => {
    // EntitlementValidator.tsx (mounted in app/layout.tsx) is the sole owner of license
    // revalidation. Duplicate logic here caused two concurrent Lemon Squeezy API calls on
    // every app launch when validation was due. This test fails if the block is re-added.
    await act(async () => {
      render(<InterruptHandler />);
    });
    expect(vi.mocked(validateLicense)).not.toHaveBeenCalled();
  });

  // ── Task #166 Windows VM investigation (2026-08-12): resubscription-race regression ────────
  // Root cause of the intermittent "lock/unlock fires sometimes, not others" VM finding:
  // the interrupt:fire listener effect used to depend on pathname (among other things), so a
  // route change tore down and re-registered the Tauri listener via an async IPC round-trip —
  // leaving a real window with zero listeners where a real interrupt:fire would be silently,
  // permanently dropped. Both VM repro attempts navigated /study -> / right before locking.
  describe("interrupt:fire subscription stability (Task #166)", () => {
    it("subscribes to interrupt:fire exactly once, even as pathname and settings change across renders", async () => {
      tauriState.isTauri = true;
      const { rerender } = render(<InterruptHandler />);
      await act(async () => {});
      expect(vi.mocked(listen)).toHaveBeenCalledWith("interrupt:fire", expect.any(Function));
      const interruptFireCallCount = vi.mocked(listen).mock.calls.filter(
        (call) => call[0] === "interrupt:fire"
      ).length;
      expect(interruptFireCallCount).toBe(1);

      // Simulate the exact VM repro: navigate away from home, then back, then change a
      // couple of other settings the old deps array also included.
      navState.pathname = "/study";
      await act(async () => { rerender(<InterruptHandler />); });
      navState.pathname = "/";
      await act(async () => { rerender(<InterruptHandler />); });
      await act(async () => {
        useSettingsStore.setState({ dndStart: "23:00" });
      });

      // Still exactly one interrupt:fire registration for the component's whole lifetime —
      // this is the assertion that fails if pathname (or any other config field) is ever
      // put back into the subscription effect's dependency array.
      const finalInterruptFireCallCount = vi.mocked(listen).mock.calls.filter(
        (call) => call[0] === "interrupt:fire"
      ).length;
      expect(finalInterruptFireCallCount).toBe(1);
    });

    it("still respects the current pathname via the ref snapshot, without resubscribing", async () => {
      mockUseLangPack.mockReturnValue({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" }); // DnD off all day
      tauriState.isTauri = true;
      const { rerender } = render(<InterruptHandler />);
      await act(async () => {});

      const callback = tauriState.listeners.get("interrupt:fire");
      expect(typeof callback).toBe("function");

      // Navigate to /study — the single, never-torn-down listener must now suppress firing,
      // proving latestRef (not a stale closure) is what the handler reads.
      navState.pathname = "/study";
      await act(async () => { rerender(<InterruptHandler />); });
      if (callback) await act(async () => { callback(false); });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockSendNativeNotification).not.toHaveBeenCalled();

      // Navigate back home — the same listener (never resubscribed) must fire again.
      navState.pathname = "/";
      await act(async () => { rerender(<InterruptHandler />); });
      if (callback) await act(async () => { callback(false); });
      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "1 card ready — 2 min study break?");
    });
  });
});
