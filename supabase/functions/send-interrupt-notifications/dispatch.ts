// ============================================================
// dispatch.ts — orchestrates estimate -> claim -> send -> record for each due token (Task #170)
// ============================================================
// Processes tokens SEQUENTIALLY (a plain for..of with await inside, never
// Promise.all) — a deliberate choice, not an oversight. The real
// concurrency-safety guarantee (supabaseAdmin.ts's claimToken) is safe to
// parallelize since Postgres serializes the underlying UPDATE regardless of
// caller ordering, but processing sequentially also avoids one Edge Function
// invocation bursting a large batch of simultaneous requests at APNs/FCM
// or the Postgres connection pool. Batch 23 (2026-08-14) removed the
// zero-estimate skip, so every gated-eligible token proceeds through
// claimToken/send, with no short-circuit for a zero due estimate.
//
// Task #621 (2026-08-16), re-examining the scale concern this raised: Task
// #623 (Wave 6) independently widens the shared cross-device gate to
// ZERO_ESTIMATE_GATE_MINUTES (24h, see dueEstimate.ts) after any zero-estimate
// send. Because dueSelection.ts's selectDueTokens excludes a user from
// `candidateTokens` entirely while their gate is in effect, a zero-estimate
// send removes that same user from candidacy for a full day, not just until
// their next normal interrupt_interval_minutes elapses. This converts the
// added send volume from "every gated-eligible zero-estimate token, every
// interval, indefinitely" (the shape that motivated the original "not yet
// measured" caution) into "at most one extra claim+send per active user per
// 24h" — a small, bounded, steady-state addition, not an unbounded repeat.
// The sequential-processing choice above still stands as the burst-shape
// control for whatever volume a single invocation does carry (this was
// always true independent of the zero-estimate question). Given this
// mitigation, a dedicated throttle (a per-invocation token cap, or an
// inter-send delay) is not added here — it would add real complexity against
// a risk this reasoning shows is already substantially bounded, with no
// measured latency problem to justify it. Revisit if real dispatch volume
// ever surfaces a measured latency problem the 24h gate doesn't cover (e.g.
// a very large simultaneous first-time-zero-estimate cohort on one tick,
// which the gate cannot smooth out since it only takes effect after a
// user's first such send).
// ============================================================
// DEPENDS ON: ./types.ts, ./dueEstimate.ts
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

import type { PushTokenRow, ReviewEventRow, DispatchSummary, NotificationPayload, PushSendResult } from "./types.ts";
import { computeDueEstimate, buildNotificationPayload, ZERO_ESTIMATE_GATE_MINUTES } from "./dueEstimate.ts";

export interface DispatchDeps {
  sendApns: (token: PushTokenRow, payload: NotificationPayload) => Promise<PushSendResult>;
  sendFcm: (token: PushTokenRow, payload: NotificationPayload) => Promise<PushSendResult>;
  claimToken: (tokenId: string, nowIso: string, intervalMinutes: number) => Promise<boolean>;
  deactivateToken: (tokenId: string) => Promise<boolean>;
  // Task #527 — records a `fired` row in the shared, cross-device gate
  // (interrupt_gate_events) after a real send, so the NEXT dispatch run's
  // dueSelection.ts read excludes this user regardless of which device fires next.
  recordGateFired: (userId: string, deviceId: string, occurredAt: string, effectiveUntil: string) => Promise<boolean>;
}

/**
 * Processes one already-claimed token: send, then record the outcome.
 * Split out from the loop body specifically so it can be wrapped in a
 * single try/catch per token (see dispatchNotifications) — every call
 * inside here is already individually guarded by its own module (jwt.ts's
 * signing errors, apnsClient.ts/fcmClient.ts's network errors, and
 * supabaseAdmin.ts's network errors are all caught at their source and
 * resolved rather than thrown), but this is a deliberate defensive
 * backstop: a bug in any future addition to this chain should abort
 * processing for ONE token, never the rest of the batch.
 */
async function sendAndRecord(
  token: PushTokenRow,
  payload: NotificationPayload,
  estimateCardCount: number,
  deps: DispatchDeps,
  summary: DispatchSummary,
  now: Date
): Promise<void> {
  const send = token.platform === "ios" ? deps.sendApns : deps.sendFcm;
  const result = await send(token, payload);

  if (result.ok) {
    summary.sent++;
    // Task #550: a subset of `sent`, not additional to it — see DispatchSummary's
    // doc comment on this field for why the distinction matters.
    if (estimateCardCount === 0) summary.sentWithZeroEstimate++;
    // Task #527 — write the shared gate event AFTER a confirmed send, using this
    // token's own interrupt_interval_minutes (the interval in effect for this send,
    // per docs/INTERRUPT_ARCHITECTURE.md §5 — effective_until is computed once at
    // write time, never re-derived by a reader from the user's current setting).
    // recordGateFired never throws (supabaseAdmin.ts's contract) — a write failure
    // here does not downgrade an already-successful send; it only means the next
    // dispatch run's gate read may re-select this user sooner than intended, logged
    // as its own distinct concern rather than folded into `failed`.
    // Task #623: a zero-estimate send (see dueEstimate.ts's ZERO_ESTIMATE_GATE_MINUTES
    // doc comment for the full reasoning) widens this gate to the longer daily backoff
    // instead of the token's own normal interval, so a genuinely caught-up user isn't
    // re-pinged every interval indefinitely. Math.max guards the rare case of a user
    // whose own configured interval already exceeds the daily backoff — never SHRINK
    // the gate below whichever is longer.
    const gateMinutes = estimateCardCount === 0
      ? Math.max(ZERO_ESTIMATE_GATE_MINUTES, token.interrupt_interval_minutes)
      : token.interrupt_interval_minutes;
    const occurredAt = now.toISOString();
    const effectiveUntil = new Date(now.getTime() + gateMinutes * 60_000).toISOString();
    // Task #642: a recordGateFired failure is NOT symmetric between the two cases above,
    // even though both used to be treated identically ("log it, move on"). claimToken's own
    // per-token CAS guard (supabaseAdmin.ts) always throttles on the token's plain
    // interrupt_interval_minutes, never on the widened daily backoff — dueSelection.ts's
    // gate read (interrupt_gate_events, written here) is the ONLY thing that actually
    // enforces "at most once per day" for a zero-estimate send. A non-zero-estimate send's
    // gate-write failure only costs cross-device coordination (a second device might also
    // ping this user before the next successful write) — a real but comparatively minor
    // annoyance, since this same token/device is still correctly re-throttled by its own
    // normal interval either way. A zero-estimate send's gate-write failure, left
    // unretried, reproduces the EXACT recurring-content-free-push-every-interval
    // notification-fatigue bug (BRAND.md's stress-free principle, a real uninstall risk)
    // that Task #623 exists to fix — for as long as the write keeps failing for that user.
    // Given that asymmetry, a bare "log and accept" is not the proportionate response here.
    // Fix: retry the write a bounded, small number of times (no backoff delay — this loop
    // is already sequential per token, per dispatch.ts's file-header burst-control rationale,
    // so an unbounded or sleep-based retry would itself become the volume problem #621
    // examined; an immediate retry costs one more await, no more, and still recovers a
    // transient connection blip, which is the dominant real-world failure mode for a single
    // REST POST). Applies uniformly to both cases (simpler than branching this loop by
    // estimate) — the non-zero case gets the same small resilience improvement as a side
    // benefit, but the retry's mandate specifically comes from the zero-estimate case's
    // more severe consequence.
    const GATE_RECORD_MAX_ATTEMPTS = 3;
    let recorded = false;
    for (let attempt = 1; attempt <= GATE_RECORD_MAX_ATTEMPTS && !recorded; attempt++) {
      recorded = await deps.recordGateFired(token.user_id, token.device_id, occurredAt, effectiveUntil);
    }
    if (!recorded) {
      console.error(`[ERR-PUSH-GATE-RECORD-${Date.now()}] recordGateFired failed for user ${token.user_id} after a successful send (${GATE_RECORD_MAX_ATTEMPTS} attempts)`);
    }
    return;
  }

  if (result.skipped) {
    // Provider not configured for this deployment — an expected ops state,
    // not a delivery failure. The claim already stamped last_sent_at, so
    // this token won't be retried again until its normal interval elapses;
    // that's an accepted tradeoff of the current claim-before-send design,
    // not something this function can distinguish or avoid.
    summary.skippedNotConfigured++;
    return;
  }

  if (result.permanentFailure) {
    const deactivated = await deps.deactivateToken(token.id);
    if (deactivated) {
      summary.deactivated++;
    } else {
      // The provider said this token is permanently dead, but the DB write
      // marking it dead itself failed — the token stays live (deactivated_at
      // untouched) and will be reselected as due and retried on its next
      // normal interval, which is the honest outcome: report it as failed,
      // not as successfully deactivated.
      summary.failed++;
    }
    return;
  }

  // Transient failure: last_sent_at was already stamped by the claim
  // above, so this token naturally retries on its next normal
  // interrupt_interval_minutes cadence rather than being hammered again
  // on the very next 5-minute cron tick.
  summary.failed++;
}

export async function dispatchNotifications(
  candidateTokens: readonly PushTokenRow[],
  reviewEventsByUser: ReadonlyMap<string, ReviewEventRow[]>,
  now: Date,
  deps: DispatchDeps
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    sent: 0,
    failed: 0,
    skippedAlreadyClaimed: 0,
    skippedNotConfigured: 0,
    deactivated: 0,
    erroredUnexpectedly: 0,
    sentWithZeroEstimate: 0,
    total: candidateTokens.length,
  };

  for (const token of candidateTokens) {
    try {
      const events = reviewEventsByUser.get(token.user_id) ?? [];
      const estimate = computeDueEstimate(events, token.user_id, now);
      // Batch 23: buildNotificationPayload always returns a payload — the
      // client's session floor (lib/queue.ts INTERRUPT_SESSION_FLOOR) fills
      // any shortfall, so a zero server-side estimate is never a reason to
      // skip. The interval/waking-hours/cross-device gates in dueSelection.ts
      // remain the only send/no-send decisions.
      const payload = buildNotificationPayload(estimate);

      const claimed = await deps.claimToken(token.id, now.toISOString(), token.interrupt_interval_minutes);
      if (!claimed) {
        // Another dispatch run (an overlapping cron tick) already won the
        // atomic claim for this token — not a failure, just a no-op here.
        summary.skippedAlreadyClaimed++;
        continue;
      }

      await sendAndRecord(token, payload, estimate.cardCount, deps, summary, now);
    } catch (e) {
      // Defensive backstop only — every known throwing call in this chain
      // is already caught at its source. If something still slips through,
      // it must cost exactly one token's outcome, never the rest of this
      // invocation's batch.
      console.error(`[ERR-PUSH-DISPATCH-TOKEN-${Date.now()}] unexpected error processing token ${token.id}:`, e);
      summary.erroredUnexpectedly++;
    }
  }

  return summary;
}
