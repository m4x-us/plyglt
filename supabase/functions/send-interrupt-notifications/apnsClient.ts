// ============================================================
// apnsClient.ts — sends a notification via Apple's APNs HTTP/2 API (Task #170)
// ============================================================
// DEPENDS ON: ./jwt.ts, ./types.ts
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

import { signEs256Jwt } from "./jwt.ts";
import type { NotificationPayload, PushSendResult } from "./types.ts";

export interface ApnsCredentials {
  teamId: string;
  keyId: string;
  bundleId: string;
  privateKeyPem: string;
}

const APNS_PRODUCTION_HOST = "https://api.push.apple.com";
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com";

/**
 * Returns null (never throws) when any of the four required env vars is
 * absent — "not configured" is a first-class expected state, matching
 * lib/supabaseClient.ts's getSupabaseClient() contract, not an error.
 */
export function readApnsCredentialsFromEnv(env: Record<string, string | undefined>): ApnsCredentials | null {
  const teamId = env.APNS_TEAM_ID;
  const keyId = env.APNS_KEY_ID;
  const bundleId = env.APNS_BUNDLE_ID;
  const privateKeyPem = env.APNS_PRIVATE_KEY_P8;
  if (!teamId || !keyId || !bundleId || !privateKeyPem) return null;
  return { teamId, keyId, bundleId, privateKeyPem };
}

/**
 * With creds === null, returns {ok:false, skipped:true} WITHOUT calling
 * fetch — the no-op path never touches the network, mirroring every other
 * external gateway's graceful-degradation contract in this codebase.
 */
export async function sendApnsNotification(
  deviceToken: string,
  payload: NotificationPayload,
  creds: ApnsCredentials | null,
  opts: { sandbox: boolean; fetchImpl?: typeof fetch }
): Promise<PushSendResult> {
  if (!creds) return { ok: false, skipped: true, error: "APNs not configured" };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const host = opts.sandbox ? APNS_SANDBOX_HOST : APNS_PRODUCTION_HOST;
  const nowSeconds = Math.floor(Date.now() / 1000);

  let jwt: string;
  try {
    jwt = await signEs256Jwt({ iss: creds.teamId, iat: nowSeconds }, creds.keyId, creds.privateKeyPem);
  } catch (e) {
    console.error(`[ERR-PUSH-APNS-SIGN-${Date.now()}] failed to sign APNs JWT:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const response = await fetchImpl(`${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": creds.bundleId,
        "apns-push-type": "alert",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
        ...payload.data,
      }),
    });

    if (response.ok) return { ok: true };

    let reason = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { reason?: string };
      if (body.reason) reason = body.reason;
    } catch {
      // Non-JSON error body — keep the HTTP status as the reason.
    }
    // Apple's documented signal that a token will never be valid again
    // (https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns).
    const permanentFailure = response.status === 410 || (response.status === 400 && reason === "BadDeviceToken");
    return { ok: false, error: reason, permanentFailure };
  } catch (e) {
    console.error(`[ERR-PUSH-APNS-SEND-${Date.now()}] sendApnsNotification failed:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
