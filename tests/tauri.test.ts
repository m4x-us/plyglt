/**
 * Tests for lib/tauri.ts and lib/tauriInterrupt.ts.
 *
 * What IS testable here: environment detection and web-mode no-ops.
 *
 * What IS testable via @tauri-apps/* mocks: updateInterruptConfig(), snoozeInterrupt(),
 * enterMandatoryMode(), exitMandatoryMode() (all in lib/tauriInterrupt.ts), checkForUpdates()
 * — tested via vi.doMock of the plugin modules below, using the same invoke()-mocking
 * technique for each (Task #506 corrected this comment — it previously claimed
 * enterMandatoryMode/exitMandatoryMode weren't unit-testable, which was never actually true).
 *
 * What is NOT testable without the Tauri runtime: invoke(), listen(), emit(),
 * updateTrayBadge(), enableAutostart(), disableAutostart() — these gate on isTauri and
 * return null / no-op in web mode, with no invoke()-mockable IPC error path of their own.
 * The Rust IPC layer's actual runtime behavior requires a running Tauri webview and cannot
 * be unit-tested here.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";

// isTauri is evaluated at module import time. The module must be re-imported
// inside each test that needs a different window environment, or we test the
// Node.js default (window undefined → isTauri === false).

describe("isTauri", () => {
  it("is false in the Node.js test environment (no window)", async () => {
    const { isTauri } = await import("@/lib/tauri");
    expect(isTauri).toBe(false);
  });
});

describe("web-mode no-ops", () => {
  it("invoke returns null when not in Tauri", async () => {
    const { invoke } = await import("@/lib/tauri");
    const result = await invoke("any_command");
    expect(result).toBeNull();
  });

  it("listen returns a no-op unlisten function when not in Tauri", async () => {
    const { listen } = await import("@/lib/tauri");
    const unlisten = await listen("any_event", () => {});
    expect(typeof unlisten).toBe("function");
    expect(() => unlisten()).not.toThrow();
  });

  it("emit resolves without throwing when not in Tauri", async () => {
    const { emit } = await import("@/lib/tauri");
    await expect(emit("any_event", { data: 1 })).resolves.toBeUndefined();
  });

  it("openExternalUrl calls window.open in web context", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("window", { open: openSpy, __TAURI_INTERNALS__: undefined });
    // Re-import to pick up the stubbed window — isTauri is recalculated
    const mod = await import("@/lib/tauri");
    // isTauri is still false because __TAURI_INTERNALS__ is undefined (not present as own key)
    await mod.openExternalUrl("https://example.com");
    expect(openSpy).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
  });

  it("onDeepLinkUrl returns a no-op unlisten function when not in Tauri", async () => {
    const { onDeepLinkUrl } = await import("@/lib/tauri");
    const unlisten = await onDeepLinkUrl(() => {});
    expect(typeof unlisten).toBe("function");
    expect(() => unlisten()).not.toThrow();
  });

  it("getCurrentDeepLinkUrls returns null when not in Tauri", async () => {
    const { getCurrentDeepLinkUrls } = await import("@/lib/tauri");
    const result = await getCurrentDeepLinkUrls();
    expect(result).toBeNull();
  });

  it("isNotificationPermissionGranted returns false when not in Tauri", async () => {
    const { isNotificationPermissionGranted } = await import("@/lib/tauri");
    expect(await isNotificationPermissionGranted()).toBe(false);
  });

  it("requestNotificationPermission returns 'denied' when not in Tauri", async () => {
    const { requestNotificationPermission } = await import("@/lib/tauri");
    expect(await requestNotificationPermission()).toBe("denied");
  });

  it("sendNativeNotification resolves without throwing and does not call the plugin when not in Tauri", async () => {
    const { sendNativeNotification } = await import("@/lib/tauri");
    await expect(sendNativeNotification("title", "body")).resolves.toBeUndefined();
  });
});

// Task #166 live-testing fix (2026-08-10) — components/InterruptHandler.tsx's actual
// notification-send path and app/settings/page.tsx's permission toggle must both go
// through this ONE gateway, not each check a different, independent permission system.
describe("native notifications — Tauri-mode wiring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("isNotificationPermissionGranted returns the plugin's isPermissionGranted() result", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted: vi.fn().mockResolvedValue(true),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { isNotificationPermissionGranted } = await import("@/lib/tauri");

    expect(await isNotificationPermissionGranted()).toBe(true);
  });

  it("requestNotificationPermission returns the plugin's requestPermission() result", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      requestPermission: vi.fn().mockResolvedValue("granted"),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { requestNotificationPermission } = await import("@/lib/tauri");

    expect(await requestNotificationPermission()).toBe("granted");
  });

  it("sendNativeNotification calls the plugin's sendNotification() with title and body", async () => {
    vi.resetModules();
    const sendNotificationMock = vi.fn();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      sendNotification: sendNotificationMock,
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { sendNativeNotification } = await import("@/lib/tauri");

    await sendNativeNotification("plyglt", "3 cards ready");

    expect(sendNotificationMock).toHaveBeenCalledWith({ title: "plyglt", body: "3 cards ready" });
  });
});

// Task #519 — desktop OAuth callback deep links
describe("deep links — Tauri-mode wiring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("onDeepLinkUrl registers the handler via the plugin's onOpenUrl and returns its unlisten function", async () => {
    vi.resetModules();
    const unlistenSpy = vi.fn();
    const onOpenUrlMock = vi.fn().mockResolvedValue(unlistenSpy);
    vi.doMock("@tauri-apps/plugin-deep-link", () => ({ onOpenUrl: onOpenUrlMock }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { onDeepLinkUrl } = await import("@/lib/tauri");

    const handler = vi.fn();
    const unlisten = await onDeepLinkUrl(handler);

    expect(onOpenUrlMock).toHaveBeenCalledWith(handler);
    expect(unlisten).toBe(unlistenSpy);
  });

  it("getCurrentDeepLinkUrls returns the plugin's getCurrent() result", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-deep-link", () => ({
      getCurrent: vi.fn().mockResolvedValue(["plyglt://auth-callback?code=abc"]),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { getCurrentDeepLinkUrls } = await import("@/lib/tauri");

    const result = await getCurrentDeepLinkUrls();
    expect(result).toEqual(["plyglt://auth-callback?code=abc"]);
  });

  it("getCurrentDeepLinkUrls returns null when the plugin reports none", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-deep-link", () => ({
      getCurrent: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { getCurrentDeepLinkUrls } = await import("@/lib/tauri");

    const result = await getCurrentDeepLinkUrls();
    expect(result).toBeNull();
  });
});

// #004 — updateInterruptConfig must throw when the Tauri IPC layer throws.
// NOTE: Tauri void commands return JSON null on SUCCESS — the old null-check
// pattern incorrectly fired on every successful call. The correct implementation
// uses try/catch, so tests must mock invoke to THROW (not return null).
// updateInterruptConfig now lives in lib/tauriInterrupt.ts (extracted from lib/tauri.ts).
describe("updateInterruptConfig — IPC error surfacing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("rejects with an error containing 'IPC failed' when invoke throws (mocked Tauri env)", async () => {
    vi.resetModules();
    // Mock @tauri-apps/api/core so invoke rejects — simulates Rust IPC failure
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockRejectedValue(new Error("Tauri IPC error")),
    }));
    // Make isTauri === true by adding __TAURI_INTERNALS__ to window
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { updateInterruptConfig } = await import("@/lib/tauriInterrupt");
    // Use distinct values for args 4-6 (wakeEnabled/unlockEnabled/idleEnabled) so any
    // positional swap between the new OS trigger parameters is detectable.
    await expect(updateInterruptConfig(true, 1, false, true, false, true, 20)).rejects.toThrow("IPC failed");
  });

  it("resolves successfully when invoke returns null (void command success in Tauri)", async () => {
    vi.resetModules();
    // Void commands return null on success — must NOT throw
    const mockInvoke = vi.fn().mockResolvedValue(null);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { updateInterruptConfig } = await import("@/lib/tauriInterrupt");
    await expect(updateInterruptConfig(true, 1, false, true, false, true, 20)).resolves.toBeUndefined();
    // Assert exact invoke call shape — catches argument-order swaps between OS trigger fields.
    expect(mockInvoke).toHaveBeenCalledWith("update_interrupt_config", {
      enabled: true,
      intervalHours: 1,
      mandatory: false,
      wakeEnabled: true,
      unlockEnabled: false,
      idleEnabled: true,
      idleThresholdMinutes: 20,
    });
  });

  it("returns void (no-op) in web mode — does not throw", async () => {
    // In web mode (no __TAURI_INTERNALS__), updateInterruptConfig must be silent
    const { updateInterruptConfig } = await import("@/lib/tauriInterrupt");
    await expect(updateInterruptConfig(true, 1, false, true, false, true, 20)).resolves.toBeUndefined();
  });
});

// #005 — snoozeInterrupt must throw when the Tauri IPC layer throws.
// Same note as #004: mock invoke to THROW, not return null.
// snoozeInterrupt now lives in lib/tauriInterrupt.ts (extracted from lib/tauri.ts).
describe("snoozeInterrupt — IPC error surfacing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("rejects with an error containing 'IPC failed' when invoke throws (mocked Tauri env)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockRejectedValue(new Error("Tauri IPC error")),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await expect(snoozeInterrupt(30)).rejects.toThrow("IPC failed");
  });

  it("resolves successfully when invoke returns null (void command success in Tauri)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await expect(snoozeInterrupt(30)).resolves.toBeUndefined();
  });

  it("returns void (no-op) in web mode — does not throw", async () => {
    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await expect(snoozeInterrupt(30)).resolves.toBeUndefined();
  });
});

// Task #530 — snoozeInterrupt also writes a shared, cross-device gate event via
// lib/interruptGate.ts's recordInterruptGateEvent when a gateContext (signed-in userId +
// known deviceId) is supplied, so a snooze on one device gives relief on every other of
// this user's devices too (docs/INTERRUPT_ARCHITECTURE.md §8). Purely additive: never
// changes the local-snooze IPC contract tested above, and a write failure here must never
// throw — the local snooze has already fully succeeded by the time this code runs.
describe("snoozeInterrupt — shared gate event (Task #530)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("calls recordInterruptGateEvent with eventType 'snoozed' and the exact given fields when gateContext is supplied", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
    const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock("@/lib/interruptGate", () => ({ recordInterruptGateEvent: mockRecordEvent }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await snoozeInterrupt(30, { userId: "user-1", deviceId: "device-1" });

    expect(mockRecordEvent).toHaveBeenCalledWith({
      userId: "user-1",
      deviceId: "device-1",
      eventType: "snoozed",
      occurredAt: expect.any(Number), // existence-check: real Date.now() call site, non-deterministic
      minutesUntilEligible: 30,
    });
  });

  it("does not call recordInterruptGateEvent when gateContext is omitted", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
    const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock("@/lib/interruptGate", () => ({ recordInterruptGateEvent: mockRecordEvent }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await snoozeInterrupt(30);

    expect(mockRecordEvent).not.toHaveBeenCalled();
  });

  it("does not call recordInterruptGateEvent in web mode, even when gateContext is supplied", async () => {
    const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock("@/lib/interruptGate", () => ({ recordInterruptGateEvent: mockRecordEvent }));

    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await snoozeInterrupt(30, { userId: "user-1", deviceId: "device-1" });

    expect(mockRecordEvent).not.toHaveBeenCalled();
  });

  it("does not call recordInterruptGateEvent when the local snooze IPC itself fails", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockRejectedValue(new Error("Tauri IPC error")),
    }));
    const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock("@/lib/interruptGate", () => ({ recordInterruptGateEvent: mockRecordEvent }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await expect(snoozeInterrupt(30, { userId: "user-1", deviceId: "device-1" })).rejects.toThrow("IPC failed");

    expect(mockRecordEvent).not.toHaveBeenCalled();
  });

  it("resolves successfully (does not throw) and logs an error when recordInterruptGateEvent fails", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
    vi.doMock("@/lib/interruptGate", () => ({
      recordInterruptGateEvent: vi.fn().mockResolvedValue({ ok: false, error: "network unreachable" }),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    await expect(snoozeInterrupt(30, { userId: "user-1", deviceId: "device-1" })).resolves.toBeUndefined();

    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(
      /^\[ERR-INTERRUPT-GATE-SNOOZE-\d+\] recordInterruptGateEvent failed for snooze:$/
    );
    consoleErrorSpy.mockRestore();
  });
});

// Task #530 acceptance criterion, proven end-to-end: "a device checking the gate shortly
// after respects a snooze event it didn't itself create." Runs the REAL lib/interruptGate.ts
// (recordInterruptGateEvent AND readInterruptGateState — not mocked, unlike the block above),
// backed by a fake in-memory Supabase client, so the only thing under test is whether a write
// from one device_id is visible to a read that supplies no device_id at all (readInterruptGateState
// scopes purely by user_id — this is the actual mechanism that makes cross-device sharing work).
describe("snoozeInterrupt + readInterruptGateState — cross-device visibility (Task #530)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("a snooze written by device-A is read back by a caller that never supplied any device id", async () => {
    vi.resetModules();
    // A prior test in this file registered a partial vi.doMock of @/lib/interruptGate —
    // doMock registrations outlive resetModules(), so this test must explicitly restore
    // the real module (it needs both recordInterruptGateEvent AND readInterruptGateState).
    vi.doUnmock("@/lib/interruptGate");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));

    interface FakeRow { user_id: string; effective_until: string }
    const rows: FakeRow[] = [];
    const fakeClient = {
      from: (table: string) => {
        if (table !== "interrupt_gate_events") throw new Error(`unexpected table: ${table}`);
        return {
          insert: async (row: FakeRow) => {
            rows.push(row);
            return { error: null };
          },
          select: () => ({
            eq: (_col: string, userId: string) => ({
              order: () => ({
                limit: () => ({
                  abortSignal: async () => {
                    const matches = rows
                      .filter((r) => r.user_id === userId)
                      .sort((a, b) => b.effective_until.localeCompare(a.effective_until));
                    return { data: matches.slice(0, 1), error: null };
                  },
                }),
              }),
            }),
          }),
        };
      },
    };
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => fakeClient }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    const { snoozeInterrupt } = await import("@/lib/tauriInterrupt");
    const { readInterruptGateState } = await import("@/lib/interruptGate");

    // "Device A" snoozes for 30 minutes.
    await snoozeInterrupt(30, { userId: "user-1", deviceId: "device-A" });

    // A read that has no notion of which device it's running on (readInterruptGateState
    // scopes purely by user_id) — simulating "device B" (or any other check-in) seeing the
    // same user's gate state.
    const gateState = await readInterruptGateState("user-1");

    // 2026-06-15T10:00:00.000Z + 30 minutes, exactly — proves the actual computed value,
    // not just "some timestamp in the future."
    expect(gateState).toEqual({ status: "known", effectiveUntil: new Date("2026-06-15T10:30:00.000Z").getTime() });

    // A different user's read is unaffected — the gate is scoped per user, not global.
    const otherUserState = await readInterruptGateState("user-2");
    expect(otherUserState).toEqual({ status: "known", effectiveUntil: null });

    vi.useRealTimers();
  });
});

// Task #506 (bundled F10) — enterMandatoryMode previously had no try/catch, unlike its 3
// siblings (updateInterruptConfig, snoozeInterrupt, exitMandatoryMode), all of which catch,
// log an ERR-IPC- ref, and rethrow. This block mirrors snoozeInterrupt's IPC error-surfacing
// tests above to prove the same contract now holds for enterMandatoryMode.
describe("enterMandatoryMode — IPC error surfacing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("rejects with an error containing 'IPC failed' when invoke throws (mocked Tauri env)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockRejectedValue(new Error("Tauri IPC error")),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { enterMandatoryMode } = await import("@/lib/tauriInterrupt");
    await expect(enterMandatoryMode()).rejects.toThrow("IPC failed");
  });

  it("resolves successfully when invoke returns null (void command success in Tauri)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { enterMandatoryMode } = await import("@/lib/tauriInterrupt");
    await expect(enterMandatoryMode()).resolves.toBeUndefined();
  });

  it("returns void (no-op) in web mode — does not throw", async () => {
    const { enterMandatoryMode } = await import("@/lib/tauriInterrupt");
    await expect(enterMandatoryMode()).resolves.toBeUndefined();
  });
});

// Task #526 — markInterruptFired is the only writer of src-tauri/src/interrupt.rs's
// last_triggered_secs clock (Task #524); mirrors the same IPC error-surfacing contract as
// its siblings above (catch, log an ERR-IPC- ref, rethrow).
describe("markInterruptFired — IPC error surfacing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("rejects with an error containing 'IPC failed' when invoke throws (mocked Tauri env)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockRejectedValue(new Error("Tauri IPC error")),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { markInterruptFired } = await import("@/lib/tauriInterrupt");
    await expect(markInterruptFired()).rejects.toThrow("IPC failed");
  });

  it("resolves successfully when invoke returns null (void command success in Tauri)", async () => {
    vi.resetModules();
    const invokeSpy = vi.fn().mockResolvedValue(null);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: invokeSpy }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { markInterruptFired } = await import("@/lib/tauriInterrupt");
    await expect(markInterruptFired()).resolves.toBeUndefined();
    // lib/tauri.ts's invoke() forwards a second (undefined) arg when the caller passes none.
    expect(invokeSpy).toHaveBeenCalledWith("mark_interrupt_fired", undefined);
  });

  it("returns void (no-op) in web mode — does not throw", async () => {
    const { markInterruptFired } = await import("@/lib/tauriInterrupt");
    await expect(markInterruptFired()).resolves.toBeUndefined();
  });
});

// #096 — checkForUpdates() must never call downloadAndInstall() without explicit caller consent
// This test fails with the old implementation (auto-installs) and passes after the fix
// (returns UpdateCheckResult so the caller controls install timing).
describe("checkForUpdates — security gate: never auto-installs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns { available: true, version, install } without calling downloadAndInstall", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-updater", () => ({
      check: vi.fn().mockResolvedValue({ available: true, version: "1.2.0", downloadAndInstall }),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { checkForUpdates } = await import("@/lib/tauri");

    const result = await checkForUpdates();

    // Must NOT auto-install — caller controls timing
    expect(downloadAndInstall).not.toHaveBeenCalled();
    // Must return structured result with install callback
    expect(result).toMatchObject({ available: true, version: "1.2.0" });
    expect(typeof (result as { available: true; version: string; install: () => Promise<void> }).install).toBe("function");
  });

  it("calling install() on the result triggers downloadAndInstall exactly once", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-updater", () => ({
      check: vi.fn().mockResolvedValue({ available: true, version: "1.2.0", downloadAndInstall }),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { checkForUpdates } = await import("@/lib/tauri");

    const result = await checkForUpdates();
    if (result.available) await result.install();

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  it("returns { available: false } when no update is available", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-updater", () => ({
      check: vi.fn().mockResolvedValue({ available: false }),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { checkForUpdates } = await import("@/lib/tauri");

    const result = await checkForUpdates();
    expect(result).toEqual({ available: false });
  });

  it("returns { available: false } in web mode without consulting the updater plugin", async () => {
    vi.resetModules();
    const checkSpy = vi.fn();
    vi.doMock("@tauri-apps/plugin-updater", () => ({ check: checkSpy }));
    // No __TAURI_INTERNALS__ → isTauri is false → check() must never be called
    const { checkForUpdates } = await import("@/lib/tauri");
    const result = await checkForUpdates();
    expect(result).toEqual({ available: false });
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it("returns { available: false } when check() throws (network / manifest error)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/plugin-updater", () => ({
      check: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { checkForUpdates } = await import("@/lib/tauri");

    const result = await checkForUpdates();
    expect(result).toEqual({ available: false });
  });
});

// #006 — InterruptHandler.tsx must not have bare catch {} blocks
describe("InterruptHandler.tsx — no bare catch blocks (source seam)", () => {
  it("components/InterruptHandler.tsx contains no bare 'catch {'", () => {
    const content = readFileSync(resolve(process.cwd(), "components/InterruptHandler.tsx"), "utf-8");
    expect(content).not.toMatch(/catch\s*\{/);
  });

  it("components/InterruptHandler.tsx logs notification errors with ERR-NOTIF- ref ID", () => {
    const content = readFileSync(resolve(process.cwd(), "components/InterruptHandler.tsx"), "utf-8");
    expect(content).toContain("ERR-NOTIF-");
  });

  it("validateLicense is not imported or called in InterruptHandler.tsx (Task #154 — EntitlementValidator owns revalidation)", () => {
    const content = readFileSync(resolve(process.cwd(), "components/InterruptHandler.tsx"), "utf-8");
    expect(content).not.toContain("validateLicense");
    expect(content).not.toContain("ERR-VALIDATE-");
  });
});
