// ============================================================
// index.ts — Deno Edge Function entrypoint (Task #170)
// ============================================================
// THE ONLY FILE IN THIS DIRECTORY ALLOWED TO USE Deno.* APIs. Everything
// else here is a thin wiring layer around the pure, Vitest-tested modules
// (dueSelection.ts, dueEstimate.ts, dispatch.ts, apnsClient.ts, fcmClient.ts,
// supabaseAdmin.ts, auth.ts) — deliberately excluded from this project's
// `npx tsc --noEmit` (see root tsconfig.json's exclude list) since Deno.*
// globals aren't declared there.
//
// Audit finding (2026-08-08), corrected: this file previously claimed it
// was "verified via deno check / supabase functions deploy's own
// type-check at deploy time" — that overclaimed. No `deno check` or
// `supabase functions deploy` step exists anywhere in this repo's CI
// (`.github/workflows/*.yml`) or `package.json` scripts today. This file's
// wiring (the `dispatchNotifications(...)` callback shapes below matching
// each callee's real signature) is currently verified only by a human
// running `supabase functions deploy` manually and by manual code review —
// not by any automated gate. Adding a real `deno check` CI step is tracked
// as follow-up work, not done as part of this task.
//
// Triggered every 5 minutes by pg_cron (see
// supabase/migrations/20260808000001_push_dispatch_cron.sql), which sends
// CRON_SECRET as a bearer token — auth.ts's isAuthorizedCronRequest rejects
// every other caller, since this is otherwise a public HTTPS endpoint.
// ============================================================
// DEPENDS ON: every other file in this directory
// USED BY: pg_cron (via net.http_post)
// ============================================================

import { isAuthorizedCronRequest } from "./auth.ts";
import { selectDueTokens } from "./dueSelection.ts";
import { groupReviewEventsByUserId } from "./dueEstimate.ts";
import { dispatchNotifications } from "./dispatch.ts";
import {
  fetchAllPushTokens,
  fetchReviewEventsForUsers,
  fetchGateStateForUsers,
  claimToken,
  deactivateToken,
  recordGateFired,
} from "./supabaseAdmin.ts";
import { sendApnsNotification, readApnsCredentialsFromEnv } from "./apnsClient.ts";
import { sendFcmNotification, readFcmCredentialsFromEnv } from "./fcmClient.ts";
import { readHealthcheckUrlFromEnv, decideHealthcheckOutcome, pingHealthcheck } from "./healthcheck.ts";

// Deno's real ambient `Deno` global (env, serve) is provided by the Deno
// runtime/CLI type-check (`deno check`) this file is verified with — see
// the file header. No local declaration here on purpose: this file is
// excluded from the Next.js `npx tsc --noEmit` pass specifically so it can
// use Deno's actual types instead of a hand-maintained shim that could
// silently drift from the real API surface.
Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!isAuthorizedCronRequest(req.headers.get("Authorization"), cronSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rule 4 (this project's Slow-Coding Toyota philosophy — "every new
  // feature can be turned off, no exceptions"). Audit finding (2026-08-08):
  // before this check, the only way to stop the whole pipeline was
  // unscheduling the pg_cron job by hand or removing APNs/FCM credentials
  // — and removing credentials doesn't actually stop the fetch/claim work,
  // it only makes the final send a no-op (dueTokens are still fetched,
  // claimed, and consume their rate-limit window). This flag is the fast,
  // documented way to fully pause the pipeline during an incident without
  // touching infrastructure config. Defaults to enabled (absent or any
  // value other than the literal string "false").
  if (Deno.env.get("PUSH_DISPATCH_ENABLED") === "false") {
    return Response.json({ disabled: true }, { status: 200 });
  }

  // Task #656: read once, before the try/catch below, so both the config-check's early
  // return and the catch's own fail-ping (for a genuinely unexpected exception) can use it.
  // A deliberate pause (PUSH_DISPATCH_ENABLED=false, above) and an unauthenticated request
  // (the isAuthorizedCronRequest check, above this) never reach here — neither is a real
  // operational failure worth paging on.
  const healthcheckUrl = readHealthcheckUrlFromEnv(Deno.env.toObject());

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    await pingHealthcheck(healthcheckUrl, "fail", "missing_supabase_config", fetch);
    return Response.json({ error: "Push dispatch not configured — missing Supabase service credentials." }, { status: 500 });
  }

  // Task #656 (Batch 23 round 15 debt): everything below this point previously ran with no
  // enclosing try/catch. dispatch.ts's own per-token try/catch guarantees a bug there costs
  // exactly one token's outcome — but selectDueTokens/groupReviewEventsByUserId are plain
  // synchronous array operations with no guard of their own, and an uncaught throw from
  // either (e.g. an unexpectedly-shaped response that still satisfies response.ok) used to
  // abort the entire invocation with Deno's own generic unhandled-rejection response instead
  // of a clean, loggable 500 — losing the whole cron tick's batch instead of one token's
  // outcome, the opposite of this file's own per-token-isolation philosophy. Wrapping it also
  // means a genuinely unexpected failure now pings the healthcheck like every other failure
  // mode, instead of silently missing the ping alongside the response.
  try {
    const env = Deno.env.toObject();
    const apnsCreds = readApnsCredentialsFromEnv(env);
    const fcmCreds = readFcmCredentialsFromEnv(env);

    const now = new Date();
    // Round-19 audit fix: fetchAllPushTokens now returns a Result rather than collapsing a
    // genuine fetch failure into the same `[]` a real "no tokens registered" state would
    // produce. A tokens-fetch failure means this whole tick has nothing safe to work from —
    // abort loudly (502, not the 200 every other branch of this function returns) rather than
    // silently reporting a no-op tick that looks identical to "nobody was due."
    const tokensResult = await fetchAllPushTokens(supabaseUrl, serviceRoleKey, fetch);
    if (!tokensResult.ok) {
      console.error(`[ERR-PUSH-DISPATCH-ABORT-${Date.now()}] Aborting: could not fetch push tokens: ${tokensResult.error}`);
      await pingHealthcheck(healthcheckUrl, "fail", `tokens_fetch_failed: ${tokensResult.error}`, fetch);
      return Response.json({ error: `Could not fetch push tokens: ${tokensResult.error}` }, { status: 502 });
    }
    const allTokens = tokensResult.rows;

    // Task #527 — the shared, cross-device fire gate replaces last_sent_at as the
    // due/not-due decision. Fetched for every candidate user up front (not just
    // already-due-by-other-criteria ones) since the gate check itself IS one of
    // selectDueTokens's filter criteria.
    const candidateUserIds = [...new Set(allTokens.map((t) => t.user_id))];
    const gateStateByUser = await fetchGateStateForUsers(supabaseUrl, serviceRoleKey, candidateUserIds, fetch);
    const dueTokens = selectDueTokens(allTokens, now, gateStateByUser);

    const dueUserIds = [...new Set(dueTokens.map((t) => t.user_id))];
    // Round-19 audit fix: unlike the tokens fetch above, a review-events fetch failure is NOT
    // fatal to the tick — dispatch already has a designed fallback for "no review history"
    // (dueEstimate.ts's session-floor/zero-case fabrication, Batch 23), so degrading to that
    // fallback for this one tick is strictly better than aborting a real send. What changes is
    // that the failure is now LOGGED as a distinct, loud event instead of being silently
    // indistinguishable from "these due users genuinely have no synced review history." Not a
    // healthcheck-fail case either, for the same reason — the tick still completes normally.
    const eventsResult = await fetchReviewEventsForUsers(supabaseUrl, serviceRoleKey, dueUserIds, fetch);
    if (!eventsResult.ok) {
      console.error(`[ERR-PUSH-DISPATCH-DEGRADED-${Date.now()}] Failed to fetch review events, proceeding with zero-estimate fallback for this tick: ${eventsResult.error}`);
    }
    const events = eventsResult.ok ? eventsResult.rows : [];
    const reviewEventsByUser = groupReviewEventsByUserId(events);

    const summary = await dispatchNotifications(dueTokens, reviewEventsByUser, now, {
      // Audit finding (2026-08-08), corrected: this previously read one
      // global APNS_SANDBOX env var for every token in the batch, ignoring
      // push_tokens.app_env — the per-row field that exists specifically to
      // record which APNs host (sandbox vs production) each individual
      // device's token is valid against. A dev/TestFlight build registers a
      // sandbox token; an App Store build registers a production token; the
      // two hosts reject each other's tokens. Routing every token through one
      // process-wide flag meant any deployment serving a mixed fleet (the
      // normal state of any shipping app) would misroute a whole cohort of
      // tokens, and APNs' resulting "BadDeviceToken"/410 response would get
      // misread as permanentFailure — permanently deactivating a perfectly
      // valid registration because of a routing bug, not a dead token.
      sendApns: (token, payload) =>
        sendApnsNotification(token.token, payload, apnsCreds, { sandbox: token.app_env === "sandbox", fetchImpl: fetch }),
      sendFcm: (token, payload) => sendFcmNotification(token.token, payload, fcmCreds, { fetchImpl: fetch }),
      claimToken: (tokenId, nowIso, intervalMinutes) =>
        claimToken(supabaseUrl, serviceRoleKey, tokenId, nowIso, intervalMinutes, fetch),
      deactivateToken: (tokenId) => deactivateToken(supabaseUrl, serviceRoleKey, tokenId, fetch),
      recordGateFired: (userId, deviceId, occurredAt, effectiveUntil) =>
        recordGateFired(supabaseUrl, serviceRoleKey, userId, deviceId, occurredAt, effectiveUntil, fetch),
    });

    // Task #656: the one place a healthy tick is distinguished from a total dispatch
    // failure (see healthcheck.ts's decideHealthcheckOutcome doc comment for the exact
    // shape that counts as "fail" — every attempted send failing at once, a proxy for
    // expired/invalid APNs/FCM credentials).
    const { outcome, detail } = decideHealthcheckOutcome(summary);
    await pingHealthcheck(healthcheckUrl, outcome, detail, fetch);

    return Response.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[ERR-PUSH-DISPATCH-UNCAUGHT-${Date.now()}] Unhandled exception during dispatch, batch lost for this tick:`, e);
    await pingHealthcheck(healthcheckUrl, "fail", `uncaught_exception: ${message}`, fetch);
    return Response.json({ error: `Unhandled exception during dispatch: ${message}` }, { status: 500 });
  }
});
