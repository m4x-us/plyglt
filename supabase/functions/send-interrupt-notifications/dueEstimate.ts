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
 * Batch 23 (owner-ratified 2026-08-14), corrected by Tasks #544/#545/#546/#548
 * (2026-08-15): the client TARGETS an interrupt session of
 * INTERRUPT_SESSION_FLOOR..INTERRUPT_SESSION_CAP cards (lib/queue.ts fills a
 * shortfall with flexed new-card introductions and near-due reviews;
 * app/study/page.tsx caps the queue at INTERRUPT_SESSION_CAP) — this is a
 * target, not an unconditional guarantee in either direction:
 *   - Too few: a fully exhausted catalog, or a paused (stranded) introduction
 *     pipeline, can still deliver a sub-floor session — see
 *     hooks/useStudySession.test.ts, "stops at the catalog's edge without
 *     padding duplicates when supply runs out below the floor".
 *   - Too many: the server-side estimate is a documented lower bound over
 *     synced review_events only (see computeDueEstimate) and is never a
 *     send/no-send gate, but a real backlog above CAP (e.g. a vacation-return
 *     user with 40 ready cards) must not be announced verbatim — the session
 *     the tap opens holds at most CAP cards.
 * buildNotificationPayload below clamps the announced count to this whole
 * range rather than only flooring it.
 *
 * A genuinely zero estimate is handled separately, not just floored: the
 * server cannot tell "will fill via flex-introduction" (the common case for a
 * brand-new Pro signup's first interrupt) apart from "catalog/daily-cap
 * exhausted, truly empty" — claiming "6 cards ready" in either case would be
 * a number the server cannot back. The body instead reads "Cards ready" with
 * no specific count, and `data.cardCount` reports the honest 0.
 *
 * Keep INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP here in sync with
 * lib/queue.ts's INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP (Deno
 * functions cannot import from lib/).
 *
 * Body text uses canonical terminology ("ready", never "due"/"overdue") and
 * carries no exclamation mark, per BRAND.md's voice rules.
 */
export const INTERRUPT_SESSION_FLOOR = 6;
export const INTERRUPT_SESSION_CAP = 8;

export function buildNotificationPayload(estimate: { cardCount: number; sessionType: "review" }): NotificationPayload {
  if (estimate.cardCount === 0) {
    return {
      title: "plyglt",
      body: "Cards ready",
      data: { cardCount: 0, sessionType: estimate.sessionType },
    };
  }
  if (estimate.cardCount < 0) {
    // Not reachable today — computeDueEstimate only ever increments a counter from 0 — but a
    // future upstream bug producing a negative value must leave a trace instead of silently
    // masquerading as a legitimate floor case via the Math.max clamp below.
    console.error(`[ERR-DUE-ESTIMATE-NEGATIVE-${Date.now()}] negative cardCount ${estimate.cardCount} clamped to floor`);
  }
  const announced = Math.min(Math.max(estimate.cardCount, INTERRUPT_SESSION_FLOOR), INTERRUPT_SESSION_CAP);
  return {
    title: "plyglt",
    body: `${announced} cards ready`,
    data: { cardCount: announced, sessionType: estimate.sessionType },
  };
}
