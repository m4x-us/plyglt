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
// Ceiling: 8 cards ≈ the top of the 45-90s window at 8-15s/card. Replaces the
// old app/study/page.tsx INTERRUPT_CARD_LIMIT of 5, which sat BELOW the new
// floor. On a heavy backlog day the session shows 8 and the rest wait for the
// next interrupt — BRAND.md: cards are ready, never overdue; no wall of debt.
export const INTERRUPT_SESSION_CAP = 8;

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
