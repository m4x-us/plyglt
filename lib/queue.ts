// ============================================================
// queue.ts — Builds the study queue from due and new cards respecting session limits
// ============================================================
import type { Card, Unit } from "@/content/types";
import { localDateStr } from "@/lib/utils";

const SESSION_NEW_LIMIT = 15;

// ── Interrupt-session content floor (Batch 23, owner-ratified 2026-08-14) ────
// Every proactive interrupt session targets 45-90 seconds of retrieval, which
// at 8-15s/card means a 6-card floor — a 1-card burst spends the attention cost
// of an interruption on almost no learning. When the day's normal supply (FSRS
// due + introduction cadence) falls short, hooks/useStudySession.ts's mount
// effect fills the gap: new-card introductions first (Max's ratified choice —
// starvation is cold-start-shaped, exactly when extra intros are pure ramp-up),
// hard-capped at 3 per session (working memory holds ~4 chunks — Cowan 2001 —
// so more than 3 never-seen items in one burst causes interference), then
// near-due FSRS reviews pulled slightly early. The server mirrors the floor in
// supabase/functions/send-interrupt-notifications/dueEstimate.ts — keep the
// two `6` values in sync.
export const INTERRUPT_SESSION_FLOOR = 6;
export const INTERRUPT_SESSION_MAX_NEW = 3;
// Ceiling: 8 cards at 8-15s/card is 64-120s — the worst case runs up to 30s
// past the 90s target, a deliberate tradeoff (Batch 23, owner-ratified): a
// slightly longer worst-case session beats truncating a heavy backlog day's
// content mid-fill. Replaces the old app/study/page.tsx INTERRUPT_CARD_LIMIT
// of 5, which sat BELOW the new floor. On a heavy backlog day the session
// shows 8 and the rest wait for the next interrupt — BRAND.md: cards are
// ready, never overdue; no wall of debt.
export const INTERRUPT_SESSION_CAP = 8;
// Cross-session daily ceiling for flex-introduced new cards (Task #551): the
// per-session INTERRUPT_SESSION_MAX_NEW (3) cap alone doesn't bound a whole
// day — a persistently-starved catalog (the default state for any brand-new
// user with zero FSRS reviews) could otherwise flex 3 new cards into EVERY
// interrupt session that day with no ceiling, contradicting BRAND.md's "one
// new card introduced per day at steady state" framing for exactly the
// cold-start population this flex path targets first. Set to 3x the
// per-session cap — enough ramp-up room across a 6-10-interrupt day to
// meaningfully refill an empty pipeline without letting one bad day
// introduce dozens of new cards.
//
// Enforced by hooks/useStudySession.ts's mount-fill effect passing this as
// canIntroduceNewCard's maxPerDay (store/srsStore.ts) — that function counts
// introductions across ALL of today's sessions (the introductions map is
// persisted, not per-session), so no store-layer change was needed to make
// the ceiling cross-session. Task #562 (Wave 3) fixed a real gap in HOW that
// call is made: the check must be re-evaluated on every new-card
// introduction, not computed once per session mount and reused — a
// once-per-mount check reads a stale introducedTodayCount for every
// introduction after the first one in the same fill pass, and separately let
// each of several same-day interrupt sessions pass a still-under-ceiling
// check and each be granted a full INTERRUPT_SESSION_MAX_NEW batch,
// overshooting this ceiling by up to INTERRUPT_SESSION_MAX_NEW - 1 cards per
// extra session. The mount effect's fill loop now calls
// `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` as part of the
// while-condition itself, once per iteration, so this constant genuinely
// bounds the running total rather than a stale snapshot of it.
export const INTERRUPT_FLEX_DAILY_MAX = INTERRUPT_SESSION_MAX_NEW * 3;

// ── Time-based session growth (Task, 2026-08-21 owner request) ──────────────
// The 6-card floor above assumes 8-15s/card; a user answering faster than that
// (the common case — most sessions run well under the 45-90s target) hits the
// floor and stops, well short of the time budget. Rather than raising the
// floor to a new fixed number (which then overshoots on a slow/hard day),
// hooks/useStudySession.ts's handleRate now grows the queue by one near-due
// card after each rating, as long as the user's own configured time budget
// (store/settingsStore.ts's sessionTargetSeconds) hasn't elapsed yet. This
// growth cap is a safety backstop only — time is expected to bind first in
// virtually every real session, even at the slider's fastest pace (30s) and
// slowest per-card speed; it exists purely to prevent a pathological case
// (e.g. a clock anomaly) from growing a session unboundedly. Deliberately
// separate from INTERRUPT_SESSION_CAP above, which still governs the
// up-front due-card fill at mount — untouched by this feature.
export const INTERRUPT_SESSION_GROWTH_CAP = 20;

/**
 * Whether hooks/useStudySession.ts's handleRate should pull in one more
 * near-due card after this rating. Pure — no I/O, no Date.now() call (the
 * caller supplies elapsedMs so this stays independently testable with fixed
 * inputs). targetSeconds is the user's own chosen value (settingsStore.ts's
 * SESSION_TARGET_SECONDS_OPTIONS); currentQueueLength is the queue length
 * AFTER this rating's own requeue logic (handleRate's "again" splice), so an
 * at-cap queue never grows past INTERRUPT_SESSION_GROWTH_CAP.
 */
export function shouldGrowInterruptSession(elapsedMs: number, targetSeconds: number, currentQueueLength: number): boolean {
  return elapsedMs < targetSeconds * 1000 && currentQueueLength < INTERRUPT_SESSION_GROWTH_CAP;
}

/**
 * Picks the next near-due card to append when a session is growing (see
 * shouldGrowInterruptSession above) — the first candidate, in the caller's
 * own soonest-due-first order, not already present in the current queue.
 * Returns null when every candidate is already queued (or the pool is
 * empty) — growth simply stops there; not an error, same "floor is a
 * target, not a guarantee" philosophy INTERRUPT_SESSION_FLOOR already uses.
 */
export function selectNextGrowthCard(currentQueue: readonly Card[], nearDueCandidates: readonly Card[]): Card | null {
  const queuedIds = new Set(currentQueue.map((c) => c.id));
  for (const candidate of nearDueCandidates) {
    if (!queuedIds.has(candidate.id)) return candidate;
  }
  return null;
}

export function buildQueue(
  cards: Card[],
  getDueCards: (cards: Card[]) => string[],
  getNewCards: (cards: Card[], limit?: number) => Card[],
  globalMode = false,
  getIntroductionDueCardIds?: (today: string) => string[],
): Card[] {
  const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));
  const dueIds = getDueCards(cards);
  const newCards = globalMode ? [] : getNewCards(cards, SESSION_NEW_LIMIT);

  // A dropped id here (present in the FSRS/introduction stores but absent from the loaded
  // pack) can mean a stale reference surviving a pack update, or a real store/pack mismatch —
  // logged rather than silently vanishing the card, so the latter leaves a trace (Task #585).
  const dueCards = dueIds
    .map((id) => {
      const c = cardMap[id];
      if (!c) {
        console.warn(`[ERR-QUEUE-STALE-DUE-ID-${Date.now()}] getDueCards returned id "${id}" with no matching card in the loaded pack — dropped from queue`);
      }
      return c;
    })
    .filter((c): c is Card => !!c);

  // Introduction cards sit after all FSRS due reviews but before remaining new cards.
  // Deduplication below handles the case where a card appears in both lists.
  const introCards: Card[] = [];
  if (getIntroductionDueCardIds) {
    const today = localDateStr();
    for (const id of getIntroductionDueCardIds(today)) {
      const c = cardMap[id];
      if (c) {
        introCards.push(c);
      } else {
        console.warn(`[ERR-QUEUE-STALE-INTRO-ID-${Date.now()}] getIntroductionDueCardIds returned id "${id}" with no matching card in the loaded pack — dropped from queue`);
      }
    }
  }

  // Interleave new cards among due reviews
  const result: Card[] = [];
  let newIdx = 0;
  for (let i = 0; i < dueCards.length; i++) {
    result.push(dueCards[i]!);
    if (!globalMode && newIdx < newCards.length && (i + 1) % 3 === 0) {
      result.push(newCards[newIdx++]!);
    }
  }
  result.push(...introCards);
  while (newIdx < newCards.length) {
    result.push(newCards[newIdx++]!);
  }

  const seen = new Set<string>();
  return result.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

// Find which unit a card belongs to (for global mode header)
export function findUnitName(cardId: string, units: Unit[]): string {
  for (const unit of units) {
    if (unit.cards.some((c) => c.id === cardId)) return unit.name;
  }
  return "";
}
