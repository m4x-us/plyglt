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

import { useState, useEffect } from "react";
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
  const [hydrated, setHydrated] = useState(() => store.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return store.persist.onFinishHydration(() => setHydrated(true));
    // store is a module-level singleton (stable reference); hydrated is excluded
    // because adding it would unsubscribe/resubscribe on every hydration tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return hydrated;
}
