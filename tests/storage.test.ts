// @vitest-environment jsdom
// ============================================================
// tests/storage.test.ts — Storage factory and useIsHydrated behavioral tests
// ============================================================
// jsdom environment: required for useIsHydrated (uses useState + useEffect)
// and for Tauri path tests that need window.__TAURI_INTERNALS__ detection.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createPlatformStorage, useIsHydrated, HYDRATION_FAILSAFE_MS } from "@/lib/storage";

// ── Module mocks (hoisted — apply to all tests) ───────────────────────────────

// isTauri mock: default false (web mode). Tauri describe blocks set to true.
vi.mock("@/lib/tauri", () => ({
  isTauri: false,
  invoke: vi.fn(),
  listen: vi.fn(),
}));

import * as tauriLib from "@/lib/tauri";

// Tauri plugin-store mock: behaves as an in-memory key-value store.
// `load` returns the same mock store object each call (shared per mock lifecycle).
const tauriData = new Map<string, unknown>();
const mockTauriStore = {
  get: vi.fn((key: string) => tauriData.get(key) ?? null),
  set: vi.fn((key: string, value: unknown): void => { tauriData.set(key, value); }),
  delete: vi.fn((key: string): void => { tauriData.delete(key); }),
};
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockTauriStore),
}));

// ── SSR guard ─────────────────────────────────────────────────────────────────
// In jsdom, window is defined. Simulate SSR by deleting localStorage.

describe("createPlatformStorage — SSR guard (no localStorage)", () => {
  let savedLocalStorage: Storage;

  beforeEach(() => {
    // Remove localStorage to simulate SSR / environments with no storage
    savedLocalStorage = window.localStorage;
    Object.defineProperty(window, "localStorage", { value: undefined, configurable: true, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", { value: savedLocalStorage, configurable: true, writable: true });
  });

  it("getItem returns null when localStorage is absent", async () => {
    const storage = createPlatformStorage("ssr-test");
    expect(await storage.getItem("any-key")).toBeNull();
  });

  it("setItem is a no-op when localStorage is absent — does not throw", async () => {
    const storage = createPlatformStorage("ssr-test");
    await expect(storage.setItem("k", "v")).resolves.toBeUndefined();
  });

  it("removeItem is a no-op when localStorage is absent — does not throw", async () => {
    const storage = createPlatformStorage("ssr-test");
    await expect(storage.removeItem("k")).resolves.toBeUndefined();
  });
});

// ── Web path (jsdom localStorage) ────────────────────────────────────────────

describe("createPlatformStorage — web path (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
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
    // getItem must keep rejecting on a storage error (not swallow it): lib/packCache.ts's
    // readCacheMeta/readCacheData rely on that rejection to log ERR-CACHE-META/
    // ERR-CACHE-DATA with a specific ref ID (Rule 8). The hydration-hang fix (#406) for
    // stores gated by useIsHydrated lives in useIsHydrated's own failsafe timeout instead
    // of here, so this contract is unchanged — see the "useIsHydrated — failsafe" tests.
    const saved = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => { throw new Error("quota exceeded"); },
        setItem: () => {},
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    });
    const storage = createPlatformStorage("web-err-test");
    await expect(storage.getItem("k")).rejects.toThrow("quota exceeded");
    if (saved) Object.defineProperty(window, "localStorage", saved);
  });

  it("separate storeName instances share underlying localStorage (web: no isolation)", async () => {
    const s1 = createPlatformStorage("store-a");
    const s2 = createPlatformStorage("store-b");
    await s1.setItem("key", "from-s1");
    expect(await s2.getItem("key")).toBe("from-s1");
  });
});

// ── Tauri path (mocked plugin-store) ─────────────────────────────────────────

describe("createPlatformStorage — Tauri path (mocked plugin-store)", () => {
  beforeEach(() => {
    (tauriLib as { isTauri: boolean }).isTauri = true;
    tauriData.clear();
    mockTauriStore.get.mockClear();
    mockTauriStore.set.mockClear();
    mockTauriStore.delete.mockClear();
  });

  afterEach(() => {
    (tauriLib as { isTauri: boolean }).isTauri = false;
  });

  it("setItem calls store.set with the key and value (covers lines 66–67)", async () => {
    const storage = createPlatformStorage("tauri-set-test");
    await storage.setItem("tauri-key", "tauri-val");
    expect(mockTauriStore.set).toHaveBeenCalledWith("tauri-key", "tauri-val");
  });

  it("removeItem calls store.delete with the key (covers lines 75–76)", async () => {
    const storage = createPlatformStorage("tauri-del-test");
    await storage.removeItem("tauri-key");
    expect(mockTauriStore.delete).toHaveBeenCalledWith("tauri-key");
  });

  it("getItem reads from Tauri store — round-trip via set then get", async () => {
    const storage = createPlatformStorage("tauri-rt-test");
    await storage.setItem("rt-key", "rt-value");
    const result = await storage.getItem("rt-key");
    expect(result).toBe("rt-value");
  });

  it("getItem propagates a rejecting Tauri store.get rather than swallowing it", async () => {
    mockTauriStore.get.mockRejectedValueOnce(new Error("disk read failed"));
    const storage = createPlatformStorage("tauri-err-test");
    await expect(storage.getItem("k")).rejects.toThrow("disk read failed");
  });
});

// ── useIsHydrated — behavioral hook tests ────────────────────────────────────

describe("useIsHydrated — hook behavioral tests (covers lines 102–110)", () => {
  it("returns true immediately when store is already hydrated", () => {
    const store = {
      persist: {
        hasHydrated: vi.fn().mockReturnValue(true),
        onFinishHydration: vi.fn(() => vi.fn()),
      },
    };
    const { result } = renderHook(() => useIsHydrated(store));
    expect(result.current).toBe(true);
  });

  it("returns false initially and transitions to true when onFinishHydration fires", async () => {
    let hydrateCallback: (() => void) | undefined;
    let hasHydratedFlag = false;
    const store = {
      persist: {
        // Mirrors real Zustand persist: hasHydrated is set true BEFORE finish listeners
        // are invoked (see node_modules/zustand/esm/middleware.mjs hydrate()).
        hasHydrated: vi.fn(() => hasHydratedFlag),
        onFinishHydration: vi.fn((fn: () => void) => {
          hydrateCallback = fn;
          return vi.fn(); // unsubscribe
        }),
      },
    };

    const { result } = renderHook(() => useIsHydrated(store));
    expect(result.current).toBe(false);
    expect(store.persist.onFinishHydration).toHaveBeenCalledTimes(1);

    act(() => {
      hasHydratedFlag = true;
      hydrateCallback?.();
    });

    expect(result.current).toBe(true);
  });

  it("does not miss a hydration event that fires between the initial snapshot read and subscribing — closes the render/effect race (#406)", () => {
    // Before #406, hydrated was mirrored into useState at render time and re-checked
    // only via a plain effect; hydration finishing in the window between that render
    // and the effect subscribing would strand hydrated=false forever (onFinishHydration
    // only notifies listeners of the NEXT hydration to finish). useSyncExternalStore
    // re-reads getSnapshot() itself right after subscribing and forces a re-render if
    // it changed in that window — this simulates exactly that window.
    let calls = 0;
    const store = {
      persist: {
        // false on the first (render) read, true on every read after — simulates
        // hydration completing in the window between render and subscribe.
        hasHydrated: vi.fn(() => { calls++; return calls > 1; }),
        onFinishHydration: vi.fn(() => vi.fn()),
      },
    };
    const { result } = renderHook(() => useIsHydrated(store));
    expect(result.current).toBe(true);
  });

  describe("failsafe timeout — hydration that never finishes (#406)", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("flips to hydrated=true and logs ERR-HYDRATION-TIMEOUT after HYDRATION_FAILSAFE_MS when hasHydrated never becomes true", () => {
      // Simulates a storage.getItem rejection: Zustand persist's hydrate() takes its
      // .catch() branch, hasHydrated stays false forever, onFinishHydration never fires.
      // Before #406 this hook would wait forever; the failsafe timer is the terminal state.
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = {
        persist: {
          hasHydrated: vi.fn().mockReturnValue(false),
          onFinishHydration: vi.fn(() => vi.fn()),
        },
      };
      const { result } = renderHook(() => useIsHydrated(store));
      expect(result.current).toBe(false);

      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });

      expect(result.current).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-HYDRATION-TIMEOUT"));
      errorSpy.mockRestore();
    });

    it("does not log a spurious timeout when hydration finishes normally before the failsafe fires", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let hydrateCallback: (() => void) | undefined;
      let hasHydratedFlag = false;
      const store = {
        persist: {
          hasHydrated: vi.fn(() => hasHydratedFlag),
          onFinishHydration: vi.fn((fn: () => void) => {
            hydrateCallback = fn;
            return vi.fn();
          }),
        },
      };
      const { result } = renderHook(() => useIsHydrated(store));
      expect(result.current).toBe(false);

      act(() => {
        hasHydratedFlag = true;
        hydrateCallback?.();
      });
      expect(result.current).toBe(true);

      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("clears the failsafe timer on unmount — no state update after the component is gone", () => {
      const store = {
        persist: {
          hasHydrated: vi.fn().mockReturnValue(false),
          onFinishHydration: vi.fn(() => vi.fn()),
        },
      };
      const { unmount } = renderHook(() => useIsHydrated(store));
      unmount();
      expect(() => act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); })).not.toThrow();
    });
  });
});
