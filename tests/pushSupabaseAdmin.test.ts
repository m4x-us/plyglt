import { describe, it, expect, vi } from "vitest";
import {
  fetchAllPushTokens,
  fetchReviewEventsForUsers,
  claimToken,
  deactivateToken,
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
    expect(result).toEqual(tokens);
  });

  it("returns an empty array (not a throw) when the request resolves with a non-ok status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await fetchAllPushTokens(SUPABASE_URL, SERVICE_ROLE_KEY, fetchImpl);
    expect(result).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it("returns an empty array (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    // Audit finding (2026-08-08): the prior version only handled a resolved
    // non-ok Response; a genuine network exception from fetchImpl was
    // uncaught. This is the case the sibling test above's "(not a throw)"
    // framing didn't actually prove.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await fetchAllPushTokens(SUPABASE_URL, SERVICE_ROLE_KEY, fetchImpl);
    expect(result).toEqual([]);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FETCH-TOKENS-\d+\] fetchAllPushTokens failed:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("fetchReviewEventsForUsers", () => {
  it("returns an empty array without calling fetch when userIds is empty", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchReviewEventsForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, [], fetchImpl);
    expect(result).toEqual([]);
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

  it("returns an empty array (not a throw) when fetchImpl itself rejects (network exception)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await fetchReviewEventsForUsers(SUPABASE_URL, SERVICE_ROLE_KEY, ["u1"], fetchImpl);
    expect(result).toEqual([]);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-FETCH-EVENTS-\d+\] fetchReviewEventsForUsers failed:$/);
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
