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
 * Desktop (Task #519, 2026-08-07): the Tauri build uses a different flow than web.
 * `skipBrowserRedirect: true` + a custom `plyglt://` scheme `redirectTo` — there is
 * no "current window location" worth navigating inside the app's own webview, so
 * Supabase instead returns the authorize URL, which is opened explicitly via
 * `lib/tauri.ts`'s `openExternalUrl` (the real system browser, not the webview).
 * Completion happens asynchronously: the OS hands the `plyglt://...?code=...`
 * callback back to the running app (registered in `src-tauri/tauri.conf.json`'s
 * `plugins.deep-link.desktop.schemes`), caught by `handleDeepLinkCallback` below,
 * which exchanges the PKCE code for a session via `exchangeCodeForSession` — the
 * desktop equivalent of the web flow's automatic `detectSessionInUrl`. The exact
 * `plyglt://**` pattern must also be added to the Supabase project's own
 * Authentication → URL Configuration → Redirect URLs allowlist, a manual
 * infrastructure step this code cannot verify or perform.
 */
// ============================================================
// DEPENDS ON: @/lib/supabaseClient, @/lib/tauri
// USED BY: components/SyncSignIn.tsx (Task #516)
// ============================================================

import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isTauri, openExternalUrl, onDeepLinkUrl, getCurrentDeepLinkUrls } from "@/lib/tauri";
import { unregisterPushToken } from "@/lib/pushTokenClient";
import { useSyncStore } from "@/store/syncStore";
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

// Registered in src-tauri/tauri.conf.json's plugins.deep-link.desktop.schemes.
const DEEP_LINK_REDIRECT_URL = "plyglt://auth-callback";

async function signInWithProvider(provider: Provider): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  if (isTauri) {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { skipBrowserRedirect: true, redirectTo: DEEP_LINK_REDIRECT_URL },
    });
    if (error) {
      console.error(`[ERR-AUTH-SIGNIN-${provider}-${Date.now()}] signInWithOAuth failed:`, error);
      return { ok: false, error: error.message };
    }
    if (!data.url) {
      console.error(`[ERR-AUTH-SIGNIN-${provider}-${Date.now()}] signInWithOAuth returned no authorize URL`);
      return { ok: false, error: "No authorize URL returned." };
    }
    await openExternalUrl(data.url);
    return { ok: true };
  }

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

/**
 * @internal Exported for unit testing. Extracts the PKCE `code` param from a
 * received `plyglt://...` deep-link callback URL and completes the session.
 * Ignores anything not carrying this app's own scheme or a `code` param — a
 * malformed/foreign URL is silently skipped, not an error. A code being
 * exchanged twice (e.g. an unlikely overlap between the cold-start
 * getCurrentDeepLinkUrls() check and onOpenUrl's own listener firing for the
 * same initial URL) fails harmlessly on the second attempt — PKCE codes are
 * single-use and GoTrue rejects a reused one with a normal, logged error, not
 * a crash or corrupted state.
 */
export async function handleDeepLinkCallback(url: string): Promise<void> {
  if (!url.startsWith("plyglt://")) return;
  const client = getSupabaseClient();
  if (!client) return;

  let code: string | null;
  try {
    code = new URL(url).searchParams.get("code");
  } catch (e) {
    console.error(`[ERR-AUTH-DEEPLINK-PARSE-${Date.now()}] Malformed deep-link URL:`, e);
    return;
  }
  if (!code) return;

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`[ERR-AUTH-DEEPLINK-EXCHANGE-${Date.now()}] exchangeCodeForSession failed:`, error);
  }
  // No manual setState here — a successful exchange fires SIGNED_IN through
  // onAuthStateChange below, the same single source of truth every other
  // sign-in path already relies on.
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

    // Round-17 audit finding (Security Agent S): unregistering the device's push
    // token used to happen ONLY reactively, from hooks/usePushRegistration.ts's
    // gate-failure branch once userId transitions to null — but that transition
    // fires from the SIGNED_OUT event below, and Supabase's real GoTrueClient
    // (_removeSession()) clears local session storage BEFORE notifying
    // subscribers of SIGNED_OUT. So by the time that reactive unregister call
    // reached Supabase, it carried no valid session; push_tokens' RLS delete
    // policy (auth.uid() = user_id) silently matched zero rows under the
    // fallback anon key, and unregisterPushToken has no way to distinguish that
    // from "nothing was registered" — it returned {ok:true} having deleted
    // nothing. Every ordinary sign-out of a Pro user with push registered left
    // their token alive indefinitely. Fixed by unregistering HERE, first, while
    // the session (and thus the DELETE's RLS authorization) is still valid — a
    // harmless no-op if nothing was ever registered on this device.
    const { userId } = useAuthStore.getState();
    const deviceId = useSyncStore.getState().deviceId;
    if (userId && deviceId) {
      // Round-18 audit fix (3-way convergence: Agent W, Agent N, Agent A): this call had
      // no protection against racing a concurrent registration — e.g. a fast Sign-Out then
      // Sign-In (or an in-flight registration from before sign-out that resolves after this
      // delete already ran) could leave this unconditional DELETE wiping a freshly, validly
      // re-registered row. This store has no access to hooks/usePushRegistration.ts's
      // per-instance nonce ref (a different module, no shared state), so it uses the same
      // fallback guard that hook's own gate-failure branch uses when no nonce is known:
      // capture "now" synchronously, before firing, and let unregisterPushToken condition
      // the delete on updated_at not having advanced since — see that function's doc
      // comment in lib/pushTokenClient.ts for the full reasoning.
      const notUpdatedSince = new Date().toISOString();
      const result = await unregisterPushToken(userId, deviceId, undefined, notUpdatedSince);
      if (!result.ok) {
        console.error(`[ERR-AUTH-SIGNOUT-PUSH-${Date.now()}] pre-signout push token cleanup failed: ${result.error}`);
      }
    }

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

// Desktop-only (Task #519): catch the OAuth deep-link callback regardless of
// which of the two ways it can arrive — the app already running when the
// browser redirect happens (onDeepLinkUrl's event), or the OS launching this
// process fresh via the link (getCurrentDeepLinkUrls, checked once at
// startup, cold-start case). Both no-op in web (isTauri false).
if (isTauri) {
  void onDeepLinkUrl((urls) => {
    for (const url of urls) void handleDeepLinkCallback(url);
  });
  void getCurrentDeepLinkUrls().then((urls) => {
    if (urls) for (const url of urls) void handleDeepLinkCallback(url);
  });
}
