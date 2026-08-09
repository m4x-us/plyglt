import { describe, it, expect, vi, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { readFcmCredentialsFromEnv, sendFcmNotification, type FcmCredentials } from "../supabase/functions/send-interrupt-notifications/fcmClient.ts";
import type { NotificationPayload } from "../supabase/functions/send-interrupt-notifications/types.ts";

const PAYLOAD: NotificationPayload = {
  title: "plyglt",
  body: "3 cards ready",
  data: { cardCount: 3, sessionType: "review" },
};

let rsaPrivateKeyPem: string;

beforeAll(() => {
  rsaPrivateKeyPem = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey;
});

function serviceAccountJson(overrides: Record<string, unknown> = {}, privateKey?: string): string {
  return JSON.stringify({
    project_id: "plyglt-prod",
    client_email: "push@plyglt-prod.iam.gserviceaccount.com",
    private_key: privateKey ?? "placeholder-not-used-in-parsing-tests",
    ...overrides,
  });
}

function mockFetchSequence(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  return fn;
}

describe("readFcmCredentialsFromEnv", () => {
  it("returns null when FCM_SERVICE_ACCOUNT_JSON is absent", () => {
    expect(readFcmCredentialsFromEnv({})).toBeNull();
  });

  it("returns null when FCM_SERVICE_ACCOUNT_JSON is unparseable JSON", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readFcmCredentialsFromEnv({ FCM_SERVICE_ACCOUNT_JSON: "{not valid json" })).toBeNull();
    consoleErrorSpy.mockRestore();
  });

  it("returns null when a required field (client_email) is missing from otherwise-valid JSON", () => {
    const raw = JSON.stringify({ project_id: "p", private_key: "k" });
    expect(readFcmCredentialsFromEnv({ FCM_SERVICE_ACCOUNT_JSON: raw })).toBeNull();
  });

  it("returns the parsed credentials when the env var contains valid service-account JSON", () => {
    const raw = serviceAccountJson({}, "the-private-key");
    expect(readFcmCredentialsFromEnv({ FCM_SERVICE_ACCOUNT_JSON: raw })).toEqual({
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: "the-private-key",
    });
  });
});

describe("sendFcmNotification", () => {
  it("returns {ok:false, skipped:true, error:'FCM not configured'} when creds is null, without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await sendFcmNotification("registration-token", PAYLOAD, null, { fetchImpl });
    expect(result).toEqual({ ok: false, skipped: true, error: "FCM not configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls the OAuth2 token endpoint exactly once before posting to messages:send", async () => {
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = mockFetchSequence(
      new Response(JSON.stringify({ access_token: "access-token-abc" }), { status: 200 }),
      new Response(null, { status: 200 })
    );

    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://oauth2.googleapis.com/token");
    expect(fetchImpl.mock.calls[1]![0]).toBe("https://fcm.googleapis.com/v1/projects/plyglt-prod/messages:send");
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:true when the mocked send fetch responds with status 200", async () => {
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = mockFetchSequence(
      new Response(JSON.stringify({ access_token: "access-token-abc" }), { status: 200 }),
      new Response(null, { status: 200 })
    );
    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false, permanentFailure:true with the FCM error message when the send responds 404 UNREGISTERED", async () => {
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = mockFetchSequence(
      new Response(JSON.stringify({ access_token: "access-token-abc" }), { status: 200 }),
      new Response(
        JSON.stringify({ error: { message: "Requested entity was not found.", status: "UNREGISTERED" } }),
        { status: 404 }
      )
    );
    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "Requested entity was not found.", permanentFailure: true });
  });

  it("returns permanentFailure:true for an UNREGISTERED status even on a non-404 HTTP code (isolates the status-string check from the 404 fallback)", async () => {
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = mockFetchSequence(
      new Response(JSON.stringify({ access_token: "access-token-abc" }), { status: 200 }),
      new Response(JSON.stringify({ error: { message: "Unregistered.", status: "UNREGISTERED" } }), { status: 400 })
    );
    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "Unregistered.", permanentFailure: true });
  });

  it("returns permanentFailure:false for a non-404, non-UNREGISTERED/NOT_FOUND failure", async () => {
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = mockFetchSequence(
      new Response(JSON.stringify({ access_token: "access-token-abc" }), { status: 200 }),
      new Response(JSON.stringify({ error: { message: "Internal error.", status: "INTERNAL" } }), { status: 500 })
    );
    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "Internal error.", permanentFailure: false });
  });

  it("logs [ERR-PUSH-FCM-SEND-...] and returns ok:false when the send fetch rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token-abc" }), { status: 200 }));
    fetchImpl.mockRejectedValueOnce(new Error("connection reset"));

    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });

    expect(result).toEqual({ ok: false, error: "connection reset" });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FCM-SEND-\d+\] sendFcmNotification failed:$/);
    consoleErrorSpy.mockRestore();
  });

  it("logs [ERR-PUSH-FCM-AUTH-...] and returns ok:false without attempting the send call when the token exchange fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = mockFetchSequence(new Response(null, { status: 401 }));

    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "token exchange failed: HTTP 401" });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FCM-AUTH-\d+\] FCM token exchange failed:$/);
    consoleErrorSpy.mockRestore();
  });

  it("logs [ERR-PUSH-FCM-AUTH-...] and returns ok:false (not a throw) when the token-exchange fetch itself rejects", async () => {
    // Audit finding (2026-08-08): getAccessToken previously had no try/catch
    // at all — a rejected FIRST fetch call (the OAuth2 token exchange, as
    // opposed to the second, send, fetch already covered above) propagated
    // uncaught out of sendFcmNotification, breaking its documented
    // never-throws contract and able to abort dispatch.ts's entire loop.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const creds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: rsaPrivateKeyPem,
    };
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockRejectedValueOnce(new Error("DNS resolution failed"));

    const result = await sendFcmNotification("registration-token", PAYLOAD, creds, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "DNS resolution failed" });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FCM-AUTH-\d+\] FCM token exchange failed:$/);
    consoleErrorSpy.mockRestore();
  });

  it("logs [ERR-PUSH-FCM-AUTH-...] and returns ok:false (not a throw) when JWT signing itself throws (malformed private key)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const badCreds: FcmCredentials = {
      projectId: "plyglt-prod",
      clientEmail: "push@plyglt-prod.iam.gserviceaccount.com",
      privateKeyPem: "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----",
    };
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await sendFcmNotification("registration-token", PAYLOAD, badCreds, { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy(); // existence-check: exact Web Crypto error text is engine-dependent, not stable across Node versions
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FCM-AUTH-\d+\] FCM token exchange failed:$/);
    consoleErrorSpy.mockRestore();
  });
});
