/**
 * Tests for lib/tauri.ts and lib/tauriInterrupt.ts.
 *
 * What IS testable here: environment detection and web-mode no-ops.
 *
 * What IS testable via @tauri-apps/* mocks: updateInterruptConfig(), snoozeInterrupt()
 * (now in lib/tauriInterrupt.ts), checkForUpdates() — tested via vi.doMock of the
 * plugin modules below.
 *
 * What is NOT testable without the Tauri runtime: invoke(), listen(), emit(),
 * updateTrayBadge(), enterMandatoryMode(), exitMandatoryMode(), enableAutostart(),
 * disableAutostart() — these gate on isTauri and return null / no-op in web mode.
 * The Rust IPC layer requires a running Tauri webview and cannot be unit-tested here.
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
