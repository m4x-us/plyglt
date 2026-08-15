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
// introduce dozens of new cards. Passed as canIntroduceNewCard's maxPerDay
// (store/srsStore.ts) — that function already counts introductions across
// ALL of today's sessions (the introductions map is persisted, not
// per-session), so this constant alone gives a real cross-session ceiling
// with no store-layer change needed.
export const INTERRUPT_FLEX_DAILY_MAX = INTERRUPT_SESSION_MAX_NEW * 3;

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

  const dueCards = dueIds.map((id) => cardMap[id]).filter((c): c is Card => !!c);

  // Introduction cards sit after all FSRS due reviews but before remaining new cards.
  // Deduplication below handles the case where a card appears in both lists.
  const introCards: Card[] = [];
  if (getIntroductionDueCardIds) {
    const today = localDateStr();
    for (const id of getIntroductionDueCardIds(today)) {
      const c = cardMap[id];
      if (c) introCards.push(c);
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
