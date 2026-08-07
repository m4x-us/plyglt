// ============================================================
// authStore.ts — Zustand store: current Supabase auth session (Task #515)
// ============================================================
/**
 * Tracks whether a user is signed in for sync, and who. Not itself persisted —
 * Supabase's own client (lib/supabaseClient.ts) already persists the session via
 * the platform storage abstraction (Task #514); this store is a live reflection
 * of whatever that client reports via onAuthStateChange, kept in sync automatically
 * rather than duplicating a second, potentially-inconsistent copy of the session.
 *
 * signInWithApple()/signInWithGoogle() only report whether the OAuth redirect was
 * successfully KICKED OFF, not whether sign-in ultimately succeeded — that happens
 * asynchronously once the user completes the flow in their browser and Supabase
 * fires onAuthStateChange. Callers that need to react to the actual signed-in
 * moment must read `status`/`userId` from the store, not this call's return value.
 *
 * IMPORTANT (found via Task #516's live human-interactive test, 2026-08-07): this
 * module must be loaded on whatever page the OAuth provider redirects back to, or
 * Supabase's detectSessionInUrl (default: on) never runs there and the returning
 * callback URL — including a real, already-created Supabase user — is silently
 * never processed into a local session. This app statically exports each route as
 * its own JS bundle (next.config.ts's output:"export"), so importing this module
 * only from components/SyncSignIn.tsx (settings-only) was NOT enough. Fixed two
 * ways: components/AuthSessionListener.tsx force-loads this module on every route
 * via app/layout.tsx, AND signInWithProvider() below sets an explicit redirectTo
 * back to /settings/ so the user also visibly lands where the result is shown.
 * Losing either fix reintroduces the bug even though the other still "works."
 *
 * Desktop scope note (Task #515, 2026-08-06): today this uses Supabase's default
 * same-window OAuth redirect, which only completes correctly in a web context —
 * verified there. On the real Tauri desktop build, this currently redirects the
 * app's own webview to the provider's consent page rather than the system browser,
 * and has no way back into the app afterward. Task #519 will switch these calls to
 * `skipBrowserRedirect: true` + a custom-scheme `redirectTo`, opened via
 * `lib/tauri.ts`'s `openExternalUrl`, once the Tauri deep-link callback handler
 * that requires exists.
 */
// ============================================================
// DEPENDS ON: @/lib/supabaseClient
// USED BY: not yet wired to any UI — Task #516 (sign-in screen) is the first caller
// ============================================================

import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { Provider } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  signInWithApple: () => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<{ ok: boolean; error?: string }>;
}

async function signInWithProvider(provider: Provider): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  // redirectTo must point back to /settings/ explicitly (trailing slash matches
  // next.config.ts's trailingSlash:true static export) rather than Supabase's
  // default (the site origin) — the sign-in UI, and the only route that keeps
  // this store's module loaded so the returning callback URL gets processed
  // at all, both live at /settings (see components/AuthSessionListener.tsx).
  const options = typeof window !== "undefined" ? { redirectTo: `${window.location.origin}/settings/` } : {};
  const { error } = await client.auth.signInWithOAuth({ provider, options });
  if (error) {
    console.error(`[ERR-AUTH-SIGNIN-${provider}-${Date.now()}] signInWithOAuth failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export const useAuthStore = create<AuthState>()(() => ({
  status: "loading",
  userId: null,
  email: null,

  signInWithApple: () => signInWithProvider("apple"),
  signInWithGoogle: () => signInWithProvider("google"),

  signOut: async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Sync is not configured." };

    const { error } = await client.auth.signOut();
    if (error) {
      console.error(`[ERR-AUTH-SIGNOUT-${Date.now()}] signOut failed:`, error);
      return { ok: false, error: error.message };
    }
    // No need to set() here — signOut() firing a SIGNED_OUT event through
    // onAuthStateChange below is what actually updates status/userId/email;
    // this keeps exactly one place in the module responsible for that transition.
    return { ok: true };
  },
}));

/** @internal Exported for unit testing; not part of the module's public API. */
export function _applyAuthStateChange(session: { user: { id: string; email?: string } } | null): void {
  useAuthStore.setState(
    session
      ? { status: "signed-in", userId: session.user.id, email: session.user.email ?? null }
      : { status: "signed-out", userId: null, email: null }
  );
}

// Wire the store to real session changes, once, at module load — mirrors
// store/entitlementStore.ts's cross-tab listener wiring pattern (module-level
// side effect, not re-run per component mount). If Supabase isn't configured
// (missing env vars), resolve to signed-out immediately rather than leaving
// the UI stuck on "loading" forever with nothing that will ever update it.
const _client = getSupabaseClient();
if (_client) {
  _client.auth.onAuthStateChange((_event, session) => _applyAuthStateChange(session));
} else {
  useAuthStore.setState({ status: "signed-out" });
}
