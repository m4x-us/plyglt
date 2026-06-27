/**
 * Tests for lib/tauri.ts.
 *
 * What IS testable here: environment detection and web-mode no-ops.
 *
 * What is NOT testable without the Tauri runtime: invoke(), listen(), emit(),
 * updateTrayBadge(), updateInterruptConfig(), snoozeInterrupt(), enterMandatoryMode(),
 * exitMandatoryMode(), enableAutostart(), disableAutostart(), checkForUpdates().
 * These all gate on isTauri and return null / no-op / early-return in web mode,
 * which is exactly what the tests below verify. The Rust IPC layer requires a
 * running Tauri webview and cannot be unit-tested here.
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
    const { updateInterruptConfig } = await import("@/lib/tauri");
    await expect(updateInterruptConfig(true, 1, false)).rejects.toThrow("IPC failed");
  });

  it("resolves successfully when invoke returns null (void command success in Tauri)", async () => {
    vi.resetModules();
    // Void commands return null on success — must NOT throw
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { updateInterruptConfig } = await import("@/lib/tauri");
    await expect(updateInterruptConfig(true, 1, false)).resolves.toBeUndefined();
  });

  it("returns void (no-op) in web mode — does not throw", async () => {
    // In web mode (no __TAURI_INTERNALS__), updateInterruptConfig must be silent
    const { updateInterruptConfig } = await import("@/lib/tauri");
    await expect(updateInterruptConfig(true, 1, false)).resolves.toBeUndefined();
  });
});

// #005 — snoozeInterrupt must throw when the Tauri IPC layer throws.
// Same note as #004: mock invoke to THROW, not return null.
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
    const { snoozeInterrupt } = await import("@/lib/tauri");
    await expect(snoozeInterrupt(30)).rejects.toThrow("IPC failed");
  });

  it("resolves successfully when invoke returns null (void command success in Tauri)", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { snoozeInterrupt } = await import("@/lib/tauri");
    await expect(snoozeInterrupt(30)).resolves.toBeUndefined();
  });

  it("returns void (no-op) in web mode — does not throw", async () => {
    const { snoozeInterrupt } = await import("@/lib/tauri");
    await expect(snoozeInterrupt(30)).resolves.toBeUndefined();
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

  it("validateLicense .then() has a .catch() with an ERR-VALIDATE- ref ID", () => {
    const content = readFileSync(resolve(process.cwd(), "components/InterruptHandler.tsx"), "utf-8");
    expect(content).toContain(".catch((err)");
    expect(content).toContain("ERR-VALIDATE-");
  });
});
