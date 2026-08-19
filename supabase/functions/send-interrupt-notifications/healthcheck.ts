// ============================================================
// healthcheck.ts — dead-man's-switch monitoring for the push dispatch pipeline (Task #656)
// ============================================================
// Tooling decision (documented per Task #656's acceptance criteria): a
// Healthchecks.io-style ping endpoint (https://healthchecks.io, free tier —
// 20 checks, email/Slack/webhook alerting, no credit card required). Chosen
// over (a) Supabase's own log-based alerting, which requires a paid Log
// Drains add-on plus a downstream processor just to notice "this function
// returned 5xx" — more standing infra than a one-person team needs; and
// (b) a custom GitHub Actions cron health-check, which reinvents a
// dead-man's-switch that already exists for free and adds its own
// reliability caveats (scheduled workflow runs can slip by up to ~30min).
// Healthchecks.io's own missed-ping detection (configure the check's period
// to match the pg_cron schedule, ~5min, with a grace window) covers "the
// pg_cron job failed to fire on schedule" with zero code here — this module
// only needs to ping success/fail on every invocation that DOES run.
//
// Deliberately provider-agnostic at the call site: readHealthcheckUrlFromEnv
// returns null when unset, and pingHealthcheck no-ops on a null url — same
// graceful-degradation contract as apnsClient.ts/fcmClient.ts's credential
// readers, so this is safe to deploy before Max provisions a Healthchecks.io
// account (an owner action — signing up for an external service is not
// something this module does on its own).
// ============================================================
// DEPENDS ON: ./types.ts
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

import type { DispatchSummary } from "./types.ts";

export type HealthcheckOutcome = "success" | "fail";

/**
 * Reads the optional ping URL from env. Absent/empty → null, meaning
 * "monitoring not configured" — never a hard error, matching this
 * directory's existing readXCredentialsFromEnv contract.
 */
export function readHealthcheckUrlFromEnv(env: Record<string, string | undefined>): string | null {
  const url = env.HEALTHCHECK_PING_URL;
  return url && url.length > 0 ? url : null;
}

/**
 * Decides whether a completed dispatch run counts as healthy, from the
 * DispatchSummary alone — pure, no I/O, independently testable.
 *
 * "Attempted" excludes skippedAlreadyClaimed (another dispatch run already
 * won the claim for that token — not this run's outcome to report on) and
 * skippedNotConfigured (APNs/FCM genuinely absent for this deployment, a
 * normal ops state, not a failure). Fires "fail" when nothing succeeded
 * among genuine attempts AND at least one of them was a real failure —
 * failed (transient send failures, including a credential-auth rejection
 * from the provider, which lands here rather than in `deactivated`; see
 * apnsClient.ts/fcmClient.ts's permanentFailure contract) or
 * erroredUnexpectedly (an exception anywhere in the per-token pipeline,
 * dispatch.ts's own defensive backstop). A batch where every token was
 * simply a dead device (all `deactivated`, zero `failed`/`erroredUnexpectedly`)
 * is healthy, not a failure — that's the deactivation path working as
 * designed, not a credential problem.
 *
 * A run with nothing to send (total === 0 — no due tokens this tick), or
 * where every token was a benign skip, is healthy: an empty or all-skipped
 * tick is the normal, common case.
 */
export function decideHealthcheckOutcome(summary: DispatchSummary): { outcome: HealthcheckOutcome; detail?: string } {
  const attempted = summary.total - summary.skippedAlreadyClaimed - summary.skippedNotConfigured;
  const failureCount = summary.failed + summary.erroredUnexpectedly;
  const allAttemptsFailed = attempted > 0 && summary.sent === 0 && failureCount > 0;
  if (allAttemptsFailed) {
    return {
      outcome: "fail",
      detail:
        `total dispatch failure: 0/${attempted} sent, ${failureCount} failed/errored ` +
        `(${summary.deactivated} deactivated as dead tokens, ${summary.skippedAlreadyClaimed} skipped-already-claimed, ` +
        `${summary.skippedNotConfigured} skipped-not-configured) — check APNs/FCM credential validity`,
    };
  }
  return { outcome: "success" };
}

/**
 * Pings the configured Healthchecks.io-style endpoint. Never throws — a
 * monitoring call must never be able to crash or block the real dispatch
 * response; failures are logged with a ref ID and swallowed, same contract
 * as every other external-gateway call in this directory (APNs/FCM/Supabase
 * admin calls all degrade the same way).
 *
 * No-ops silently when url is null (monitoring not configured yet).
 */
export async function pingHealthcheck(
  url: string | null,
  outcome: HealthcheckOutcome,
  detail: string | undefined,
  fetchImpl: typeof fetch
): Promise<void> {
  if (!url) return;

  const target = outcome === "success" ? url : `${url}/fail`;
  try {
    const response = await fetchImpl(target, { method: "POST", body: detail ?? "" });
    // A resolved fetch with a non-2xx status (bad ping URL, Healthchecks.io
    // itself down, wrong/deleted check id) is not a thrown exception — the
    // try/catch below never sees it. Left unchecked, this silently drops the
    // ping with zero logging, exactly the "monitoring itself fails silently"
    // outcome this module exists to prevent.
    if (!response.ok) {
      console.error(`[ERR-HEALTHCHECK-PING-${Date.now()}] ${outcome} ping to healthcheck endpoint returned HTTP ${response.status}`);
    }
  } catch (e) {
    console.error(`[ERR-HEALTHCHECK-PING-${Date.now()}] failed to ping ${outcome} healthcheck:`, e);
  }
}
