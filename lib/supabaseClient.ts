// ============================================================
// supabaseClient.ts — single gateway to Supabase (auth + database), Task #514
// ============================================================
/**
 * lib/supabaseClient.ts — the only file allowed to import @supabase/supabase-js.
 * Mirrors lib/tauri.ts's gateway pattern (CLAUDE.md §2): everything else in
 * the app calls exports from here, never the SDK directly.
 *
 * Degrades gracefully: getSupabaseClient() returns null (never throws) when
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — e.g.
 * local dev without .env.local, CI, or a test environment. Callers must
 * handle the null case explicitly; this module never silently no-ops a real
 * sync operation the way a thrown-and-caught error might.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createPlatformStorage } from "@/lib/storage";

// undefined = not yet resolved this process; null = resolved, but not configured.
// Distinguishing the two (rather than just `SupabaseClient | null`) is what lets
// resetSupabaseClientForTesting() force a fresh env-var read instead of forever
// returning whatever the first test in a run happened to see.
let cachedClient: SupabaseClient | null | undefined;

/**
 * Returns the singleton Supabase client, or null if the app isn't configured
 * for sync. Never throws — missing configuration is an expected, first-class
 * state (e.g. a fresh checkout with no .env.local yet), not an error.
 *
 * Session persistence is routed through lib/storage.ts's createPlatformStorage
 * — the same abstraction every other persisted store in this app uses — not
 * Supabase's own default (browser localStorage). CLAUDE.md §3 requires this:
 * without it, a signed-in session on desktop would live only in the Tauri
 * webview's localStorage, not the Tauri Store file, and would be silently
 * lost on any browser-cache clear rather than surviving like every other
 * piece of persisted state in this app.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      storage: createPlatformStorage("supabase-auth"),
      // @supabase/auth-js defaults flowType to "implicit" (access_token in a URL
      // fragment) unless told otherwise. store/authStore.ts's desktop deep-link
      // path (handleDeepLinkCallback) only ever parses a PKCE `?code=` query
      // param and calls exchangeCodeForSession — an implicit-flow callback has
      // no `code` param at all, so it silently no-ops. Found via Task #518's
      // live human-interactive test (2026-08-07): a real desktop sign-in
      // returned to the app but never updated auth state. PKCE is also the
      // correct choice independent of this bug — it's the OAuth flow designed
      // for public clients (desktop/mobile apps that can't hold a secret).
      flowType: "pkce",
    },
  });
  return cachedClient;
}

/** Test-only: clears the cached singleton so a test can re-initialize against
 *  different (or absent) env vars without a stale client leaking between cases. */
export function resetSupabaseClientForTesting(): void {
  cachedClient = undefined;
}
