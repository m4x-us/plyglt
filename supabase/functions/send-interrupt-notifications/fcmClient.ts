// ============================================================
// fcmClient.ts — sends a notification via FCM's HTTP v1 API (Task #170)
// ============================================================
// FCM's legacy server-key API is deprecated — HTTP v1 is the only API Google
// still supports, and it requires exchanging a service-account JWT for a
// short-lived OAuth2 bearer token before every send (no static server key).
// ============================================================
// DEPENDS ON: ./jwt.ts, ./types.ts
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

import { signRs256Jwt } from "./jwt.ts";
import type { NotificationPayload, PushSendResult } from "./types.ts";

export interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  privateKeyPem: string;
}

const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function fcmSendUrl(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
}

/**
 * FCM_SERVICE_ACCOUNT_JSON is a single JSON-blob env var (the full
 * downloaded service-account key file). Returns null (never throws) when
 * the var is absent, unparseable, or missing a required field — same
 * graceful-degradation contract as readApnsCredentialsFromEnv.
 */
export function readFcmCredentialsFromEnv(env: Record<string, string | undefined>): FcmCredentials | null {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKeyPem: parsed.private_key };
  } catch (e) {
    console.error(`[ERR-PUSH-FCM-CREDS-${Date.now()}] failed to parse FCM_SERVICE_ACCOUNT_JSON:`, e);
    return null;
  }
}

/**
 * Audit finding (2026-08-08): this function previously had no try/catch at
 * all — a malformed/rotated private key (signRs256Jwt throwing), a network
 * failure on the OAuth2 endpoint, or a non-JSON token-exchange response
 * would all throw uncaught out of sendFcmNotification, contradicting its
 * documented "resolves to PushSendResult, never throws" contract (the same
 * contract sendApnsNotification's equivalent JWT-signing step already
 * honors). Wrapped end-to-end so every failure mode here resolves to
 * {ok:false, error}, matching apnsClient.ts's pattern exactly.
 */
async function getAccessToken(
  creds: FcmCredentials,
  fetchImpl: typeof fetch
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const assertion = await signRs256Jwt(
      { iss: creds.clientEmail, scope: FCM_SCOPE, aud: FCM_TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 },
      creds.privateKeyPem
    );

    const response = await fetchImpl(FCM_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(assertion)}`,
    });

    if (!response.ok) return { ok: false, error: `token exchange failed: HTTP ${response.status}` };

    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) return { ok: false, error: "token exchange response missing access_token" };
    return { ok: true, token: body.access_token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * With creds === null, returns {ok:false, skipped:true} WITHOUT calling
 * fetch or attempting the OAuth2 exchange — the no-op path never touches
 * the network.
 */
export async function sendFcmNotification(
  registrationToken: string,
  payload: NotificationPayload,
  creds: FcmCredentials | null,
  opts?: { fetchImpl?: typeof fetch }
): Promise<PushSendResult> {
  if (!creds) return { ok: false, skipped: true, error: "FCM not configured" };
  const fetchImpl = opts?.fetchImpl ?? fetch;

  const tokenResult = await getAccessToken(creds, fetchImpl);
  if (!tokenResult.ok) {
    console.error(`[ERR-PUSH-FCM-AUTH-${Date.now()}] FCM token exchange failed:`, tokenResult.error);
    return { ok: false, error: tokenResult.error };
  }

  try {
    const response = await fetchImpl(fcmSendUrl(creds.projectId), {
      method: "POST",
      headers: { authorization: `Bearer ${tokenResult.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: registrationToken,
          notification: { title: payload.title, body: payload.body },
          data: { cardCount: String(payload.data.cardCount), sessionType: payload.data.sessionType },
        },
      }),
    });

    if (response.ok) return { ok: true };

    let message = `HTTP ${response.status}`;
    let status: string | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string; status?: string } };
      if (body.error?.message) message = body.error.message;
      status = body.error?.status;
    } catch {
      // Non-JSON error body — keep the HTTP status as the message.
    }
    // Google's documented signal that a registration token is gone for good
    // (https://firebase.google.com/docs/cloud-messaging/manage-tokens).
    const permanentFailure = status === "UNREGISTERED" || status === "NOT_FOUND" || response.status === 404;
    return { ok: false, error: message, permanentFailure };
  } catch (e) {
    console.error(`[ERR-PUSH-FCM-SEND-${Date.now()}] sendFcmNotification failed:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
