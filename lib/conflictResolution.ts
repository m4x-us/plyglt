// ============================================================
// conflictResolution.ts — append-only event-log replay (no React, no Zustand)
// ============================================================
// The entire sync merge algorithm, per docs/SYNC_ARCHITECTURE.md §4: two devices
// reviewing the same card before either syncs is not a conflict, it's two real
// events that both happened. Current card state is a derived value — the event
// with the latest reviewedAt for a card. No per-field merge logic exists to get
// subtly wrong, because no field is ever updated in place, only appended.
// ============================================================
// DEPENDS ON: lib/reviewEvent.ts (ReviewEvent)
// USED BY: not yet wired to a live sync client — see Task #169 in .autocode/tasks.md.
//          Will be called once a device downloads the merged remote+local event set,
//          to compute the state to replay back into store/srsStore.ts's `cards` map.
// ============================================================

import type { ReviewEvent } from "@/lib/reviewEvent";

// Deliberately NOT the full lib/srs.ts CardProgress shape: `state` and `retrievability`
// are not part of what syncs (docs/SYNC_ARCHITECTURE.md §2 lists only cardId, stability,
// difficulty, dueDate, lastReview, reviewCount, lapses) because they're continuously
// time-dependent (retrievability decays every moment, not just at review time) rather
// than event-derivable facts. Recomputing a full CardProgress from this is a follow-up
// integration step once real events exist to test it against.
export interface SyncedCardState {
  cardId: string;
  stability: number;
  difficulty: number;
  dueDate: number;
  lastReview: number; // the winning event's reviewedAt
  reviewCount: number; // count(*) for this card across the merged event set
  lapses: number; // count(*) where rating === 1 (again) for this card
}

const AGAIN_RATING = 1;

// Pure — no I/O, no clock reads. Callers pass the full merged (local + remote) event
// set; dedup by `id` is the caller's job (a Set/Map keyed on id, or a server-side
// UNION) since it's a data-fetching concern, not a replay concern.
export function replayLatestEventPerCard(
  events: readonly ReviewEvent[]
): Record<string, SyncedCardState> {
  const byCard = new Map<string, ReviewEvent[]>();
  for (const event of events) {
    const existing = byCard.get(event.cardId);
    if (existing) {
      existing.push(event);
    } else {
      byCard.set(event.cardId, [event]);
    }
  }

  const result: Record<string, SyncedCardState> = {};
  for (const [cardId, cardEvents] of byCard) {
    const latest = cardEvents.reduce((a, b) => (b.reviewedAt > a.reviewedAt ? b : a));
    const reviewCount = cardEvents.length;
    const lapses = cardEvents.filter((e) => e.rating === AGAIN_RATING).length;
    result[cardId] = {
      cardId,
      stability: latest.stability,
      difficulty: latest.difficulty,
      dueDate: latest.dueDate,
      lastReview: latest.reviewedAt,
      reviewCount,
      lapses,
    };
  }
  return result;
}
