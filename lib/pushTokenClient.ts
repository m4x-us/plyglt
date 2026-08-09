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
// NO PRODUCTION CALLER EXISTS YET. This is greenfield library code written for
// the not-yet-built iOS/Android clients (Tasks #171/#172) — once the OS grants
// notification permission and hands the app a real APNs/FCM device token, that
// client calls registerPushToken() using useAuthStore().userId. Desktop (Tauri)
// deliberately does NOT call this: desktop already has a working local,
// client-side interrupt scheduler (BRAND.md's Proactive Interruption Model) and
// has no APNs/FCM-shaped credential to register.
// ============================================================
// DEPENDS ON: lib/supabaseClient.ts (getSupabaseClient)
// USED BY: (none yet — see note above; iOS/Android clients, Tasks #171/#172)
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
 */
export async function unregisterPushToken(userId: string, deviceId: string): Promise<PushTokenResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  const { error } = await client
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("device_id", deviceId);
  if (error) {
    console.error(`[ERR-PUSHTOKEN-UNREGISTER-${Date.now()}] unregisterPushToken failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
