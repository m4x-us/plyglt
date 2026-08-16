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
 * functions cannot import from lib/). Mechanically enforced by
 * tests/interruptFloorSync.test.ts, which fails the moment either copy
 * changes without the other being updated to match.
 *
 * Task #624 — that guard is test-suite-only, not a deploy-time one, and
 * this repo has no automated hook that could make it one: as of this
 * writing there is no CI workflow or package.json script that deploys this
 * function (checked .github/workflows/ci.yml, release.yml, and
 * package.json's scripts — none reference `supabase functions deploy` or
 * any Supabase CLI invocation at all). supabase/config.toml's own comment
 * on this function ("hit live on the first real deploy, 2026-08-14")
 * confirms deploys happen by a human running the Supabase CLI directly,
 * outside this repo's CI entirely — there is no build step in that path
 * this project's tooling could hook a pre-deploy check into. If deploys
 * are ever automated into a CI workflow, that workflow should run `npm
 * test` (or at minimum `npx vitest run tests/interruptFloorSync.test.ts`)
 * before invoking `supabase functions deploy`, gating the deploy on it.
 * Until then, this is an accepted, documented risk, not a silent gap: a
 * human deploying this function via the CLI without first running the
 * test suite is the one remaining way these two copies can drift.
 *
 * Body text uses canonical terminology ("ready", never "due"/"overdue") and
 * carries no exclamation mark, per BRAND.md's voice rules.
 */
export const INTERRUPT_SESSION_FLOOR = 6;
export const INTERRUPT_SESSION_CAP = 8;

/**
 * Task #623: Batch 23 (above) deliberately removed the zero-estimate SEND skip — a naive
 * skip on `cardCount === 0` silently dropped real interrupts for the exact "client-only
 * content the server's review-events-only estimate can't see" scenario this whole module
 * exists to serve (client-side introduction-cadence cards, near-due reviews, and
 * flex-introducible new cards are all invisible to `computeDueEstimate`). That fix, however,
 * introduced a real regression of its own: a genuinely, fully caught-up user — zero due
 * anywhere, client included, an expected steady-state outcome of the product working
 * correctly — now receives a recurring, content-free "Cards ready" push every normal
 * `interrupt_interval_minutes` interval indefinitely. That directly contradicts BRAND.md's
 * stress-free/no-pressure principle and is a real notification-fatigue/uninstall risk.
 *
 * The server cannot reliably tell "genuinely nothing anywhere" apart from "nothing synced
 * yet, client will fill it" — so this does NOT reintroduce a skip. Every gated-eligible token
 * still receives its scheduled push (dispatch.ts's `sendAndRecord` is unconditional on
 * estimate), so the client's flex-fill mechanism is never denied a chance to run. Instead,
 * dispatch.ts widens the shared cross-device gate (`interrupt_gate_events.effective_until`,
 * Task #527) for the user's NEXT proactive check-in specifically when THIS send's estimate
 * was zero, using this constant instead of the token's own `interrupt_interval_minutes`. Net
 * effect: a truly caught-up user still gets today's push, but isn't re-pinged again until a
 * full day has passed rather than every interval — "one contentless push per day" instead of
 * "every interval, indefinitely." Documented tradeoff: a user who resumes studying shortly
 * after a zero-estimate push won't receive ANOTHER proactive server nudge until this window
 * elapses, even if they've since accumulated real due content — they can always open the app
 * manually in the meantime, and proactive pushes have always been a best-effort supplement,
 * never the only path to studying (docs/INTERRUPT_ARCHITECTURE.md). This is a flat backoff
 * (every zero-estimate send widens the gate the same amount), not a consecutive-count-aware
 * one — tracking "how many zero-estimate sends in a row" would require new persisted per-user
 * state (a DB column/migration) beyond this module's scope; flagged for a future task if a
 * smarter, consecutive-aware backoff is ever wanted.
 */
export const ZERO_ESTIMATE_GATE_MINUTES = 24 * 60; // 24 hours — "at most once per day"

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
