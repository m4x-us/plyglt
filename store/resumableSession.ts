// ============================================================
// resumableSession.ts — getResumableSession/peekResumableSession/clearExpiredResumableSession
// ============================================================
// Extracted from store/srsStore.ts under Rule 1 (services ≤400 lines) during Task #613
// remediation. The resumable-session trio all read/write the same `activeSession` field
// and share no other cross-cutting dependency on the rest of srsStore.ts — both real
// call sites (hooks/useStudySession.ts, app/study/page.tsx) receive these actions as
// injected function parameters from useSRSStore()'s destructured actions, never via a
// direct import of srsStore.ts internals, so this extraction changes no caller.
// createResumableSessionActions takes narrow (get, set) parameter types rather than
// importing SRSState from srsStore.ts, so this module has no runtime or type dependency
// on its only caller — same pattern as store/entitlementAddOns.ts's createPurchaseAddOn
// (Task #412).
// ============================================================
// DEPENDS ON: nothing app-specific — the session shape is a generic type parameter, not
//             an import of srsStore.ts's ActiveSession, to avoid a circular import back
//             to the file this was extracted from.
// USED BY: store/srsStore.ts ONLY. Exported solely so the store can wire the three
//          actions into its action map — calling these from anywhere else bypasses the
//          store's own state and is a stop-the-line violation.
// ============================================================

// Sessions expire after 24 hours — a crash-recovery window, not a real resume feature;
// an abandoned session older than this is treated as gone, not resumable.
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Narrow store surface the resumable-session trio needs. Kept minimal (not the full
 * SRSState) so this module has no type dependency on store/srsStore.ts. */
interface ResumableSessionGet<TSession> {
  activeSession: TSession | null;
}
interface ResumableSessionSetArg<TSession> {
  activeSession: TSession | null;
}

/**
 * Builds the three resumable-session store actions. Called once from
 * store/srsStore.ts's Zustand creator, closing over that store's real `set`/`get` — the
 * real SRSState structurally satisfies the narrow interfaces above, so this composes
 * without either module importing the other's types.
 */
export function createResumableSessionActions<TSession extends { startedAt: number }>(
  get: () => ResumableSessionGet<TSession>,
  set: (partial: Partial<ResumableSessionSetArg<TSession>>) => void
) {
  return {
    // Task #597: despite the getter-shaped name, this mutates state via set({activeSession:
    // null}) as a side effect whenever the saved session has expired — NOT safe to call
    // during React's render phase (useState lazy initializers, useMemo bodies), since
    // render can run twice under StrictMode/concurrent rendering or be discarded entirely,
    // either silently double-firing or dropping the mutation. hooks/useStudySession.ts
    // currently calls this from exactly those render-phase positions (a pre-existing
    // issue, not introduced by this extraction) — kept unchanged here for backward
    // compatibility with existing callers and tests/srsStore.test.ts's explicit
    // auto-purge assertions. New callers, and any future refactor of the render-phase
    // call sites, should use the render-safe pair below instead: `peekResumableSession()`
    // (pure, safe anywhere) to read the value, plus `clearExpiredResumableSession()` (an
    // explicit action, call from an effect — never during render) to actually purge an
    // expired session.
    getResumableSession: (): TSession | null => {
      const session = get().activeSession;
      if (!session) return null;
      if (Date.now() - session.startedAt > SESSION_EXPIRY_MS) {
        set({ activeSession: null });
        return null;
      }
      return session;
    },

    // Task #597 — pure alternative: identical resolution logic to getResumableSession
    // (null if no session, or if the saved session has expired) but NEVER mutates store
    // state. Safe to call during React's render phase.
    peekResumableSession: (): TSession | null => {
      const session = get().activeSession;
      if (!session) return null;
      if (Date.now() - session.startedAt > SESSION_EXPIRY_MS) return null;
      return session;
    },

    // Task #597 — the explicit, side-effecting half split out of getResumableSession:
    // purges activeSession if (and only if) it has expired. A no-op otherwise. Intended
    // to be called from a useEffect (post-render), not during render itself.
    clearExpiredResumableSession: (): void => {
      const session = get().activeSession;
      if (session && Date.now() - session.startedAt > SESSION_EXPIRY_MS) {
        set({ activeSession: null });
      }
    },
  };
}
