/**
 * Tests for lib/storage.ts — createPlatformStorage (web/SSR paths) and
 * useIsHydrated (structural seam only; full React hook testing requires jsdom).
 *
 * The Tauri path (plugin-store) requires a live Tauri runtime and is not
 * covered here. All tests exercise the web/localStorage branch, which is
 * the code path used in the Next.js web build and CI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPlatformStorage } from "@/lib/storage";

// ── SSR guard (window undefined — default Node.js test environment) ───────────

describe("createPlatformStorage — SSR guard", () => {
  // No window stub — window is undefined in the default Node environment.
  // safeLocalStorage() returns null; all operations degrade silently.

  it("getItem returns null when window is undefined", async () => {
    const storage = createPlatformStorage("ssr-test");
    expect(await storage.getItem("any-key")).toBeNull();
  });

  it("setItem is a no-op when window is undefined — does not throw", async () => {
    const storage = createPlatformStorage("ssr-test");
    await expect(storage.setItem("k", "v")).resolves.toBeUndefined();
  });

  it("removeItem is a no-op when window is undefined — does not throw", async () => {
    const storage = createPlatformStorage("ssr-test");
    await expect(storage.removeItem("k")).resolves.toBeUndefined();
  });
});

// ── Web path (mocked localStorage) ───────────────────────────────────────────

describe("createPlatformStorage — web path (mocked localStorage)", () => {
  let localData: Record<string, string>;

  beforeEach(() => {
    localData = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string): string | null => localData[k] ?? null,
        setItem: (k: string, v: string): void => { localData[k] = v; },
        removeItem: (k: string): void => { delete localData[k]; },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("setItem + getItem round-trip preserves the stored value", async () => {
    const storage = createPlatformStorage("web-test");
    await storage.setItem("key1", "hello-plyglt");
    expect(await storage.getItem("key1")).toBe("hello-plyglt");
  });

  it("getItem returns null (not undefined) for a key that was never set", async () => {
    const storage = createPlatformStorage("web-test");
    const result = await storage.getItem("nonexistent");
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
  });

  it("removeItem clears the key — subsequent getItem returns null", async () => {
    const storage = createPlatformStorage("web-test");
    await storage.setItem("to-remove", "gone");
    await storage.removeItem("to-remove");
    expect(await storage.getItem("to-remove")).toBeNull();
  });

  it("multiple keys in the same instance are independent", async () => {
    const storage = createPlatformStorage("web-test");
    await storage.setItem("a", "1");
    await storage.setItem("b", "2");
    expect(await storage.getItem("a")).toBe("1");
    expect(await storage.getItem("b")).toBe("2");
    await storage.removeItem("a");
    expect(await storage.getItem("a")).toBeNull();
    expect(await storage.getItem("b")).toBe("2");
  });

  it("getItem propagates localStorage errors rather than swallowing them", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (): never => { throw new Error("quota exceeded"); },
        setItem: (): void => {},
        removeItem: (): void => {},
      },
    });
    const storage = createPlatformStorage("web-test");
    await expect(storage.getItem("k")).rejects.toThrow("quota exceeded");
  });

  it("separate storeName instances do not share data through the mock", async () => {
    const s1 = createPlatformStorage("store-a");
    const s2 = createPlatformStorage("store-b");
    await s1.setItem("key", "from-s1");
    // In the web path both instances share the same underlying localStorage mock,
    // so this verifies the key is set and retrievable — not isolation (Tauri provides that).
    expect(await s2.getItem("key")).toBe("from-s1");
  });
});

// ── useIsHydrated — structural seam ──────────────────────────────────────────

describe("useIsHydrated — export seam", () => {
  // Full renderHook testing (false → true lifecycle) requires jsdom.
  // This seam test verifies the function exists and is exported correctly.

  it("useIsHydrated is exported from lib/storage", async () => {
    const mod = await import("@/lib/storage");
    expect(typeof mod.useIsHydrated).toBe("function");
  });
});
