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
 *
 * Return type pins StateStorage's generic to `Promise<void>` (setItem/removeItem's
 * actual inferred return type below, left as the interface's `unknown` default
 * previously) so this satisfies Supabase's stricter `SupportedStorage` shape when
 * used as an `auth.storage` adapter (lib/supabaseClient.ts, Task #514) — zero
 * behavior change, this only makes the declared type match what was already true.
 */
export function createPlatformStorage(storeName: string): StateStorage<Promise<void>> {
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

// Task #606: identifies a map-shaped top-level field (e.g. srsStore's `introductions`)
// so the late-merge reconciliation below can diff it per-subkey instead of replacing it
// wholesale. Deliberately excludes arrays and null — this app's persisted stores only
// ever use plain `Record<string, X>` objects for map-shaped fields.
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type PersistApi<T = unknown> = {
  // getState/setState/subscribe are the plain Zustand store API (present on every real
  // store hook); optional here only so existing minimal test doubles that supply just
  // `persist` keep type-checking. Without them the failsafe-reconciliation path below
  // is skipped — the hook still degrades to its pre-#435 behaviour.
  getState?(): T;
  setState?(partial: Partial<T>): void;
  subscribe?(listener: (state: T) => void): () => void;
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
// useSyncExternalStore (not useState+useEffect) is the correct primitive here: it
// re-reads getSnapshot() itself immediately after subscribing and forces a re-render
// if the value changed in the window between the initial render and the subscribe
// call — exactly the render/effect race that stranded hydrated=false forever when
// hydration finished in that window (#406). Mirroring that re-check by hand with a
// synchronous setState call in the effect body is also a react-hooks/set-state-in-effect
// violation; useSyncExternalStore has no such call. Shared by useIsHydrated (below) and
// useIsHydratedStrict (Task #606) so both track the exact same real hydration signal.
function useRealHydrated<T extends object>(store: PersistApi<T>): boolean {
  return useSyncExternalStore(
    (onStoreChange) => store.persist.onFinishHydration(onStoreChange),
    () => store.persist.hasHydrated(),
    () => false // getServerSnapshot: no persisted storage exists during SSR
  );
}

/**
 * Task #606 (severity 9 data-loss fix): the STRICT hydration signal — reflects ONLY
 * real `persist.hasHydrated()`, NEVER useIsHydrated's HYDRATION_FAILSAFE_MS fallback.
 *
 * useIsHydrated's failsafe exists to unblock READS: don't leave the user staring at a
 * loading screen forever if storage is stuck. That is a reasonable trade-off for reads.
 * It is NOT a reasonable trade-off for a consumer that WRITES new persisted state —
 * e.g. hooks/useStudySession.ts's mount-fill effect calling introduceCard(), which does
 * `set((s) => ({introductions: {...s.introductions, [cardId]: record}}))`. If that write
 * fires against the pre-hydration empty default (because the failsafe opened the gate
 * before real hydration finished), the late-merge reconciliation below is the only thing
 * standing between that write and silently losing it — and for a top-level scalar field
 * that reconciliation is exact, but it used to blanket-replace a map-shaped field
 * (like `introductions`) with the single-record pre-hydration snapshot, discarding every
 * other real persisted entry. The per-subkey merge added below closes that specific hole,
 * but the root-cause fix is to never let a write race ahead of real hydration in the
 * first place: a consumer that creates/mutates persisted state should gate on THIS
 * export, not the lenient `useIsHydrated()`, so it waits for the genuine thing instead of
 * leaning on reconciliation-after-the-fact as its only safety net.
 *
 * Wiring this into hooks/useStudySession.ts's mount-fill effect is a coordination item
 * for whichever stream owns that file next — this task ships the strict signal itself,
 * not every call site that should switch to it (see completion.md).
 */
export function useIsHydratedStrict<T extends object = Record<string, unknown>>(store: PersistApi<T>): boolean {
  return useRealHydrated(store);
}

export function useIsHydrated<T extends object = Record<string, unknown>>(store: PersistApi<T>): boolean {
  const hydrated = useRealHydrated(store);

  // Bounded fallback for a hydration that never finishes (see HYDRATION_FAILSAFE_MS
  // above). setFailsafeExpired is only ever called from the setTimeout callback below,
  // never synchronously in the effect body.
  const [failsafeExpired, setFailsafeExpired] = useState(false);
  useEffect(() => {
    if (hydrated) return;

    // #435: track live state through the failsafe-to-real-hydration window. Zustand
    // persist's hydrate() merges the freshly-loaded persisted blob over whatever the
    // store's live state is at that moment (`{...currentState, ...persistedState}` —
    // persisted fields win on overlap), calling set() BEFORE notifying onFinishHydration
    // listeners. If real hydration finishes late (after the failsafe already told the
    // app to proceed), that merge silently discards any writes the user made in between.
    // `previousState` always trails `currentState` by exactly one change — including the
    // merge's own change — so when the late-merge notification fires below, `previousState`
    // holds the pre-merge (live) value while getState() already reflects the post-merge
    // value. A field is only ever restored if BOTH (a) the user actually changed it during
    // the window (differs from `snapshotAtExpiry`, the state when the failsafe fired) AND
    // (b) the merge overwrote that change — otherwise a field the user never touched but
    // that legitimately differs after a correct hydration (e.g. a persisted setting loading
    // in for the first time) would be wrongly reverted back to its pre-hydration default.
    let previousState: T | undefined;
    let currentState: T | undefined;
    const unsubscribeState = store.subscribe?.((state) => {
      previousState = currentState;
      currentState = state;
    });

    let unsubscribeLate: (() => void) | undefined;
    const failsafe = setTimeout(() => {
      if (store.persist.hasHydrated()) return;
      console.error(
        `[plyglt] [ERR-HYDRATION-TIMEOUT] hydration did not finish within ${HYDRATION_FAILSAFE_MS}ms — proceeding as hydrated with whatever state is present (likely a storage read failure)`
      );
      setFailsafeExpired(true);

      const { getState, setState } = store;
      if (getState && setState) {
        const snapshotAtExpiry = getState();
        unsubscribeLate = store.persist.onFinishHydration(() => {
          const preMerge = previousState ?? snapshotAtExpiry;
          const postMerge = getState();
          const clobbered: Partial<T> = {};
          for (const key of Object.keys(snapshotAtExpiry as object) as (keyof T)[]) {
            const userTouched = !Object.is(preMerge[key], snapshotAtExpiry[key]);
            if (!userTouched || Object.is(postMerge[key], preMerge[key])) continue;

            // Task #606 (severity 9 data-loss fix): a top-level field whose value is a
            // plain object (e.g. srsStore's `introductions` map) must NOT be restored
            // with a blanket whole-field replace the way a scalar field safely can be.
            // `preMerge[key]` here is only the single-record snapshot from the instant
            // before real hydration's merge — it does not contain the user's full
            // persisted history the way `postMerge[key]` (the real, fully-hydrated
            // value) does. Replacing postMerge[key] outright with preMerge[key] would
            // restore the live write while silently discarding every other real
            // persisted entry — exactly the bug this task exists to close. Instead:
            // keep postMerge[key] as the base and overlay only the specific sub-keys
            // that actually changed between snapshotAtExpiry[key] and preMerge[key] —
            // i.e. what the live write during the failsafe window actually added or
            // changed — preserving both the real persisted history and the write.
            // Scoped to one level of nesting and additive/changed sub-keys only (not
            // sub-key deletions) — the only shape this app's persisted stores actually
            // use for map-shaped fields, and the exact shape of the reported bug.
            const snapVal = snapshotAtExpiry[key];
            const preVal = preMerge[key];
            const postVal = postMerge[key];
            if (isPlainObject(snapVal) && isPlainObject(preVal) && isPlainObject(postVal)) {
              const subDiff: Record<string, unknown> = {};
              for (const subKey of Object.keys(preVal)) {
                if (!Object.is(preVal[subKey], snapVal[subKey])) {
                  subDiff[subKey] = preVal[subKey];
                }
              }
              if (Object.keys(subDiff).length > 0) {
                clobbered[key] = { ...postVal, ...subDiff } as T[typeof key];
              }
              continue;
            }

            clobbered[key] = preVal;
          }
          if (Object.keys(clobbered).length > 0) {
            console.error(
              `[plyglt] [ERR-HYDRATION-LATE-MERGE] real hydration finished after the failsafe already gave up — restoring ${Object.keys(clobbered).join(", ")}, which the persisted merge would have silently overwritten`
            );
            setState(clobbered);
          }
        });
      }
    }, HYDRATION_FAILSAFE_MS);

    return () => {
      clearTimeout(failsafe);
      unsubscribeState?.();
      unsubscribeLate?.();
    };
  }, [store, hydrated]);

  return hydrated || failsafeExpired;
}
