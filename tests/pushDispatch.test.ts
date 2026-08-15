import { describe, it, expect, vi } from "vitest";
import { dispatchNotifications, type DispatchDeps } from "../supabase/functions/send-interrupt-notifications/dispatch.ts";
import type { PushTokenRow, ReviewEventRow } from "../supabase/functions/send-interrupt-notifications/types.ts";

const NOW = new Date("2026-06-15T10:00:00.000Z");

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

// A card ready 5 minutes ago — reviewEventsByUser input that yields a
// non-null payload from computeDueEstimate/buildNotificationPayload.
function readyEvent(userId: string, cardId = "card-1"): ReviewEventRow {
  return { card_id: cardId, user_id: userId, reviewed_at: "2026-06-01T00:00:00.000Z", due_date: "2026-06-15T09:00:00.000Z" };
}

function makeDeps(overrides: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    sendApns: vi.fn().mockResolvedValue({ ok: true }),
    sendFcm: vi.fn().mockResolvedValue({ ok: true }),
    claimToken: vi.fn().mockResolvedValue(true),
    deactivateToken: vi.fn().mockResolvedValue(true),
    recordGateFired: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("dispatchNotifications", () => {
  it("calls sendApns (not sendFcm) for an ios token, and sendFcm (not sendApns) for an android token", async () => {
    const iosToken = makeToken({ id: "t-ios", user_id: "u1", platform: "ios" });
    const androidToken = makeToken({ id: "t-android", user_id: "u2", platform: "android" });
    const deps = makeDeps();
    const events = new Map([
      ["u1", [readyEvent("u1")]],
      ["u2", [readyEvent("u2")]],
    ]);

    await dispatchNotifications([iosToken, androidToken], events, NOW, deps);

    expect(deps.sendApns).toHaveBeenCalledTimes(1);
    expect(deps.sendApns).toHaveBeenCalledWith(iosToken, expect.objectContaining({ body: "6 cards ready" }));
    expect(deps.sendFcm).toHaveBeenCalledTimes(1);
    expect(deps.sendFcm).toHaveBeenCalledWith(androidToken, expect.objectContaining({ body: "6 cards ready" }));
  });

  it("still claims and sends when the user has a zero due estimate — the client session floor fills the content (Batch 23)", async () => {
    const token = makeToken({ user_id: "u1" });
    const deps = makeDeps();
    // No events at all for u1 — computeDueEstimate returns cardCount 0. Pre-Batch-23
    // this was skipped entirely, the mobile-side version of the "6-10 interrupts every
    // day, never fewer" gap Task #533 closed on desktop.
    const summary = await dispatchNotifications([token], new Map(), NOW, deps);

    expect(deps.claimToken).toHaveBeenCalledTimes(1);
    expect(deps.sendApns).toHaveBeenCalledWith(token, expect.objectContaining({ body: "6 cards ready" }));
    expect(summary).toEqual({
      sent: 1, failed: 0, skippedAlreadyClaimed: 0,
      skippedNotConfigured: 0, deactivated: 0, erroredUnexpectedly: 0, total: 1,
    });
  });

  it("does not call sendApns for a token when claimToken returns false (already claimed by a concurrent run)", async () => {
    const token = makeToken({ user_id: "u1" });
    const deps = makeDeps({ claimToken: vi.fn().mockResolvedValue(false) });
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const summary = await dispatchNotifications([token], events, NOW, deps);

    expect(deps.sendApns).not.toHaveBeenCalled();
    expect(summary).toEqual({
      sent: 0, failed: 0, skippedAlreadyClaimed: 1,
      skippedNotConfigured: 0, deactivated: 0, erroredUnexpectedly: 0, total: 1,
    });
  });

  it("increments sent and does not deactivate the token when the send returns ok:true", async () => {
    const token = makeToken({ user_id: "u1" });
    const deps = makeDeps();
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const summary = await dispatchNotifications([token], events, NOW, deps);

    expect(summary.sent).toBe(1);
    expect(deps.deactivateToken).not.toHaveBeenCalled();
  });

  it("deactivates the token and increments deactivated (not failed) when the send returns permanentFailure:true", async () => {
    const token = makeToken({ id: "dead-token", user_id: "u1" });
    const deps = makeDeps({ sendApns: vi.fn().mockResolvedValue({ ok: false, permanentFailure: true, error: "Unregistered" }) });
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const summary = await dispatchNotifications([token], events, NOW, deps);

    expect(deps.deactivateToken).toHaveBeenCalledWith("dead-token");
    expect(summary).toEqual({
      sent: 0, failed: 0, skippedAlreadyClaimed: 0,
      skippedNotConfigured: 0, deactivated: 1, erroredUnexpectedly: 0, total: 1,
    });
  });

  it("does not call deactivateToken for a transient (non-permanent) send failure, and counts it as failed", async () => {
    const token = makeToken({ user_id: "u1" });
    const deps = makeDeps({ sendApns: vi.fn().mockResolvedValue({ ok: false, permanentFailure: false, error: "HTTP 500" }) });
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const summary = await dispatchNotifications([token], events, NOW, deps);

    expect(deps.deactivateToken).not.toHaveBeenCalled();
    expect(summary).toEqual({
      sent: 0, failed: 1, skippedAlreadyClaimed: 0,
      skippedNotConfigured: 0, deactivated: 0, erroredUnexpectedly: 0, total: 1,
    });
  });

  it("counts a permanentFailure send as failed (not deactivated) when the deactivation write itself fails", async () => {
    const token = makeToken({ id: "dead-token", user_id: "u1" });
    const deps = makeDeps({
      sendApns: vi.fn().mockResolvedValue({ ok: false, permanentFailure: true, error: "Unregistered" }),
      deactivateToken: vi.fn().mockResolvedValue(false),
    });
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const summary = await dispatchNotifications([token], events, NOW, deps);

    expect(deps.deactivateToken).toHaveBeenCalledWith("dead-token");
    expect(summary).toEqual({
      sent: 0, failed: 1, skippedAlreadyClaimed: 0,
      skippedNotConfigured: 0, deactivated: 0, erroredUnexpectedly: 0, total: 1,
    });
  });

  it("counts a skipped (not-configured) send separately from a real failure, without deactivating", async () => {
    const token = makeToken({ user_id: "u1" });
    const deps = makeDeps({ sendApns: vi.fn().mockResolvedValue({ ok: false, skipped: true, error: "APNs not configured" }) });
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const summary = await dispatchNotifications([token], events, NOW, deps);

    expect(deps.deactivateToken).not.toHaveBeenCalled();
    expect(summary).toEqual({
      sent: 0, failed: 0, skippedAlreadyClaimed: 0,
      skippedNotConfigured: 1, deactivated: 0, erroredUnexpectedly: 0, total: 1,
    });
  });

  it("isolates an unexpected exception to the one token that threw, still processing the rest of the batch", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwingToken = makeToken({ id: "t-throws", user_id: "u1" });
    const okToken = makeToken({ id: "t-ok", user_id: "u2" });
    const deps = makeDeps({
      claimToken: vi.fn().mockImplementation((tokenId: string) => {
        if (tokenId === "t-throws") throw new Error("unexpected claim failure");
        return Promise.resolve(true);
      }),
    });
    const events = new Map([
      ["u1", [readyEvent("u1")]],
      ["u2", [readyEvent("u2")]],
    ]);

    const summary = await dispatchNotifications([throwingToken, okToken], events, NOW, deps);

    expect(deps.sendApns).toHaveBeenCalledTimes(1);
    expect(deps.sendApns).toHaveBeenCalledWith(okToken, expect.anything());
    expect(summary).toEqual({
      sent: 1, failed: 0, skippedAlreadyClaimed: 0,
      skippedNotConfigured: 0, deactivated: 0, erroredUnexpectedly: 1, total: 2,
    });
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSH-DISPATCH-TOKEN-\d+\] unexpected error processing token t-throws:$/);
    consoleErrorSpy.mockRestore();
  });

  it("processes two tokens for the same user strictly sequentially: token A's claim+send fully completes before token B's claim starts", async () => {
    // This is the actual concurrency-safety property the sequential for..of
    // design (dispatch.ts's own header comment) relies on: if token B's
    // claim were ever issued before token A's send settled, a naive
    // Promise.all-style implementation would be racing two in-flight sends
    // against the same claim/record bookkeeping. Recording call order
    // proves the loop never does that, deterministically — no reliance on
    // guessing microtask interleaving.
    const tokenA = makeToken({ id: "token-a", user_id: "u1", device_id: "device-a" });
    const tokenB = makeToken({ id: "token-b", user_id: "u1", device_id: "device-b" });
    const events = new Map([["u1", [readyEvent("u1")]]]);

    const callOrder: string[] = [];
    const claimToken = vi.fn().mockImplementation((tokenId: string) => {
      callOrder.push(`claim:${tokenId}`);
      return Promise.resolve(true);
    });
    const sendApns = vi.fn().mockImplementation((token: PushTokenRow) => {
      callOrder.push(`send:${token.id}`);
      return Promise.resolve({ ok: true });
    });
    const deps = makeDeps({ claimToken, sendApns });

    const summary = await dispatchNotifications([tokenA, tokenB], events, NOW, deps);

    expect(callOrder).toEqual(["claim:token-a", "send:token-a", "claim:token-b", "send:token-b"]);
    expect(summary.sent).toBe(2);
  });

  it("returns exact aggregate counts across a mixed batch", async () => {
    const sentToken = makeToken({ id: "t-sent", user_id: "u1" });
    const failedToken = makeToken({ id: "t-failed", user_id: "u2" });
    const deactivatedToken = makeToken({ id: "t-dead", user_id: "u3" });
    const claimedElsewhereToken = makeToken({ id: "t-claimed", user_id: "u4" });
    const noCardsToken = makeToken({ id: "t-empty", user_id: "u5" });

    const deps = makeDeps({
      sendApns: vi.fn().mockImplementation((token: PushTokenRow) => {
        if (token.id === "t-sent") return Promise.resolve({ ok: true });
        if (token.id === "t-failed") return Promise.resolve({ ok: false, permanentFailure: false, error: "HTTP 500" });
        if (token.id === "t-dead") return Promise.resolve({ ok: false, permanentFailure: true, error: "Unregistered" });
        if (token.id === "t-empty") return Promise.resolve({ ok: true }); // Batch 23: zero estimate still sends
        throw new Error(`unexpected send call for ${token.id}`);
      }),
      claimToken: vi.fn().mockImplementation((tokenId: string) => Promise.resolve(tokenId !== "t-claimed")),
    });
    const events = new Map([
      ["u1", [readyEvent("u1")]],
      ["u2", [readyEvent("u2")]],
      ["u3", [readyEvent("u3")]],
      ["u4", [readyEvent("u4")]],
      // u5 has no events at all -> cardCount 0 -> Batch 23: sends anyway with the floored body.
    ]);

    const summary = await dispatchNotifications(
      [sentToken, failedToken, deactivatedToken, claimedElsewhereToken, noCardsToken],
      events,
      NOW,
      deps
    );

    expect(summary).toEqual({
      sent: 2, failed: 1, skippedAlreadyClaimed: 1,
      skippedNotConfigured: 0, deactivated: 1, erroredUnexpectedly: 0, total: 5,
    });
  });

  // Task #527 — dispatch.ts now writes a `fired` row to the shared interrupt_gate_events
  // gate on a real send, so the NEXT dispatch run's dueSelection.ts read excludes this
  // user across every device, not just this one token.
  describe("recordGateFired", () => {
    it("calls recordGateFired with the token's user/device and an effective_until computed from its own interrupt_interval_minutes, after a successful send", async () => {
      const token = makeToken({ user_id: "u1", device_id: "device-a", interrupt_interval_minutes: 90 });
      const deps = makeDeps();
      const events = new Map([["u1", [readyEvent("u1")]]]);

      await dispatchNotifications([token], events, NOW, deps);

      expect(deps.recordGateFired).toHaveBeenCalledWith(
        "u1",
        "device-a",
        "2026-06-15T10:00:00.000Z", // NOW
        "2026-06-15T11:30:00.000Z" // NOW + 90 minutes
      );
    });

    it("does not call recordGateFired when the send fails (transient failure)", async () => {
      const token = makeToken({ user_id: "u1" });
      const deps = makeDeps({ sendApns: vi.fn().mockResolvedValue({ ok: false, permanentFailure: false, error: "HTTP 500" }) });
      const events = new Map([["u1", [readyEvent("u1")]]]);

      await dispatchNotifications([token], events, NOW, deps);

      expect(deps.recordGateFired).not.toHaveBeenCalled();
    });

    it("records the gate after a zero-estimate send too — the floored session still spaces the next interrupt (Batch 23)", async () => {
      const token = makeToken({ user_id: "u1" });
      const deps = makeDeps();

      // No events → estimate 0 → pre-Batch-23 this skipped (no send, no gate);
      // now the send happens and the 90-minute gate must still be written.
      await dispatchNotifications([token], new Map(), NOW, deps);

      expect(deps.recordGateFired).toHaveBeenCalledTimes(1);
    });

    it("does not call recordGateFired when claimToken loses the race (never sent)", async () => {
      const token = makeToken({ user_id: "u1" });
      const deps = makeDeps({ claimToken: vi.fn().mockResolvedValue(false) });
      const events = new Map([["u1", [readyEvent("u1")]]]);

      await dispatchNotifications([token], events, NOW, deps);

      expect(deps.recordGateFired).not.toHaveBeenCalled();
    });

    it("still reports sent:1 (unaffected) when recordGateFired itself fails, logging the failure separately", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const token = makeToken({ user_id: "u1" });
      const deps = makeDeps({ recordGateFired: vi.fn().mockResolvedValue(false) });
      const events = new Map([["u1", [readyEvent("u1")]]]);

      const summary = await dispatchNotifications([token], events, NOW, deps);

      expect(summary.sent).toBe(1);
      expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(
        /^\[ERR-PUSH-GATE-RECORD-\d+\] recordGateFired failed for user u1 after a successful send$/
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
