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
// Round-17 audit fix: also called directly by store/authStore.ts's signOut(), which has no
// access to the hook's per-instance nonce ref and uses the notUpdatedSince guard instead.
// ============================================================
// DEPENDS ON: lib/supabaseClient.ts (getSupabaseClient)
// USED BY: hooks/usePushRegistration.ts, store/authStore.ts
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
    // Round-18 audit fix, second finding: bumped on every registration so unregisterPushToken's
    // notUpdatedSince guard (below) has a reliable signal — the column's own DB default only
    // applies at INSERT time, never on an UPDATE/upsert, so without this explicit write here
    // updated_at would silently stop advancing after a row's first creation.
    updated_at: new Date().toISOString(),
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
 * instead of deleting a still-valid, newer registration.
 *
 * `notUpdatedSince` (round-18 audit fix, second finding — 8-way convergence:
 * Security Agent S, Agent V, Agent K, Agent N, Agent A, Agent W, Red Agent R,
 * Agent B): the ORIGINAL cold-start-fallback case (no ref this session, so no
 * expectedNonce is known — cleaning up a stale row from a PRIOR app launch)
 * still shipped as a fully unconditional delete, and every one of those 8
 * agents independently confirmed it can still race and silently wipe a FRESH,
 * same-session registration — e.g. a Pro user's first mount with
 * interruptEnabled=false fires this fallback, then the user toggles interrupts
 * on moments later; if the fallback's in-flight delete resolves after the new
 * registration's upsert, it wiped the fresh row with nothing to stop it. A
 * nonce can't protect this case (there is no "expected current nonce" for a
 * row this JS heap has never registered) — `notUpdatedSince` (an ISO
 * timestamp the caller captures synchronously, BEFORE firing this delete)
 * closes it instead: the DELETE only matches rows whose `updated_at` is
 * strictly before that moment. A registration that lands AFTER the caller
 * decided to fire this cleanup bumps `updated_at` (see toRow() above) to a
 * later timestamp, making the delete's condition fail — a correct no-op —
 * while a genuinely stale row (never touched since before the caller
 * captured its timestamp) still matches and gets cleaned up as intended.
 *
 * Round-19 audit correction (4-way convergence: Security Agent S, Agent K,
 * Agent A, Agent W): this comparison is intentionally strict (`lt`, not
 * `lte`) — an earlier draft used `lte`, which let an exact-millisecond tie
 * between the two captures favor deletion. Since `Date.toISOString()` has
 * only millisecond resolution and this guard's entire purpose is protecting
 * anything written at-or-after the cleanup decision, a tie must favor
 * PRESERVING the row, not deleting it. Confirmed unreachable via any trigger
 * the code currently ships (every real path from a cleanup decision to a
 * competing registration crosses several real async hops — a permission
 * check, at least one Tauri IPC round-trip, a network upsert — well over 1ms
 * in practice), but `lt` closes the theoretical gap outright rather than
 * resting on that latency argument. Both timestamps are captured on the SAME
 * client device across this whole causal chain, so there is no cross-device
 * clock-skew concern — same-device clock non-monotonicity (an NTP resync, a
 * sleep/wake correction) remains a real, if narrow and unmitigated, residual
 * risk; see .autocode/debt.md.
 */
export async function unregisterPushToken(
  userId: string,
  deviceId: string,
  expectedNonce?: string,
  notUpdatedSince?: string
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
  if (notUpdatedSince !== undefined) {
    query = query.lt("updated_at", notUpdatedSince);
  }
  const { error } = await query;
  if (error) {
    console.error(`[ERR-PUSHTOKEN-UNREGISTER-${Date.now()}] unregisterPushToken failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
