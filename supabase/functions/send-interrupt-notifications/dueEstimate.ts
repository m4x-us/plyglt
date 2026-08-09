// ============================================================
// dueEstimate.ts — approximates "how many cards are ready" from raw review history (Task #170)
// ============================================================
// DEPENDS ON: ./types.ts
// USED BY: index.ts (via groupReviewEventsByUserId), dispatch.ts (via computeDueEstimate/buildNotificationPayload)
// ============================================================

import type { ReviewEventRow, NotificationPayload } from "./types.ts";

/**
 * Groups a flat PostgREST result into per-user buckets, keyed strictly by
 * each row's own user_id. Extracted as its own tested function (rather than
 * inline glue in index.ts, which has no test coverage at all since it's
 * Deno-only) specifically because the service-role fetch this feeds from
 * bypasses RLS — there is no database-level guard left to catch a keying
 * bug here; a wrong bucket assignment would leak one user's due-card
 * estimate into another user's notification with nothing else to stop it.
 */
export function groupReviewEventsByUserId(rows: readonly ReviewEventRow[]): Map<string, ReviewEventRow[]> {
  const map = new Map<string, ReviewEventRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.user_id);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(row.user_id, [row]);
    }
  }
  return map;
}

/**
 * Approximates "how many cards are ready right now" for one user from their
 * raw review_events history. This is a documented LOWER BOUND, not the true
 * FSRS-scheduled count: real scheduling state (lib/srs.ts, lib/introduction.ts)
 * lives entirely client-side in store/srsStore.ts and is never synced to
 * Supabase — only each review's resulting due_date is. Cards never yet
 * reviewed (including every card still in the client-only introduction-engine
 * cadence) are invisible here and are NOT counted. `events` is expected to
 * already be scoped to one user (see groupReviewEventsByUserId) — the
 * `event.user_id !== userId` guard below is defense in depth, not the
 * primary scoping mechanism.
 */
export function computeDueEstimate(
  events: readonly ReviewEventRow[],
  userId: string,
  now: Date
): { cardCount: number; sessionType: "review" } {
  const latestPerCard = new Map<string, ReviewEventRow>();
  for (const event of events) {
    if (event.user_id !== userId) continue;
    const existing = latestPerCard.get(event.card_id);
    if (!existing || new Date(event.reviewed_at).getTime() > new Date(existing.reviewed_at).getTime()) {
      latestPerCard.set(event.card_id, event);
    }
  }

  let cardCount = 0;
  for (const event of latestPerCard.values()) {
    if (new Date(event.due_date).getTime() <= now.getTime()) cardCount++;
  }
  // sessionType is hardcoded "review" for v1 — distinguishing an
  // introduction-engine "new card" session server-side would require
  // syncing store/srsStore.ts's introductions map, which does not happen
  // today. Fabricating a "new" session type without real data behind it
  // would be dishonest, not just incomplete.
  return { cardCount, sessionType: "review" };
}

/**
 * Returns null when there is nothing to announce — per BRAND.md's "no
 * overdue cards, no pressure" principle, the server never sends a nagging
 * zero-card push. Body text uses canonical terminology ("ready", never
 * "due"/"overdue") and carries no exclamation mark, per BRAND.md's voice
 * rules.
 */
export function buildNotificationPayload(estimate: { cardCount: number; sessionType: "review" }): NotificationPayload | null {
  if (estimate.cardCount === 0) return null;
  const cardWord = estimate.cardCount === 1 ? "card" : "cards";
  return {
    title: "plyglt",
    body: `${estimate.cardCount} ${cardWord} ready`,
    data: { cardCount: estimate.cardCount, sessionType: estimate.sessionType },
  };
}
