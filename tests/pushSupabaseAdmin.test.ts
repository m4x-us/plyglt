import { describe, it, expect, vi } from "vitest";
import {
  fetchAllPushTokens,
  fetchReviewEventsForUsers,
  fetchGateStateForUsers,
  claimToken,
  deactivateToken,
  recordGateFired,
} from "../supabase/functions/send-interrupt-notifications/supabaseAdmin.ts";
import type { PushTokenRow } from "../supabase/functions/send-interrupt-notifications/types.ts";

const SUPABASE_URL = "https://project.supabase.co";
const SERVICE_ROLE_KEY = "service-role-key-abc";

function makeToken(overrides: Partial<PushTokenRow> = {}): PushTokenRow {
  return {
    id: "token-1",
    user_id: "user-1",
    platform: "ios",
    device_id: "device-1",
    token: "raw-token",
    app_env: "production",
    timezone: "Europe/Rome",
    interrupt_interval_minutes: 90,
    waking_hours_start_local: 8,
    waking_hours_end_local: 20,
    last_sent_at: null,
    deactivated_at: null,
    ...overrides,
  };
}

describe("fetchAllPushTokens", () => {
  it("requests only non-deactivated rows and returns them on success", async () => {
    const tokens = [makeToken()];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 }));

    const result = await fetchAllPushTokens(SUPABASE_URL, SERVICE_ROLE_KEY, fetchImpl);

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://project.supabase.co/rest/v1/push_tokens?select=*&deactivated_at=is.null"
    );
    expect(result).toEqual({ ok: true, rows: tokens });
  });

  // Round-19 audit fix (re-triaged debt from the 2026-08-08 Task #170 audit, deferred back
  // then as "not reachable — no production caller writes rows yet"; that precondition is no
  // longer true as of Task #522's 2026-08-14 live push launch): a genuine fetch failure used
  // to collapse into the identical `[]` a real "zero rows" response produces — an outage
  // during a cron tick was indistinguishable from "nobody has data." Deletion Test:
  // reverting to a bare `[]` return makes this test's `{ok:false, error}` assertion fail.
  it("returns {ok:false, error} (not a throw, and not a bare empty array) when the request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await fetchAllPushTokens(SUPABASE_URL, SERVICE_ROLE_KEY, fetchImpl);
    expect(result).toEqual({ ok: false, error: "HTTP 500" });
    consoleErrorSpy.mockRestore();
  });

  it("returns {ok:false, error} (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    // Audit finding (2026-08-08): the prior version only handled a resolved
    // non-ok Response; a genuine network exception from fetchImpl was
    // uncaught. This is the case the sibling test above's "(not a throw)"
    // framing didn't actually prove.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await fetchAllPushTokens(SUPABASE_URL, SERVICE_ROLE_KEY, fetchImpl);
    expect(result).toEqual({ ok: false, error: "network unreachable" });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FETCH-TOKENS-\d+\] fetchAllPushTokens failed:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("fetchReviewEventsForUsers", () => {
  it("returns {ok:true, rows:[]} without calling fetch when userIds is empty", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchReviewEventsForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, [], fetchImpl);
    expect(result).toEqual({ ok: true, rows: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scopes the request to exactly the given user ids via an in.() filter", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await fetchReviewEventsForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1", "u2"], fetchImpl);
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://project.supabase.co/rest/v1/review_events?select=card_id,user_id,reviewed_at,due_date&user_id=in.("u1","u2")'
    );
  });

  // Round-19 audit fix: same Result-shaped distinction as fetchAllPushTokens above.
  it("returns {ok:false, error} (not a bare empty array) when the request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const result = await fetchReviewEventsForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1"], fetchImpl);
    expect(result).toEqual({ ok: false, error: "HTTP 503" });
    consoleErrorSpy.mockRestore();
  });

  it("returns {ok:false, error} (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await fetchReviewEventsForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1"], fetchImpl);
    expect(result).toEqual({ ok: false, error: "network unreachable" });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FETCH-EVENTS-\d+\] fetchReviewEventsForUsers failed:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("fetchGateStateForUsers", () => {
  it("returns an empty Map without calling fetch when userIds is empty", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchGateStateForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, [], fetchImpl);
    expect(result).toEqual(new Map());
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scopes the request to exactly the given user ids, ordered by effective_until desc", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await fetchGateStateForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1", "u2"], fetchImpl);
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://project.supabase.co/rest/v1/interrupt_gate_events?select=user_id,effective_until&user_id=in.("u1","u2")&order=effective_until.desc'
    );
  });

  it("reduces multiple rows per user to that user's max effective_until (first row per user, since ordered desc)", async () => {
    const rows = [
      { user_id: "u1", effective_until: "2026-06-15T12:00:00.000Z" }, // most recent for u1
      { user_id: "u1", effective_until: "2026-06-15T10:00:00.000Z" }, // older duplicate, ignored
      { user_id: "u2", effective_until: "2026-06-15T09:00:00.000Z" },
    ];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }));
    const result = await fetchGateStateForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1", "u2"], fetchImpl);
    expect(result).toEqual(
      new Map([
        ["u1", "2026-06-15T12:00:00.000Z"],
        ["u2", "2026-06-15T09:00:00.000Z"],
      ])
    );
  });

  it("returns an empty Map (not a throw) when the request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await fetchGateStateForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1"], fetchImpl);
    expect(result).toEqual(new Map());
    consoleErrorSpy.mockRestore();
  });

  it("returns an empty Map (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await fetchGateStateForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1"], fetchImpl);
    expect(result).toEqual(new Map());
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FETCH-GATE-\d+\] fetchGateStateForUsers failed:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("recordGateFired", () => {
  it("POSTs a fired event with the exact given fields and returns true on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    const result = await recordGateFired(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      "user-1",
      "device-1",
      "2026-06-15T10:00:00.000Z",
      "2026-06-15T11:30:00.000Z",
      fetchImpl
    );

    expect(result).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://project.supabase.co/rest/v1/interrupt_gate_events");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      user_id: "user-1",
      event_type: "fired",
      occurred_at: "2026-06-15T10:00:00.000Z",
      effective_until: "2026-06-15T11:30:00.000Z",
      device_id: "device-1",
    });
  });

  it("returns false (not a throw) when the request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await recordGateFired(
      SUPABASE_URL, SERVICE_ROLE_KEY, "user-1", "device-1",
      "2026-06-15T10:00:00.000Z", "2026-06-15T11:30:00.000Z", fetchImpl
    );
    expect(result).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("returns false (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await recordGateFired(
      SUPABASE_URL, SERVICE_ROLE_KEY, "user-1", "device-1",
      "2026-06-15T10:00:00.000Z", "2026-06-15T11:30:00.000Z", fetchImpl
    );
    expect(result).toBe(false);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-GATE-RECORD-\d+\] recordGateFired failed for user user-1:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("claimToken", () => {
  it("PATCHes last_sent_at scoped by the correct cutoff and returns true when the response contains a row", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "token-1" }]), { status: 200 }));

    const claimed = await claimToken(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      "token-1",
      "2026-06-15T10:00:00.000Z",
      90,
      fetchImpl
    );

    expect(claimed).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://project.supabase.co/rest/v1/push_tokens?id=eq.token-1&or=(last_sent_at.is.null,last_sent_at.lte.2026-06-15T08:30:00.000Z)"
    );
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ last_sent_at: "2026-06-15T10:00:00.000Z" });
  });

  it("returns false when the response contains no rows (another process already won the claim)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const claimed = await claimToken(SUPABASE_URL, SERVICE_ROLE_KEY, "token-1", "2026-06-15T10:00:00.000Z", 90, fetchImpl);
    expect(claimed).toBe(false);
  });

  it("returns false (not a throw) when the PATCH request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const claimed = await claimToken(SUPABASE_URL, SERVICE_ROLE_KEY, "token-1", "2026-06-15T10:00:00.000Z", 90, fetchImpl);
    expect(claimed).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("returns false (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const claimed = await claimToken(SUPABASE_URL, SERVICE_ROLE_KEY, "token-1", "2026-06-15T10:00:00.000Z", 90, fetchImpl);
    expect(claimed).toBe(false);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-CLAIM-\d+\] claimToken failed for token-1:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("deactivateToken", () => {
  it("PATCHes deactivated_at and returns true on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await deactivateToken(SUPABASE_URL, SERVICE_ROLE_KEY, "token-1", fetchImpl);
    expect(result).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://project.supabase.co/rest/v1/push_tokens?id=eq.token-1");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string) as { deactivated_at: string };
    expect(typeof body.deactivated_at).toBe("string"); // existence-check: real timestamp of the call, non-deterministic
  });

  it("returns false (not a throw) when the request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await deactivateToken(SUPABASE_URL, SERVICE_ROLE_KEY, "token-1", fetchImpl);
    expect(result).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("returns false (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await deactivateToken(SUPABASE_URL, SERVICE_ROLE_KEY, "token-1", fetchImpl);
    expect(result).toBe(false);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-DEACTIVATE-\d+\] deactivateToken failed for token-1:$/);
    consoleErrorSpy.mockRestore();
  });
});
