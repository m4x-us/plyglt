// ============================================================
// pushTokenClient.ts — register/unregister a device's push token against Supabase (Task #170)
// ============================================================
// Talks to the push_tokens table (supabase/migrations/20260808000000_push_tokens.sql)
// via lib/supabaseClient.ts's single gateway — this file never imports
// @supabase/supabase-js directly. Mirrors lib/syncClient.ts's contract exactly:
// getSupabaseClient() === null returns {ok:false, error:"Sync is not configured."}
// without throwing; a Supabase-level error is logged with a ref ID and surfaced
// in the return value, never swallowed.
//
// registerPushToken is called live in production by hooks/usePushRegistration.ts (Task #522,
// iOS live-verified end-to-end on a real device) once notification permission is granted and
// a Pro user's APNs device token is available. Desktop (Tauri) deliberately does NOT call
// this: desktop already has a working local, client-side interrupt scheduler (BRAND.md's
// Proactive Interruption Model) and has no APNs/FCM-shaped credential to register.
// unregisterPushToken is called by the same hook (round-14 audit fix) whenever the
// registration gate no longer holds — sign-out, a subscription lapse, or interrupts disabled.
// ============================================================
// DEPENDS ON: lib/supabaseClient.ts (getSupabaseClient)
// USED BY: hooks/usePushRegistration.ts
// ============================================================

import { getSupabaseClient } from "@/lib/supabaseClient";

export type PushTokenResult = { ok: true } | { ok: false; error: string };

export interface RegisterPushTokenParams {
  userId: string;
  platform: "ios" | "android";
  deviceId: string;
  token: string;
  appEnv: "production" | "sandbox";
  timezone: string;
  // Round-18 audit fix: a fresh, caller-generated identifier (crypto.randomUUID()),
  // independent of the OS-issued token's actual value — device tokens are stable per
  // install, not per launch, so a rapid Deactivate-then-Reactivate can legitimately
  // re-register the SAME token, which a token-value-based compare-and-swap couldn't
  // distinguish from a stale, superseded registration. See
  // supabase/migrations/20260818000000_push_tokens_registration_nonce.sql.
  registrationNonce: string;
  interruptIntervalMinutes?: number;
  wakingHoursStartLocal?: number;
  wakingHoursEndLocal?: number;
}

function toRow(params: RegisterPushTokenParams) {
  const row: Record<string, unknown> = {
    user_id: params.userId,
    platform: params.platform,
    device_id: params.deviceId,
    token: params.token,
    app_env: params.appEnv,
    timezone: params.timezone,
    registration_nonce: params.registrationNonce,
    // Round-15 audit finding (Red Agent R, DECAY lens): an upsert only SETs columns present
    // in the payload — omitting this left a row dispatch had marked deactivated_at (on a
    // permanent APNs/FCM delivery failure) excluded from all future dispatch FOREVER, even
    // after the device received a genuinely fresh, valid token (an OS token-rotation event,
    // or the ordinary "new phone via Transfer/Restore" flow, which keeps the same local
    // device_id but always yields a new OS-issued token). A live re-registration is
    // definitionally proof the device is reachable again.
    deactivated_at: null,
  };
  // Omit optional fields entirely rather than writing `undefined` — the DB
  // column defaults (90 / 8 / 21) apply only when the column is absent from
  // the upsert payload, not when it's explicitly set to undefined/null.
  if (params.interruptIntervalMinutes !== undefined) {
    row.interrupt_interval_minutes = params.interruptIntervalMinutes;
  }
  if (params.wakingHoursStartLocal !== undefined) {
    row.waking_hours_start_local = params.wakingHoursStartLocal;
  }
  if (params.wakingHoursEndLocal !== undefined) {
    row.waking_hours_end_local = params.wakingHoursEndLocal;
  }
  return row;
}

/**
 * Registers (or rotates the token for) a device. Upserts on the
 * (user_id, device_id) unique pair — the common real-world case is the same
 * device receiving a fresh OS-issued token, not a new device appearing, so
 * conflicting on that pair updates the existing row in place rather than
 * creating a duplicate the dispatch function would send two notifications to.
 */
export async function registerPushToken(params: RegisterPushTokenParams): Promise<PushTokenResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  const { error } = await client
    .from("push_tokens")
    .upsert(toRow(params), { onConflict: "user_id,device_id" });
  if (error) {
    console.error(`[ERR-PUSHTOKEN-REGISTER-${Date.now()}] registerPushToken failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Removes a device's push registration (sign-out, notification permission
 * revoked, app uninstall detected). Scoped to BOTH user_id and device_id —
 * a filter on user_id alone would delete every device the user has ever
 * registered, not just the one being unregistered.
 *
 * `expectedNonce` (round-18 audit fix, closing the cross-instance
 * Deactivate-then-Reactivate race logged in .autocode/debt.md, Batch 23
 * round 16/17): when supplied, the DELETE is additionally conditioned on
 * `registration_nonce` still matching — a compare-and-swap against whichever
 * registration attempt actually wrote the row most recently. A stale, fire-
 * and-forget DELETE issued by a just-unmounted component instance can then
 * resolve AFTER a newer instance's own registerPushToken() has overwritten
 * the row with a fresh nonce, and correctly becomes a no-op (0 rows matched)
 * instead of deleting a still-valid, newer registration. Omit `expectedNonce`
 * for the intentional cold-start fallback case (no ref this session, cleaning
 * up a stale row from a PRIOR app launch this JS heap never registered) —
 * there is no nonce to compare against there, so the delete stays
 * unconditional exactly as before this fix.
 */
export async function unregisterPushToken(
  userId: string,
  deviceId: string,
  expectedNonce?: string
): Promise<PushTokenResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  let query = client
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("device_id", deviceId);
  if (expectedNonce !== undefined) {
    query = query.eq("registration_nonce", expectedNonce);
  }
  const { error } = await query;
  if (error) {
    console.error(`[ERR-PUSHTOKEN-UNREGISTER-${Date.now()}] unregisterPushToken failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
