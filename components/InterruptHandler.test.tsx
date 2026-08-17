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
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
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
  mockMarkInterruptFired,
  mockReadInterruptGateState,
  mockRecordInterruptGateEvent,
  mockUseLangPack,
  mockIsNotificationPermissionGranted,
  mockRequestNotificationPermission,
  mockSendNativeNotification,
  srsStoreState,
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
  // Task #526
  mockMarkInterruptFired: vi.fn().mockResolvedValue(undefined),
  // Task #529 — default: "known" with no gate history, i.e. safe to fire (matches a
  // brand-new user with no prior fired/snoozed events anywhere).
  mockReadInterruptGateState: vi.fn().mockResolvedValue({ status: "known", effectiveUntil: null }),
  mockRecordInterruptGateEvent: vi.fn().mockResolvedValue({ ok: true }),
  mockUseLangPack: vi.fn().mockReturnValue({ units: [], unitMap: {}, lang: { code: "it" }, loading: false, error: null }),
  mockIsNotificationPermissionGranted: vi.fn().mockResolvedValue(true),
  mockRequestNotificationPermission: vi.fn().mockResolvedValue("granted"),
  mockSendNativeNotification: vi.fn().mockResolvedValue(undefined),
  // Task #564: mutable so individual tests can push totalDue above INTERRUPT_SESSION_CAP
  // without redefining the whole srsStore mock. Reset to the original default (1) in
  // beforeEach.
  srsStoreState: { due: 1 },
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
  markInterruptFired: mockMarkInterruptFired,
  snoozeInterrupt: vi.fn().mockResolvedValue(undefined),
  exitMandatoryMode: vi.fn().mockResolvedValue(undefined),
  updateTrayBadge: vi.fn(),
}));

// ── interruptGate mock — shared cross-device gate (Task #529) ────────────────
vi.mock("@/lib/interruptGate", () => ({
  readInterruptGateState: mockReadInterruptGateState,
  recordInterruptGateEvent: mockRecordInterruptGateEvent,
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
// Task #523: computeDue (hooks/useInterruptConfig.ts) now also reads
// getIntroductionDueCardIds/canIntroduceNewCard/getNewCards — stubbed here to their
// "nothing extra due" defaults so existing due-count-only assertions are unaffected.
// Task #543: getNearDueCards added — this file's silent safety against a missing stub was
// previously incidental (getStats always returning non-zero due), not designed; a real stub
// here (even a simple no-op) closes that gap so an unrelated future change can't silently
// break this mock again.
vi.mock("@/store/srsStore", () => ({
  useSRSStore: {
    getState: () => ({
      getStats: () => ({ due: srsStoreState.due }),
      getIntroductionDueCardIds: () => [],
      canIntroduceNewCard: () => false,
      getNewCards: () => [],
      getNearDueCards: () => [],
    }),
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
  mockMarkInterruptFired.mockResolvedValue(undefined);
  mockReadInterruptGateState.mockResolvedValue({ status: "known", effectiveUntil: null });
  mockRecordInterruptGateEvent.mockResolvedValue({ ok: true });
  mockUseLangPack.mockReturnValue({ units: [], unitMap: {}, lang: { code: "it" }, loading: false, error: null });
  mockIsNotificationPermissionGranted.mockResolvedValue(true);
  mockRequestNotificationPermission.mockResolvedValue("granted");
  mockSendNativeNotification.mockResolvedValue(undefined);
  srsStoreState.due = 1;
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
  // Task #529: default signed-out / no local device id — every pre-existing test in this
  // file (written before #529) exercises the "no userId → skip the gate entirely, fire
  // anyway" path, so their assertions are unaffected by this reset.
  useAuthStore.setState({ status: "signed-out", userId: null, email: null });
  useSyncStore.setState({ deviceId: null });
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

  // ── Task #526: markInterruptFired confirms a real fire, and only a real fire ────────────
  describe("markInterruptFired (Task #526)", () => {
    it("is NOT called when totalDue === 0 (the early-return short-circuit)", async () => {
      // beforeEach's mockUseLangPack default returns units: [] — computeDue([]) === 0.
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" }); // DnD off all day
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockMarkInterruptFired).not.toHaveBeenCalled();
    });

    it("is NOT called when isInDnd() suppresses the fire before totalDue is even checked", async () => {
      useSettingsStore.setState({
        interruptEnabled: true,
        dndStart: "00:00", // covers the entire day
        dndEnd: "23:59",
      });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockMarkInterruptFired).not.toHaveBeenCalled();
    });

    it("is called exactly once when real content is shown on the mandatory path", async () => {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(true); }); // mandatory=true

      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt");
    });

    // Task #641: src-tauri/src/interrupt.rs documents emit_interrupt as fire-and-forget
    // with no queueing/retry — a genuine double-fire is possible. Deletion Test: removing
    // the interruptFireInFlightRef guard makes this fail (markInterruptFired/mockPush would
    // each be called twice, once per concurrent execution, instead of once).
    it("processes a second rapid-succession fire as a no-op while the first is still in flight", async () => {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      expect(typeof callback).toBe("function");

      // Fire twice back-to-back, BEFORE either call's async chain resolves — exactly the
      // fire-and-forget double-fire scenario the finding describes. Both calls are started
      // synchronously (neither awaited individually first) so the second genuinely lands
      // while the first is still mid-flight, not after it has already finished.
      await act(async () => {
        if (callback) {
          const first = callback(true);
          const second = callback(true);
          await Promise.all([first, second]);
        }
      });

      // Only the first fire actually processed — the second was blocked by the in-flight
      // guard before it reached any of the real work.
      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    // Task #614: this component navigates to /study?mode=interrupt and has no visibility
    // into whether the mount-fill effect on the other side of that navigation actually
    // reaches the session floor — that fill logic lives entirely in
    // hooks/useStudySession.ts, which this test file does not render. The assertion above
    // ("is called exactly once when real content is shown on the mandatory path") already
    // demonstrates the real, documented behavior this task addresses: markFired() fires as
    // soon as computeDue(units) > 0 and isMandatory is true — unconditionally, before
    // navigation, with no downstream confirmation that the opened session ends up non-empty.
    // A synthetic "mandatory + ultimately empty" test cannot be written meaningfully at this
    // layer without either rendering the real study route (out of this file's scope) or
    // faking a signal InterruptHandler.tsx does not currently receive from anywhere — see
    // this file's own comment above the `markFired` definition (Task #614) for why closing
    // this gap for real requires a change in app/study/page.tsx or useStudySession.ts,
    // both owned by a different stream this wave.

    it("is called exactly once when real content is shown on the passive (notification) path", async () => {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      mockIsNotificationPermissionGranted.mockResolvedValue(true);
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); }); // mandatory=false

      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
      expect(mockSendNativeNotification).toHaveBeenCalled();
    });

    it("logs the failure but still shows the interrupt when the IPC call rejects", async () => {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      mockMarkInterruptFired.mockRejectedValueOnce(new Error("Tauri IPC failed"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(true); }); // mandatory=true

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("IH-MARKFIRED"),
        expect.any(Error)
      );
      // The IPC failure must not block showing the interrupt.
      expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt");

      errorSpy.mockRestore();
    });
  });

  // ── Task #529: shared cross-device interrupt gate ───────────────────────────────────
  describe("shared cross-device interrupt gate (Task #529)", () => {
    function setupSignedInDueUnit() {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00", intervalHours: 2 });
      useAuthStore.setState({ status: "signed-in", userId: "user-1", email: null });
      useSyncStore.setState({ deviceId: "device-1" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
    }

    it("suppresses a local fire when a fresh 'fired' event from another device is still in effect", async () => {
      setupSignedInDueUnit();
      mockReadInterruptGateState.mockResolvedValue({
        status: "known",
        effectiveUntil: Date.now() + 60_000, // another device fired 1 minute from now or later
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockReadInterruptGateState).toHaveBeenCalledWith("user-1");
      // Suppressed before ever reaching the local "show content" logic.
      expect(mockMarkInterruptFired).not.toHaveBeenCalled();
      expect(mockSendNativeNotification).not.toHaveBeenCalled();
      expect(mockRecordInterruptGateEvent).not.toHaveBeenCalled();
    });

    it("fires locally when the gate's effectiveUntil has already passed", async () => {
      setupSignedInDueUnit();
      mockReadInterruptGateState.mockResolvedValue({
        status: "known",
        effectiveUntil: Date.now() - 60_000, // eligible again as of a minute ago
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
    });

    it("fires locally (fire-anyway fallback) when the gate read times out", async () => {
      setupSignedInDueUnit();
      mockReadInterruptGateState.mockResolvedValue({ status: "unknown", reason: "timeout" });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
    });

    it("fires locally without ever checking the gate when signed out (no userId)", async () => {
      // beforeEach already resets to signed-out; this test makes the intent explicit.
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockReadInterruptGateState).not.toHaveBeenCalled();
      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
      expect(mockRecordInterruptGateEvent).not.toHaveBeenCalled();
    });

    it("records a 'fired' event with the current interval-in-minutes on a real local fire", async () => {
      setupSignedInDueUnit();
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockRecordInterruptGateEvent).toHaveBeenCalledTimes(1);
      // toHaveBeenCalledTimes(1) guarantees calls[0] exists — non-null assertion is safe
      // (same pattern already used elsewhere in this file, e.g. the updateInterruptConfig test).
      const call = mockRecordInterruptGateEvent.mock.calls[0]![0];
      expect(call.userId).toBe("user-1");
      expect(call.deviceId).toBe("device-1");
      expect(call.eventType).toBe("fired");
      expect(call.minutesUntilEligible).toBe(120); // intervalHours=2 → 120 minutes
    });

    it("does not record a gate event when signed in but no local deviceId exists yet", async () => {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      useAuthStore.setState({ status: "signed-in", userId: "user-1", email: null });
      useSyncStore.setState({ deviceId: null }); // no review committed on this device yet
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      // The fire itself must still proceed normally.
      expect(mockMarkInterruptFired).toHaveBeenCalledTimes(1);
      expect(mockRecordInterruptGateEvent).not.toHaveBeenCalled();
    });

    it("logs a failure but does not block the fire when recordInterruptGateEvent rejects", async () => {
      setupSignedInDueUnit();
      mockRecordInterruptGateEvent.mockRejectedValueOnce(new Error("write failed"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });
      // Let the fire-and-forget recordInterruptGateEvent promise settle.
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      expect(mockSendNativeNotification).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("IH-GATE-WRITE"),
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });

  // ── Task #601: a throw from an unguarded step (readInterruptGateState) must not become
  // an unhandled rejection — the top-level try/catch logs it instead of dropping it silently.
  describe("top-level error handling (Task #601)", () => {
    it("logs the failure and does not crash when readInterruptGateState rejects", async () => {
      useSettingsStore.setState({ dndStart: "22:00", dndEnd: "22:00" });
      useAuthStore.setState({ status: "signed-in", userId: "user-1", email: null });
      useSyncStore.setState({ deviceId: "device-1" });
      mockUseLangPack.mockReturnValueOnce({
        units: [{ id: "u1", cards: [] }],
        unitMap: {},
        lang: { code: "it" },
        loading: false,
        error: null,
      });
      mockReadInterruptGateState.mockRejectedValueOnce(new Error("network down"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      // Prior to the #601 fix, this rejection propagated out of the async listener
      // callback uncaught — this call would otherwise leave an unhandled rejection.
      await act(async () => { if (callback) await callback(false); });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("ERR-INTERRUPT-FIRE"),
        expect.any(Error)
      );
      // The throw happened before any fire was confirmed — nothing downstream ran.
      expect(mockMarkInterruptFired).not.toHaveBeenCalled();
      expect(mockSendNativeNotification).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });
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
      // Batch 23: raw due count (1) is floored to INTERRUPT_SESSION_FLOOR (6) — the
      // notification must never undersell what the session will actually contain.
      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "6 cards ready — 2 min study break?");
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
      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "6 cards ready — 2 min study break?");
    });

    it("does not send a notification when permission is refused, and does not mark the interrupt as fired either (regression, Task #570)", async () => {
      setupDueUnit();
      mockIsNotificationPermissionGranted.mockResolvedValue(false);
      mockRequestNotificationPermission.mockResolvedValue("denied");
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockSendNativeNotification).not.toHaveBeenCalled();
      // Task #570: pre-fix, markInterruptFired/recordInterruptGateEvent fired
      // unconditionally BEFORE this permission check, silently advancing the
      // shared cross-device cooldown clock for a fire the user never saw.
      expect(mockMarkInterruptFired).not.toHaveBeenCalled();
      expect(mockRecordInterruptGateEvent).not.toHaveBeenCalled();
    });

    // Task #564: totalDue is a genuinely unbounded sum of FSRS-due cards across the
    // whole catalog, but app/study/page.tsx slices the opened session at
    // INTERRUPT_SESSION_CAP (8) — the notification must never announce more than
    // the session can actually deliver.
    it("caps the announced count at INTERRUPT_SESSION_CAP on a heavy backlog day (regression, Task #564)", async () => {
      setupDueUnit();
      srsStoreState.due = 40; // far above INTERRUPT_SESSION_CAP(8)
      mockIsNotificationPermissionGranted.mockResolvedValue(true);
      tauriState.isTauri = true;
      await act(async () => { render(<InterruptHandler />); });

      const callback = tauriState.listeners.get("interrupt:fire");
      await act(async () => { if (callback) await callback(false); });

      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "8 cards ready — 2 min study break?");
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

  // Task #633: the configSeqRef staleness guard existed only in the .catch() branch of the
  // updateInterruptConfig effect — the success path had no equivalent check, a real doc/code
  // mismatch (the comment on configSeqRef claims protection against exactly this race).
  // updateInterruptConfig resolves Promise<void> with no further JS-side action today, so this
  // specific guard is currently inert with respect to observable state — there is nothing a
  // stale resolution could visibly corrupt. What IS provable: forcing the exact "older resolves
  // after newer" ordering the finding describes must not throw or log an error from the new
  // success-path code, and the effect must still have issued both IPC calls with their own
  // correct, un-swapped argument sets regardless of resolution order.
  // Task #651: by the same "currently inert" property, this test's assertions below hold
  // identically whether the success-path `if (seq !== configSeqRef.current) return;` guard
  // exists or is deleted — a Deletion Test on that specific line would not fail. Not a hidden
  // gap: it's the direct, unavoidable consequence of the guard having nothing to guard yet
  // (see its own comment). This test is honestly scoped to what it CAN prove today (no
  // crash/log/argument-corruption on out-of-order resolution); it is not a regression test for
  // the success-path guard itself, which has no observable effect to regress until
  // updateInterruptConfig gains real post-resolution logic.
  it("does not crash or log an error when an older updateInterruptConfig call resolves after a newer one (Task #633)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolveOlder!: () => void;
    let resolveNewer!: () => void;
    mockUpdateInterruptConfig
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveOlder = resolve; }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveNewer = resolve; }));

    useSettingsStore.setState({
      interruptEnabled: false, intervalHours: 1.5, mandatory: false,
      wakeEnabled: true, unlockEnabled: true, idleEnabled: true, idleThresholdMinutes: 15,
    });
    await act(async () => {
      render(<InterruptHandler />);
    });
    // Second effect run — a real re-render before the first IPC call has resolved,
    // exactly the "rapid toggle" scenario the configSeqRef comment describes.
    await act(async () => {
      useSettingsStore.setState({ interruptEnabled: true });
    });
    expect(mockUpdateInterruptConfig).toHaveBeenCalledTimes(2);

    // Resolve out of order: the OLDER (first) call settles AFTER the newer (second) one.
    await act(async () => {
      resolveNewer();
    });
    await act(async () => {
      resolveOlder();
    });

    expect(errorSpy).not.toHaveBeenCalled();
    // Each call still carried its own correct arguments — resolution order never
    // retroactively changes what was actually sent over IPC.
    expect(mockUpdateInterruptConfig.mock.calls[0]![0]).toBe(false); // older: enabled=false
    expect(mockUpdateInterruptConfig.mock.calls[1]![0]).toBe(true); // newer: enabled=true

    errorSpy.mockRestore();
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
      expect(mockSendNativeNotification).toHaveBeenCalledWith("plyglt", "6 cards ready — 2 min study break?");
    });
  });
});
