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

import type { PushTokenRow, ReviewEventRow } from "./types.ts";

function authHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "content-type": "application/json",
  };
}

export async function fetchAllPushTokens(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch
): Promise<PushTokenRow[]> {
  try {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/push_tokens?select=*&deactivated_at=is.null`, {
      headers: authHeaders(serviceRoleKey),
    });
    if (!response.ok) {
      console.error(`[ERR-PUSH-FETCH-TOKENS-${Date.now()}] fetchAllPushTokens failed: HTTP ${response.status}`);
      return [];
    }
    return (await response.json()) as PushTokenRow[];
  } catch (e) {
    console.error(`[ERR-PUSH-FETCH-TOKENS-${Date.now()}] fetchAllPushTokens failed:`, e);
    return [];
  }
}

/** Scoped to exactly the given user ids — never fetches every user's review history. */
export async function fetchReviewEventsForUsers(
  supabaseUrl: string,
  serviceRoleKey: string,
  userIds: readonly string[],
  fetchImpl: typeof fetch
): Promise<ReviewEventRow[]> {
  if (userIds.length === 0) return [];
  const idList = userIds.map((id) => `"${id}"`).join(",");
  try {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/review_events?select=card_id,user_id,reviewed_at,due_date&user_id=in.(${idList})`,
      { headers: authHeaders(serviceRoleKey) }
    );
    if (!response.ok) {
      console.error(`[ERR-PUSH-FETCH-EVENTS-${Date.now()}] fetchReviewEventsForUsers failed: HTTP ${response.status}`);
      return [];
    }
    return (await response.json()) as ReviewEventRow[];
  } catch (e) {
    console.error(`[ERR-PUSH-FETCH-EVENTS-${Date.now()}] fetchReviewEventsForUsers failed:`, e);
    return [];
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
