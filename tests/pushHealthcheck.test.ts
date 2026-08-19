import { describe, it, expect, vi } from "vitest";
import {
  readHealthcheckUrlFromEnv,
  decideHealthcheckOutcome,
  pingHealthcheck,
} from "../supabase/functions/send-interrupt-notifications/healthcheck.ts";
import type { DispatchSummary } from "../supabase/functions/send-interrupt-notifications/types.ts";

function makeSummary(overrides: Partial<DispatchSummary> = {}): DispatchSummary {
  return {
    sent: 0,
    failed: 0,
    skippedAlreadyClaimed: 0,
    skippedNotConfigured: 0,
    deactivated: 0,
    erroredUnexpectedly: 0,
    sentWithZeroEstimate: 0,
    total: 0,
    ...overrides,
  };
}

describe("readHealthcheckUrlFromEnv", () => {
  it("returns null when HEALTHCHECK_PING_URL is absent", () => {
    expect(readHealthcheckUrlFromEnv({})).toBeNull();
  });

  it("returns null when HEALTHCHECK_PING_URL is an empty string", () => {
    expect(readHealthcheckUrlFromEnv({ HEALTHCHECK_PING_URL: "" })).toBeNull();
  });

  it("returns the configured URL verbatim when present", () => {
    expect(readHealthcheckUrlFromEnv({ HEALTHCHECK_PING_URL: "https://hc-ping.com/abc-123" })).toBe(
      "https://hc-ping.com/abc-123"
    );
  });
});

describe("decideHealthcheckOutcome", () => {
  it("is healthy on an empty tick (no due tokens this run)", () => {
    expect(decideHealthcheckOutcome(makeSummary({ total: 0 }))).toEqual({ outcome: "success" });
  });

  it("is healthy when at least one send succeeded, even if others failed", () => {
    const summary = makeSummary({ total: 5, sent: 3, failed: 2 });
    expect(decideHealthcheckOutcome(summary)).toEqual({ outcome: "success" });
  });

  it("is healthy when every token was skippedAlreadyClaimed (an overlapping cron tick, not a failure)", () => {
    const summary = makeSummary({ total: 4, skippedAlreadyClaimed: 4 });
    expect(decideHealthcheckOutcome(summary)).toEqual({ outcome: "success" });
  });

  it("is healthy when the whole batch was skippedNotConfigured (APNs/FCM genuinely absent, not expired)", () => {
    const summary = makeSummary({ total: 3, failed: 0, skippedNotConfigured: 3 });
    expect(decideHealthcheckOutcome(summary)).toEqual({ outcome: "success" });
  });

  it("is healthy when every token was a legitimately dead device (all deactivated, zero failed/errored)", () => {
    // Deletion Test target: if decideHealthcheckOutcome counted `deactivated` as a failure,
    // this would wrongly fire "fail" on a batch where token cleanup worked exactly as
    // designed — no real problem, just stale devices being pruned.
    const summary = makeSummary({ total: 3, sent: 0, deactivated: 3, failed: 0, erroredUnexpectedly: 0 });
    expect(decideHealthcheckOutcome(summary)).toEqual({ outcome: "success" });
  });

  it("fails when every attempted send failed and credentials were configured", () => {
    const summary = makeSummary({ total: 4, sent: 0, failed: 4, skippedNotConfigured: 0 });
    expect(decideHealthcheckOutcome(summary)).toEqual({
      outcome: "fail",
      detail:
        "total dispatch failure: 0/4 sent, 4 failed/errored (0 deactivated as dead tokens, 0 skipped-already-claimed, 0 skipped-not-configured) — check APNs/FCM credential validity",
    });
  });

  it("fails when every provider-configured attempt failed, even alongside an unrelated skippedNotConfigured token", () => {
    // total=3: 1 token had no configured provider (excluded from `attempted`, not this run's
    // outcome to report on) and the other 2 — genuinely attempted, with real credentials —
    // both failed. This is exactly the credential-expiry-shaped signal worth flagging; mixing
    // in one unrelated not-configured token must not suppress it.
    const summary = makeSummary({ total: 3, sent: 0, failed: 2, skippedNotConfigured: 1 });
    const result = decideHealthcheckOutcome(summary);
    expect(result.outcome).toBe("fail");
    expect(result.detail).toBe(
      "total dispatch failure: 0/2 sent, 2 failed/errored (0 deactivated as dead tokens, 0 skipped-already-claimed, 1 skipped-not-configured) — check APNs/FCM credential validity"
    );
  });

  // Adversarial-review finding #2: erroredUnexpectedly previously wasn't counted at all — a
  // systemic bug that made every token throw (e.g. a payload-building regression) landed
  // entirely in erroredUnexpectedly, sent===0, failed===0, and the old check
  // (`summary.failed > 0`) never fired — the exact class of incident this feature exists to
  // catch went completely unalerted. Deletion Test: dropping erroredUnexpectedly from
  // failureCount makes this fail (would assert "success" instead).
  it("fails when every token threw an unexpected exception, even with zero `failed`", () => {
    const summary = makeSummary({ total: 5, sent: 0, failed: 0, erroredUnexpectedly: 5 });
    expect(decideHealthcheckOutcome(summary).outcome).toBe("fail");
  });

  // Adversarial-review finding #3: the old check used `summary.total` directly as both the
  // condition's implicit denominator and the message's numerator, so a mostly-skippedAlready-
  // Claimed tick (a normal overlapping-cron-tick outcome) with just 2 unrelated genuine
  // failures produced a misleading "0/10 sent, 2 failed" message when only 2 tokens were
  // truly attempted. Deletion Test: reverting `attempted` back to `summary.total` in the
  // detail string makes this message assertion fail (would read "0/10 sent" instead of "0/2").
  it("scopes the failure message to genuinely attempted tokens, excluding claim-race skips from the denominator", () => {
    const summary = makeSummary({ total: 10, sent: 0, failed: 2, skippedAlreadyClaimed: 8 });
    const result = decideHealthcheckOutcome(summary);
    expect(result.outcome).toBe("fail");
    expect(result.detail).toBe(
      "total dispatch failure: 0/2 sent, 2 failed/errored (0 deactivated as dead tokens, 8 skipped-already-claimed, 0 skipped-not-configured) — check APNs/FCM credential validity"
    );
  });

  it("is healthy when skippedAlreadyClaimed accounts for the entire batch alongside zero genuine failures (no false positive on a pure claim-race tick)", () => {
    const summary = makeSummary({ total: 8, sent: 0, failed: 0, erroredUnexpectedly: 0, skippedAlreadyClaimed: 8 });
    expect(decideHealthcheckOutcome(summary)).toEqual({ outcome: "success" });
  });
});

describe("pingHealthcheck", () => {
  it("does not call fetch when url is null (monitoring not configured)", async () => {
    const fetchImpl = vi.fn();
    await pingHealthcheck(null, "success", undefined, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs to the bare URL on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("OK"));
    await pingHealthcheck("https://hc-ping.com/abc-123", "success", undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("https://hc-ping.com/abc-123", { method: "POST", body: "" });
  });

  it("POSTs to the /fail suffix on failure, with the detail as the body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("OK"));
    await pingHealthcheck("https://hc-ping.com/abc-123", "fail", "tokens_fetch_failed: HTTP 503", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("https://hc-ping.com/abc-123/fail", {
      method: "POST",
      body: "tokens_fetch_failed: HTTP 503",
    });
  });

  it("never throws when the ping request itself rejects — a monitoring failure must not crash the caller", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(pingHealthcheck("https://hc-ping.com/abc-123", "success", undefined, fetchImpl)).resolves.toBeUndefined();
  });

  // Adversarial-review finding #1: a resolved fetch with a non-2xx status (bad ping URL,
  // Healthchecks.io itself down, a deleted check id) is not a thrown exception — the
  // try/catch alone never sees it, so the ping silently drops with zero logging. Deletion
  // Test: removing the `if (!response.ok)` check makes this test fail (console.error would
  // never be called for a 404 response).
  it("logs a ref-ID error when the ping resolves with a non-2xx status, instead of silently dropping it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await pingHealthcheck("https://hc-ping.com/deleted-check", "fail", "some detail", fetchImpl);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[ERR-HEALTHCHECK-PING-\d+\] fail ping to healthcheck endpoint returned HTTP 404$/)
    );
    consoleErrorSpy.mockRestore();
  });

  it("does not log an error when the ping resolves with a 2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await pingHealthcheck("https://hc-ping.com/abc-123", "success", undefined, fetchImpl);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
