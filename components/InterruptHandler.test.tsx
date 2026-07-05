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
import { InterruptHandler } from "./InterruptHandler";

// ── vi.hoisted: all values referenced inside vi.mock factories must be hoisted ─
// vi.mock factories are hoisted to the top of the file; any const defined in the
// module body is in the temporal dead zone when the factory runs.
const { tauriState, mockUpdateInterruptConfig, mockPush, mockEnterMandatoryMode, mockUseLangPack } = vi.hoisted(() => ({
  tauriState: {
    isTauri: false as boolean,
    // Captures listen callbacks by event name so tests can fire them manually.
    listeners: new Map<string, (payload: unknown) => void>(),
  },
  mockUpdateInterruptConfig: vi.fn().mockResolvedValue(undefined),
  mockPush: vi.fn(),
  mockEnterMandatoryMode: vi.fn().mockResolvedValue(undefined),
  mockUseLangPack: vi.fn().mockReturnValue({ units: [], unitMap: {}, lang: { code: "it" }, loading: false, error: null }),
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
  usePathname: () => "/",
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
  vi.clearAllMocks();
  mockUpdateInterruptConfig.mockResolvedValue(undefined);
  mockEnterMandatoryMode.mockResolvedValue(undefined);
  mockUseLangPack.mockReturnValue({ units: [], unitMap: {}, lang: { code: "it" }, loading: false, error: null });
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
    expect(callback).toBeDefined();
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
});
