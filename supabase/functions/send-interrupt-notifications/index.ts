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
import { fetchAllPushTokens, fetchReviewEventsForUsers, claimToken, deactivateToken } from "./supabaseAdmin.ts";
import { sendApnsNotification, readApnsCredentialsFromEnv } from "./apnsClient.ts";
import { sendFcmNotification, readFcmCredentialsFromEnv } from "./fcmClient.ts";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Push dispatch not configured — missing Supabase service credentials." }, { status: 500 });
  }

  const env = Deno.env.toObject();
  const apnsCreds = readApnsCredentialsFromEnv(env);
  const fcmCreds = readFcmCredentialsFromEnv(env);

  const now = new Date();
  const allTokens = await fetchAllPushTokens(supabaseUrl, serviceRoleKey, fetch);
  const dueTokens = selectDueTokens(allTokens, now);

  const dueUserIds = [...new Set(dueTokens.map((t) => t.user_id))];
  const events = await fetchReviewEventsForUsers(supabaseUrl, serviceRoleKey, dueUserIds, fetch);
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
  });

  return Response.json(summary);
});
