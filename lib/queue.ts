import type { Card, Unit } from "@/content/types";

const SESSION_NEW_LIMIT = 15;

export function buildQueue(
  cards: Card[],
  getDueCards: (cards: Card[]) => string[],
  getNewCards: (cards: Card[], limit?: number) => Card[],
  globalMode = false
): Card[] {
  const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));
  const dueIds = getDueCards(cards);
  const newCards = globalMode ? [] : getNewCards(cards, SESSION_NEW_LIMIT);

  const dueCards = dueIds.map((id) => cardMap[id]).filter((c): c is Card => !!c);

  // Interleave new cards among due reviews
  const result: Card[] = [];
  let newIdx = 0;
  for (let i = 0; i < dueCards.length; i++) {
    result.push(dueCards[i]!);
    if (!globalMode && newIdx < newCards.length && (i + 1) % 3 === 0) {
      result.push(newCards[newIdx++]!);
    }
  }
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
