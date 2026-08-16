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

// A minimal but faithful Zustand-persist-shaped store: setState triggers subscribe
// listeners, and __simulateLateHydration mirrors persist's hydrate() exactly —
// set(merge(persisted, live)) THEN hasHydrated=true THEN notify finish listeners
// (see node_modules/zustand/esm/middleware.mjs) — before firing onFinishHydration.
// Hoisted to module scope (Task #606) so both the original scalar-field reconciliation
// describe block below and the new map-shaped-field one can share it.
function makeFullStore<T extends object>(initial: T) {
  let state = initial;
  let hydrated = false;
  const listeners = new Set<(s: T) => void>();
  const finishListeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (partial: Partial<T>) => {
      state = { ...state, ...partial };
      listeners.forEach((l) => l(state));
    },
    subscribe: (listener: (s: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    persist: {
      hasHydrated: () => hydrated,
      onFinishHydration: (fn: () => void) => {
        finishListeners.add(fn);
        return () => finishListeners.delete(fn);
      },
    },
    __simulateLateHydration: (persisted: Partial<T>) => {
      state = { ...state, ...persisted };
      listeners.forEach((l) => l(state));
      hydrated = true;
      finishListeners.forEach((fn) => fn());
    },
    // Test-only introspection (#452): the Set's SIZE, unlike a call-count spy on
    // onFinishHydration, is immune to React's per-render base-subscription churn
    // (useSyncExternalStore recreates its subscribe closure every render since this
    // hook doesn't memoize it, causing an unsub+resub pair — net zero size change —
    // on any unrelated re-render). A genuinely new registration (the failsafe's own
    // late-reconciliation listener) is the only thing that changes the net size.
    __finishListenerCount: () => finishListeners.size,
  };
}

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

  describe("late real-hydration merge reconciliation (#435)", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("restores a live write that a late real-hydration merge would otherwise silently clobber", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = makeFullStore({ count: 0, theme: "light" });

      const { result } = renderHook(() => useIsHydrated(store));
      expect(result.current).toBe(false);

      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });
      expect(result.current).toBe(true); // app proceeds on the failsafe

      // User acts during the failsafe-to-real-hydration window.
      act(() => { store.setState({ count: 5 }); });
      expect(store.getState().count).toBe(5);

      // Real hydration finishes late with stale persisted data for the field the user
      // just changed, plus a field the user never touched.
      act(() => { store.__simulateLateHydration({ count: 1, theme: "dark" }); });

      // The live write survives...
      expect(store.getState().count).toBe(5);
      // ...but a field the user never touched still takes the persisted value normally —
      // reconciliation must not blanket-revert the whole merge.
      expect(store.getState().theme).toBe("dark");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-HYDRATION-LATE-MERGE"));
      errorSpy.mockRestore();
    });

    it("does not touch state when real hydration finishes late but the user made no writes", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = makeFullStore({ count: 0, theme: "light" });

      renderHook(() => useIsHydrated(store));
      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });

      act(() => { store.__simulateLateHydration({ count: 7, theme: "dark" }); });

      expect(store.getState()).toEqual({ count: 7, theme: "dark" });
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("ERR-HYDRATION-LATE-MERGE"));
      errorSpy.mockRestore();
    });

    it("does not reconcile when hydration finishes normally (no failsafe, no clobber risk)", () => {
      // Task #452: the original version of this test never advanced fake timers past
      // HYDRATION_FAILSAFE_MS, so the failsafe's setTimeout callback — the ONLY place that
      // registers the late-reconciliation listener — never fired. Deleting the entire
      // reconciliation feature left this test passing identically, because "no clobbering
      // happened" is observationally identical to "no reconciliation code exists" whenever
      // nothing needs restoring. __finishListenerCount() gives this test a real Deletion
      // Test instead: the failsafe's own late-reconciliation listener is a genuinely NEW
      // registration in the finish-listener Set, on top of the base useSyncExternalStore
      // subscription — Set SIZE (not a raw call-count spy, which this hook's per-render
      // subscribe-closure churn makes noisy/unstable) only grows when that registration
      // actually happens. Delete it and the size stays at 1 forever.
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = makeFullStore({ count: 0 });

      renderHook(() => useIsHydrated(store));
      expect(store.__finishListenerCount()).toBe(1); // base subscription only

      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });
      expect(store.__finishListenerCount()).toBe(2); // + the failsafe's own registration

      // Hydration then finishes with nothing to reconcile (no prior user writes) — the
      // normal, non-degraded outcome this test's name describes.
      act(() => { store.__simulateLateHydration({ count: 3 }); });

      expect(store.getState().count).toBe(3);
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("ERR-HYDRATION-LATE-MERGE"));
      errorSpy.mockRestore();
    });
  });

  describe("late real-hydration merge reconciliation — map-shaped fields (Task #606, severity-9 data-loss regression)", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    // The real bug: srsStore's `introductions` map starts empty pre-hydration. A write
    // during the failsafe window (e.g. hooks/useStudySession.ts's mount-fill effect
    // calling introduceCard()) adds one record. Real hydration then finishes late with
    // the user's actual persisted history — accumulated across many real sessions,
    // correctly NOT containing the live write's card (the disk read predates it). The
    // pre-fix reconciliation replaced the WHOLE `introductions` field with the
    // single-record live-write snapshot, discarding every real persisted entry. Deletion
    // Test: reverting the per-subkey merge back to a blanket `clobbered[key] = preMerge[key]`
    // makes this test fail — `introductions` would equal only `{cardA: ...}`, losing
    // cardX/cardY entirely.
    it("preserves the real persisted map's other entries AND the live write made during the failsafe window", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Starts empty — mirrors a real persisted store's pre-hydration default.
      const store = makeFullStore({ introductions: {} as Record<string, string> });

      const { result } = renderHook(() => useIsHydrated(store));
      expect(result.current).toBe(false);

      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });
      expect(result.current).toBe(true); // app proceeds on the failsafe

      // A real write lands during the failsafe-to-real-hydration window.
      act(() => {
        store.setState({ introductions: { cardA: "recordA-from-live-write" } });
      });
      expect(store.getState().introductions).toEqual({ cardA: "recordA-from-live-write" });

      // Real hydration finishes late with the user's actual, larger persisted history.
      act(() => {
        store.__simulateLateHydration({
          introductions: { cardX: "recordX-real-history", cardY: "recordY-real-history" },
        });
      });

      // Both the real persisted history AND the live write must survive.
      expect(store.getState().introductions).toEqual({
        cardX: "recordX-real-history",
        cardY: "recordY-real-history",
        cardA: "recordA-from-live-write",
      });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-HYDRATION-LATE-MERGE"));
      errorSpy.mockRestore();
    });

    it("still restores a live write on a scalar field exactly as before — the map-field diff branch does not regress the existing scalar path", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = makeFullStore({ count: 0, introductions: {} as Record<string, string> });

      renderHook(() => useIsHydrated(store));
      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });

      act(() => { store.setState({ count: 5 }); });
      act(() => {
        store.__simulateLateHydration({ count: 1, introductions: { cardX: "recordX" } });
      });

      expect(store.getState().count).toBe(5); // scalar path: whole-field replace, unchanged
      // introductions was never touched during the window — no clobber, no reconciliation.
      expect(store.getState().introductions).toEqual({ cardX: "recordX" });
      errorSpy.mockRestore();
    });

    it("does not touch a map-shaped field the user never wrote to during the window", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = makeFullStore({ introductions: {} as Record<string, string> });

      renderHook(() => useIsHydrated(store));
      act(() => { vi.advanceTimersByTime(HYDRATION_FAILSAFE_MS); });

      act(() => {
        store.__simulateLateHydration({ introductions: { cardX: "recordX", cardY: "recordY" } });
      });

      expect(store.getState().introductions).toEqual({ cardX: "recordX", cardY: "recordY" });
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("ERR-HYDRATION-LATE-MERGE"));
      errorSpy.mockRestore();
    });
  });
});
