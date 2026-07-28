// ============================================================
// ENTITLEMENT CROSS-TAB SYNC — storage-event rehydration for multi-tab consistency
// ============================================================
// createCrossTabSync's rehydrate-dedup/queue logic, extracted from
// store/entitlementStore.ts under Rule 1 (Task #463) — this logic has no dependency on
// EntitlementState's fields; it only needs the persisted store's key and a rehydrate
// function, both passed in by the caller. Closure-scoped state (not module-scope `let`,
// mirroring lib/generationGuard.ts's createGenerationGuard() factory shape) — a second
// call gets its own independent dedup state, so this module is safe to reuse for a
// different store later without the two instances silently sharing flags.
// ============================================================
// DEPENDS ON: nothing (pure)
// USED BY: store/entitlementStore.ts ONLY. createCrossTabSync is exported solely so the
//          store can wire itself into the browser 'storage' event at module load;
//          calling it a second time for the SAME store key duplicates listeners.
// ============================================================

export interface CrossTabSyncHandle {
  handleStorageEvent: (e: { key: string | null }) => void;
}

// Task #491 (F007): `result instanceof Promise` misclassified any non-native thenable
// (e.g. a custom Promise-like object, or a Promise from another realm/polyfill whose
// prototype chain doesn't share this module's global Promise constructor) as synchronous
// — it would call done() immediately and reset rehydrateInFlight while real async work was
// still pending, silently breaking the dedup/queue guarantee this module exists to provide.
// This module's `rehydrate` parameter is typed `() => unknown` and its doc comment above
// states the module is "not tied to Zustand specifically," intended for reuse with a
// non-Zustand or differently-configured rehydrate function — an instanceof check contradicts
// that stated generality. Structural (duck-typed) detection matches the actual async
// contract this module depends on: anything with a callable .then is awaited the same way.
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Wires a Zustand persist store's rehydrate() to react to the browser 'storage' event so
 * a second open tab picks up writes made by another tab.
 *
 * Cross-tab sync: Zustand persist writes the in-memory state snapshot to localStorage at
 * call time — it does not merge against the on-disk value first. If one tab writes
 * entitlement state (license activation, validation, deactivation) and a second tab is
 * open, the second tab's in-memory state is stale until it is rehydrated. Listening for
 * the native 'storage' event re-hydrates in-memory state whenever another tab writes, so
 * the next set() call in this tab reads the on-disk value rather than a stale snapshot.
 * This guard is browser-only; Tauri uses a file-backed store that is single-process and
 * not subject to this race. (Task #288)
 *
 * Scope note (Task #303): the original comment described "two browser tabs racing on
 * purchaseAddOn" — that scenario cannot occur today because purchaseAddOn is an
 * intentionally unreachable stub (#295). The guard is retained because it remains
 * correct and useful for all other entitlement writes (setEntitlement, markValidated,
 * clearEntitlement). The comment above reflects the actual current use case.
 *
 * Race limitation (Task #304): rehydrateInFlight deduplicates rapid storage events so
 * concurrent rehydrate() calls do not race each other. However, a set() call that
 * completes between the storage event and rehydrate completion may still be overwritten
 * — Zustand has no cross-operation lock for that scenario. The window is small in
 * practice (entitlement writes are rare) and acceptable given the client-only,
 * honour-system entitlement model (decision 2026-06-24).
 *
 * Task #482 (F009), scope narrowed by Task #488 (F004): the async-reject branch inside
 * triggerRehydrate (result.then(done, errorHandler)) is DEFENSIVE-ONLY under this app's
 * actual production configuration, not a live diagnostic path — verified directly against
 * zustand@5.0.14's source (node_modules/zustand/esm/middleware.mjs's hydrate()): its
 * promise chain always terminates in a `.catch((e) => { ...; postRehydrationCallback?.(void
 * 0, e); })` that never rethrows. Since no store in this app (entitlementStore.ts,
 * srsStore.ts, settingsStore.ts) registers an onRehydrateStorage callback,
 * postRehydrationCallback is always undefined and that optional call is always a no-op —
 * persist.rehydrate() can therefore never actually return a rejected Promise today. This is
 * confirmed with a live regression test against the real zustand dependency (not a mock) in
 * tests/entitlementCrossTabSync.test.ts for BOTH real failure sources that funnel into that
 * same swallowed .catch: storage.getItem() throwing (Task #482's test), and — the gap Task
 * #482 left untested — the store's own migrate() function throwing (Task #488's test). The
 * migrate case is not hypothetical: store/migrations.ts's migrate*Store functions
 * (registered by all three real stores, per CLAUDE.md §4) throw by design on a missing
 * migration step, and Task #488 proved that throw is swallowed by the exact same
 * unreachable-rethrow path as the getItem case.
 *
 * Accepted trade-off (Task #488): unlike the initial-mount hydration path, which has an
 * explicit failsafe (lib/storage.ts's useIsHydrated, HYDRATION_FAILSAFE_MS timeout, Tasks
 * #406/#435), this direct 'storage'-event path has no equivalent timeout or surfaced log —
 * a cross-tab rehydrate that silently fails via a migrate() throw (e.g. triggered by
 * stale/corrupted data written by another tab) leaves this tab's in-memory state stale with
 * no signal anywhere in the app. Fixing this at the root (making migrate*Store itself
 * catch-and-log before rethrowing, in store/migrations.ts) is out of this module's scope —
 * tracked as debt in .autocode/debt.md (Task #488) rather than left as an undocumented gap.
 * Given the client-only, honour-system entitlement model (decision 2026-06-24) and that a
 * migrate() throw here requires either a corrupted stored version or a newer app version
 * writing from another tab, both rare, this is accepted with the same rigor as the
 * getItem-throw case above, not silently assumed away.
 *
 * The branch is kept anyway, not as dead code: this function is a generic, reusable
 * primitive (its `rehydrate` parameter is typed `() => unknown`, not tied to Zustand
 * specifically — see the module header above), so it must stay correct for (1) a future
 * onRehydrateStorage callback that itself throws inside zustand's own final .catch handler —
 * which WOULD produce a genuine rejection, since nothing catches a throw from inside that
 * handler, (2) reuse of this module with a non-Zustand or differently-configured rehydrate
 * function, and (3) a future zustand version changing hydrate()'s internal error handling.
 * tests/entitlementCrossTabSync.test.ts's async-reject tests exercise this module's OWN
 * contract (correct behavior given any Promise-returning rehydrate function) via a synthetic
 * controllable Promise — that is the right scope for a unit test of a generic utility, not a
 * claim that this exact rejection happens in production today.
 *
 * @param storeKey the persist store's storage key — only 'storage' events for this key trigger a rehydrate
 * @param rehydrate called fresh on every triggered rehydrate (not captured once), so a
 *   test double or a future re-assignment of the store's own rehydrate method is honored
 */
export function createCrossTabSync(storeKey: string, rehydrate: () => unknown): CrossTabSyncHandle {
  // Task #304: deduplicates concurrent rehydrate() calls so rapid storage events do not
  // trigger overlapping rehydrations. Once a rehydrate is in flight, further storage
  // events for the same key are queued (Task #347) rather than dropped.
  let rehydrateInFlight = false;
  // Task #347: tracks whether a storage event arrived while a rehydrate was in-flight.
  // When rehydrate completes, if this flag is set, a new rehydrate is triggered immediately
  // so the dropped event is not lost — prevents stale state after rapid cross-tab writes.
  let pendingRehydrate = false;

  function triggerRehydrate(): void {
    rehydrateInFlight = true;
    pendingRehydrate = false;
    const done = () => {
      rehydrateInFlight = false;
      if (pendingRehydrate) {
        triggerRehydrate(); // Task #347: a storage event arrived while in-flight — re-run
      }
    };
    // Task #363: wrap in try/catch so a synchronous throw from rehydrate() resets
    // rehydrateInFlight rather than locking it true forever (which would permanently
    // disable cross-tab sync for this tab's lifetime).
    try {
      const result = rehydrate();
      if (isThenable(result)) {
        // Task #474: the rejection handler previously was `done` itself — resets the
        // in-flight flag and requeues, but never logs. AGENTS.md Rule 8 ("every catch
        // block must surface the error... swallowing errors is a stop-the-line
        // violation") applies here exactly as it does to the synchronous-throw branch
        // below: this rejection handler IS this async path's catch block. Logged with
        // the same ref-ID/message shape as the sync-throw sibling so both failure modes
        // of the same call are equally diagnosable.
        result.then(done, (err) => {
          console.error(`[ERR-REHYDRATE-ASYNC-REJECT-${Date.now()}] persist.rehydrate() returned a rejected promise — cross-tab sync disabled for this event`, err);
          done();
        });
      } else {
        done();
      }
    } catch (err) {
      console.error(`[ERR-REHYDRATE-SYNC-THROW-${Date.now()}] persist.rehydrate() threw synchronously — cross-tab sync disabled for this event`, err);
      done(); // always reset the flag, even on error
    }
  }

  function handleStorageEvent(e: { key: string | null }): void {
    if (e.key !== storeKey) return;
    if (rehydrateInFlight) {
      pendingRehydrate = true; // Task #347: don't drop — re-trigger after current rehydrate settles
      return;
    }
    triggerRehydrate();
  }

  return { handleStorageEvent };
}
