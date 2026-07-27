// ============================================================
// storage.ts — Platform-aware persistent storage factory for Zustand stores
// ============================================================
/**
 * lib/storage.ts — Platform-aware persistent storage for Zustand.
 *
 * Web:    localStorage (synchronous, origin-scoped)
 * Tauri:  @tauri-apps/plugin-store (JSON file in OS appDataDir — survives
 *         browser cache clears, scoped to the app, not the browser profile)
 *
 * The Zustand persist middleware accepts async storage, so both backends
 * work transparently. The store hydrates asynchronously on first load;
 * use `useIsHydrated()` to gate UI that needs the full state.
 */

import { useState, useEffect, useSyncExternalStore } from "react";
import type { StateStorage } from "zustand/middleware";
import { isTauri } from "./tauri";

// ── Tauri Store loader ────────────────────────────────────────────────────────

type TauriStore = Awaited<ReturnType<typeof loadTauriStore>>;
const tauriStoreCache = new Map<string, TauriStore>();

async function loadTauriStore(storeName: string) {
  const { load } = await import("@tauri-apps/plugin-store");
  // autoSave: true — persists to disk on every set() automatically
  // defaults: {} — let the store start empty; Zustand persist writes the full state blob
  return load(`${storeName}.json`, { defaults: {}, autoSave: true });
}

// Safe accessor: returns null in Node.js (vitest / SSR) where localStorage is absent
function safeLocalStorage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

async function getStore(storeName: string): Promise<TauriStore | null> {
  if (!isTauri) return null;
  if (!tauriStoreCache.has(storeName)) {
    const store = await loadTauriStore(storeName);
    tauriStoreCache.set(storeName, store);
  }
  return tauriStoreCache.get(storeName) ?? null;
}

// ── Platform storage factory ──────────────────────────────────────────────────

/**
 * Returns a Zustand-compatible `StateStorage` that routes to Tauri Store
 * (desktop) or localStorage (web). Pass `storeName` as the logical name
 * (e.g. "srs-en-it") — Tauri appends ".json".
 */
export function createPlatformStorage(storeName: string): StateStorage {
  return {
    getItem: async (key: string): Promise<string | null> => {
      const store = await getStore(storeName);
      if (store) {
        return (await store.get<string>(key)) ?? null;
      }
      return safeLocalStorage()?.getItem(key) ?? null;
    },

    setItem: async (key: string, value: string): Promise<void> => {
      const store = await getStore(storeName);
      if (store) {
        await store.set(key, value);
        return;
      }
      safeLocalStorage()?.setItem(key, value);
    },

    removeItem: async (key: string): Promise<void> => {
      const store = await getStore(storeName);
      if (store) {
        await store.delete(key);
        return;
      }
      safeLocalStorage()?.removeItem(key);
    },
  };
}

// ── Hydration helper ──────────────────────────────────────────────────────────

type PersistApi = {
  persist: {
    hasHydrated(): boolean;
    onFinishHydration(fn: () => void): () => void;
  };
};

// Bounded fallback for a hydration that never finishes. Zustand persist's hydrate()
// awaits storage.getItem() before setting hasHydrated=true and firing onFinishHydration
// listeners (see node_modules/zustand/esm/middleware.mjs); if that promise rejects,
// persist's own .catch() branch runs instead and NEITHER ever happens — hasHydrated
// stays false forever with no signal any consumer can observe (Task #406). getItem's
// error-propagating contract itself must stay intact (lib/packCache.ts's readCacheMeta/
// readCacheData rely on it rejecting to log ERR-CACHE-META/ERR-CACHE-DATA), so the fix
// lives here instead, in the one shared place every hydration-gated screen already goes
// through: after this many ms with no successful hydration, stop waiting and report
// hydrated anyway (whatever state persist has, defaults if nothing loaded), logging the
// failure explicitly so it is never silent.
export const HYDRATION_FAILSAFE_MS = 3000;

/**
 * Returns true once the Zustand persist middleware has finished reading from
 * async storage. On web (localStorage) this is synchronous — always true on
 * first render, no flicker. On Tauri (file-based store) it is false until
 * the disk read completes.
 *
 * Usage: const hydrated = useIsHydrated(useSRSStore);
 *        if (!hydrated) return <LoadingScreen />;
 */
export function useIsHydrated(store: PersistApi): boolean {
  // useSyncExternalStore (not useState+useEffect) is the correct primitive here: it
  // re-reads getSnapshot() itself immediately after subscribing and forces a re-render
  // if the value changed in the window between the initial render and the subscribe
  // call — exactly the render/effect race that stranded hydrated=false forever when
  // hydration finished in that window (#406). Mirroring that re-check by hand with a
  // synchronous setState call in the effect body is also a react-hooks/set-state-in-effect
  // violation; useSyncExternalStore has no such call.
  const hydrated = useSyncExternalStore(
    (onStoreChange) => store.persist.onFinishHydration(onStoreChange),
    () => store.persist.hasHydrated(),
    () => false // getServerSnapshot: no persisted storage exists during SSR
  );

  // Bounded fallback for a hydration that never finishes (see HYDRATION_FAILSAFE_MS
  // above). setFailsafeExpired is only ever called from the setTimeout callback below,
  // never synchronously in the effect body.
  const [failsafeExpired, setFailsafeExpired] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const failsafe = setTimeout(() => {
      if (store.persist.hasHydrated()) return;
      console.error(
        `[plyglt] [ERR-HYDRATION-TIMEOUT] hydration did not finish within ${HYDRATION_FAILSAFE_MS}ms — proceeding as hydrated with whatever state is present (likely a storage read failure)`
      );
      setFailsafeExpired(true);
    }, HYDRATION_FAILSAFE_MS);
    return () => clearTimeout(failsafe);
  }, [store, hydrated]);

  return hydrated || failsafeExpired;
}
