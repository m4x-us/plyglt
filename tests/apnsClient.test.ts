import { describe, it, expect, vi, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { readApnsCredentialsFromEnv, sendApnsNotification, type ApnsCredentials } from "../supabase/functions/send-interrupt-notifications/apnsClient.ts";
import type { NotificationPayload } from "../supabase/functions/send-interrupt-notifications/types.ts";

const PAYLOAD: NotificationPayload = {
  title: "plyglt",
  body: "3 cards ready",
  data: { cardCount: 3, sessionType: "review" },
};

// Used only by readApnsCredentialsFromEnv's pure-parsing tests below, which
// never sign anything — the key content itself is never validated there.
const FULL_ENV = {
  APNS_TEAM_ID: "TEAM123",
  APNS_KEY_ID: "KEY123",
  APNS_BUNDLE_ID: "com.plyglt.app",
  APNS_PRIVATE_KEY_P8: "-----BEGIN PRIVATE KEY-----\nfakekeydata\n-----END PRIVATE KEY-----",
};

const PARSED_ENV_CREDS: ApnsCredentials = {
  teamId: "TEAM123",
  keyId: "KEY123",
  bundleId: "com.plyglt.app",
  privateKeyPem: "-----BEGIN PRIVATE KEY-----\nfakekeydata\n-----END PRIVATE KEY-----",
};

// sendApnsNotification tests below DO sign a real JWT (jwt.ts's
// crypto.subtle.importKey), so these need a real, valid P-256 PKCS8 key —
// a placeholder string would fail at the signing step before fetch is ever
// called, making every send test below fail for the wrong reason.
let CREDS: ApnsCredentials;

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  CREDS = { teamId: "TEAM123", keyId: "KEY123", bundleId: "com.plyglt.app", privateKeyPem: privateKey };
});

describe("readApnsCredentialsFromEnv", () => {
  it("returns null when APNS_PRIVATE_KEY_P8 is absent", () => {
    const { APNS_PRIVATE_KEY_P8: _omitted, ...rest } = FULL_ENV;
    expect(readApnsCredentialsFromEnv(rest)).toBeNull();
  });

  it("returns null when APNS_TEAM_ID is absent", () => {
    const { APNS_TEAM_ID: _t, ...withoutTeam } = FULL_ENV;
    expect(readApnsCredentialsFromEnv(withoutTeam)).toBeNull();
  });

  it("returns null when APNS_KEY_ID is absent", () => {
    const { APNS_KEY_ID: _k, ...withoutKey } = FULL_ENV;
    expect(readApnsCredentialsFromEnv(withoutKey)).toBeNull();
  });

  it("returns null when APNS_BUNDLE_ID is absent", () => {
    const { APNS_BUNDLE_ID: _b, ...withoutBundle } = FULL_ENV;
    expect(readApnsCredentialsFromEnv(withoutBundle)).toBeNull();
  });

  it("returns the parsed credentials object when all four env vars are present", () => {
    expect(readApnsCredentialsFromEnv(FULL_ENV)).toEqual(PARSED_ENV_CREDS);
  });
});

describe("sendApnsNotification", () => {
  it("returns {ok:false, skipped:true, error:'APNs not configured'} when creds is null, without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await sendApnsNotification("device-token", PAYLOAD, null, { sandbox: false, fetchImpl });
    expect(result).toEqual({ ok: false, skipped: true, error: "APNs not configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts to api.push.apple.com when sandbox is false", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await sendApnsNotification("device-token", PAYLOAD, CREDS, { sandbox: false, fetchImpl });
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.push.apple.com/3/device/device-token");
  });

  it("posts to api.sandbox.push.apple.com when sandbox is true", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await sendApnsNotification("device-token", PAYLOAD, CREDS, { sandbox: true, fetchImpl });
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.sandbox.push.apple.com/3/device/device-token");
  });

  it("returns ok:true when the mocked fetch responds with status 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await sendApnsNotification("device-token", PAYLOAD, CREDS, { sandbox: false, fetchImpl });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false, permanentFailure:true with the APNs reason when the response is 410 Unregistered", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reason: "Unregistered" }), { status: 410 })
    );
    const result = await sendApnsNotification("device-token", PAYLOAD, CREDS, { sandbox: false, fetchImpl });
    expect(result).toEqual({ ok: false, error: "Unregistered", permanentFailure: true });
  });

  it("returns ok:false, permanentFailure:false for a transient 500 error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reason: "InternalServerError" }), { status: 500 })
    );
    const result = await sendApnsNotification("device-token", PAYLOAD, CREDS, { sandbox: false, fetchImpl });
    expect(result).toEqual({ ok: false, error: "InternalServerError", permanentFailure: false });
  });

  it("logs [ERR-PUSH-APNS-SEND-...] and returns ok:false when fetch rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await sendApnsNotification("device-token", PAYLOAD, CREDS, { sandbox: false, fetchImpl });
    expect(result).toEqual({ ok: false, error: "network unreachable" });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-APNS-SEND-\d+\] sendApnsNotification failed:$/);
    consoleErrorSpy.mockRestore();
  });
});
