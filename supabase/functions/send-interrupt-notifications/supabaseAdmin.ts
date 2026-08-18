// ============================================================
// supabaseAdmin.ts — service-role PostgREST reads/writes for push dispatch (Task #170)
// ============================================================
// Plain fetch against PostgREST rather than @supabase/supabase-js — keeps
// this Deno-deployed function on the same "HTTP client, injectable fetch"
// shape as apnsClient.ts/fcmClient.ts instead of pulling in a second SDK.
// Every call here authenticates with the Supabase SERVICE ROLE key, which
// bypasses Row Level Security entirely — this is the one place in the whole
// system that can read across every user's rows at once, by design.
//
// Every exported function here wraps its `fetchImpl` call in try/catch.
// Audit finding (2026-08-08): the original version only handled a resolved
// non-ok Response (`!response.ok`) — an actual network exception (timeout,
// DNS failure, connection reset) from `fetchImpl` itself was uncaught,
// contradicting each function's own "never throws" contract (the same
// contract apnsClient.ts/fcmClient.ts's send functions already honor) and
// able to abort the entire dispatch loop in dispatch.ts if it reached there
// uncaught.
// ============================================================
// DEPENDS ON: ./types.ts
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

import type { PushTokenRow, ReviewEventRow, InterruptGateEventRow } from "./types.ts";

function authHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "content-type": "application/json",
  };
}

// Round-19 audit fix (re-triaged debt from the 2026-08-08 Task #170 audit, originally
// deferred as "not reachable — no production caller writes rows yet"; that precondition
// is no longer true as of Task #522's 2026-08-14 live push launch): fetchAllPushTokens and
// fetchReviewEventsForUsers used to collapse a genuine request failure and "the request
// genuinely found zero rows" into the identical `[]` return value — an outage during a
// cron tick was indistinguishable from "nobody has data" anywhere downstream, and index.ts
// still returned HTTP 200 either way. FetchResult makes that distinction real without
// requiring every caller to change: `.ok` must be checked, and TypeScript won't let `.rows`
// be read without it.
export type FetchResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

export async function fetchAllPushTokens(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch
): Promise<FetchResult<PushTokenRow>> {
  try {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/push_tokens?select=*&deactivated_at=is.null`, {
      headers: authHeaders(serviceRoleKey),
    });
    if (!response.ok) {
      const error = `HTTP ${response.status}`;
      console.error(`[ERR-PUSH-FETCH-TOKENS-${Date.now()}] fetchAllPushTokens failed: ${error}`);
      return { ok: false, error };
    }
    return { ok: true, rows: (await response.json()) as PushTokenRow[] };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[ERR-PUSH-FETCH-TOKENS-${Date.now()}] fetchAllPushTokens failed:`, e);
    return { ok: false, error };
  }
}

/** Scoped to exactly the given user ids — never fetches every user's review history. */
export async function fetchReviewEventsForUsers(
  supabaseUrl: string,
  serviceRoleKey: string,
  userIds: readonly string[],
  fetchImpl: typeof fetch
): Promise<FetchResult<ReviewEventRow>> {
  if (userIds.length === 0) return { ok: true, rows: [] };
  const idList = userIds.map((id) => `"${id}"`).join(",");
  try {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/review_events?select=card_id,user_id,reviewed_at,due_date&user_id=in.(${idList})`,
      { headers: authHeaders(serviceRoleKey) }
    );
    if (!response.ok) {
      const error = `HTTP ${response.status}`;
      console.error(`[ERR-PUSH-FETCH-EVENTS-${Date.now()}] fetchReviewEventsForUsers failed: ${error}`);
      return { ok: false, error };
    }
    return { ok: true, rows: (await response.json()) as ReviewEventRow[] };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[ERR-PUSH-FETCH-EVENTS-${Date.now()}] fetchReviewEventsForUsers failed:`, e);
    return { ok: false, error };
  }
}

/**
 * Task #527 — reads the shared, cross-device fire gate (interrupt_gate_events,
 * Task #525) for exactly the given user ids, reduced to each user's most recent
 * `effective_until`. Ordered `effective_until.desc` so the FIRST row seen per user
 * in the response is already that user's max — no client-side aggregation beyond a
 * single pass. Absence of a user in the returned Map means "no gate row at all
 * (never fired/snoozed)" — callers must treat that as due, not as an error.
 *
 * On a failed request this also returns an empty Map — indistinguishable, at this
 * layer, from "no user in the batch has ever fired." That fails OPEN (every
 * candidate reads as due) rather than closed, unlike this file's other read
 * (fetchReviewEventsForUsers, whose empty-array failure mode fails closed as a side
 * effect of computeDueEstimate treating zero events as zero due cards). Accepted
 * deliberately: the atomic per-token claimToken() PATCH below is the pipeline's real
 * send-authorizing gate and is unaffected by this function — a genuine Supabase
 * outage overwhelmingly fails that PATCH too (same database), so this fail-open
 * default does not translate into an actual mass-send in the failure case that
 * matters. See Task #527 completion notes for the full reasoning.
 */
export async function fetchGateStateForUsers(
  supabaseUrl: string,
  serviceRoleKey: string,
  userIds: readonly string[],
  fetchImpl: typeof fetch
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const idList = userIds.map((id) => `"${id}"`).join(",");
  try {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/interrupt_gate_events?select=user_id,effective_until&user_id=in.(${idList})&order=effective_until.desc`,
      { headers: authHeaders(serviceRoleKey) }
    );
    if (!response.ok) {
      console.error(`[ERR-PUSH-FETCH-GATE-${Date.now()}] fetchGateStateForUsers failed: HTTP ${response.status}`);
      return new Map();
    }
    const rows = (await response.json()) as Pick<InterruptGateEventRow, "user_id" | "effective_until">[];
    const result = new Map<string, string>();
    for (const row of rows) {
      if (!result.has(row.user_id)) result.set(row.user_id, row.effective_until);
    }
    return result;
  } catch (e) {
    console.error(`[ERR-PUSH-FETCH-GATE-${Date.now()}] fetchGateStateForUsers failed:`, e);
    return new Map();
  }
}

/**
 * Atomically claims a token for sending: PATCHes last_sent_at, scoped by a
 * WHERE clause requiring last_sent_at to still be null or past the token's
 * own interrupt_interval_minutes cutoff AT THE MOMENT POSTGRES EXECUTES THE
 * UPDATE — not as of whenever this process last read the row.
 *
 * This is the real concurrency-safety boundary for the whole dispatch
 * pipeline. Two overlapping dispatch runs (e.g. two pg_cron ticks whose
 * invocations overlap because a prior run is still in flight) can both pass
 * a token through dueSelection.ts's coarse in-memory filter using a stale
 * snapshot — but Postgres serializes concurrent UPDATEs to the same row, so
 * only ONE of the two PATCH requests' WHERE clauses can still match by the
 * time it actually runs. `Prefer: return=representation` makes the response
 * body itself the proof: a claim that won returns the updated row; a claim
 * that lost the race returns an empty array, because by the time its own
 * WHERE clause was evaluated, the other request's UPDATE had already moved
 * last_sent_at past the cutoff.
 */
export async function claimToken(
  supabaseUrl: string,
  serviceRoleKey: string,
  tokenId: string,
  nowIso: string,
  intervalMinutes: number,
  fetchImpl: typeof fetch
): Promise<boolean> {
  const cutoff = new Date(new Date(nowIso).getTime() - intervalMinutes * 60_000).toISOString();
  try {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/push_tokens?id=eq.${tokenId}&or=(last_sent_at.is.null,last_sent_at.lte.${cutoff})`,
      {
        method: "PATCH",
        headers: { ...authHeaders(serviceRoleKey), prefer: "return=representation" },
        body: JSON.stringify({ last_sent_at: nowIso }),
      }
    );
    if (!response.ok) {
      console.error(`[ERR-PUSH-CLAIM-${Date.now()}] claimToken failed for ${tokenId}: HTTP ${response.status}`);
      return false;
    }
    const rows = (await response.json()) as unknown[];
    return rows.length > 0;
  } catch (e) {
    console.error(`[ERR-PUSH-CLAIM-${Date.now()}] claimToken failed for ${tokenId}:`, e);
    return false;
  }
}

/**
 * Task #527 — records a `fired` row in the shared, cross-device gate
 * (interrupt_gate_events) after a real send. `effectiveUntil` is the caller's
 * responsibility to compute (dispatch.ts does this — `occurredAt +
 * token.interrupt_interval_minutes`) since this function is a dumb write, matching
 * this file's existing pattern of pure IO with all timing logic decided by its caller.
 * Never throws (same "always resolves, never propagates" contract as every other
 * function in this module) — a failed write here does not undo or downgrade an
 * already-successful send; the caller only logs it as a distinct concern.
 */
export async function recordGateFired(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  deviceId: string,
  occurredAt: string,
  effectiveUntil: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/interrupt_gate_events`, {
      method: "POST",
      headers: authHeaders(serviceRoleKey),
      body: JSON.stringify({
        user_id: userId,
        event_type: "fired",
        occurred_at: occurredAt,
        effective_until: effectiveUntil,
        device_id: deviceId,
      }),
    });
    if (!response.ok) {
      console.error(`[ERR-PUSH-GATE-RECORD-${Date.now()}] recordGateFired failed for user ${userId}: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[ERR-PUSH-GATE-RECORD-${Date.now()}] recordGateFired failed for user ${userId}:`, e);
    return false;
  }
}

/** Marks a token permanently dead (APNs 410 / FCM UNREGISTERED). Never deleted — keeps the send-history audit trail. */
export async function deactivateToken(
  supabaseUrl: string,
  serviceRoleKey: string,
  tokenId: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/push_tokens?id=eq.${tokenId}`, {
      method: "PATCH",
      headers: authHeaders(serviceRoleKey),
      body: JSON.stringify({ deactivated_at: new Date().toISOString() }),
    });
    if (!response.ok) {
      console.error(`[ERR-PUSH-DEACTIVATE-${Date.now()}] deactivateToken failed for ${tokenId}: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[ERR-PUSH-DEACTIVATE-${Date.now()}] deactivateToken failed for ${tokenId}:`, e);
    return false;
  }
}
