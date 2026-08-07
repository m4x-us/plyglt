// ============================================================
// conflictResolution.ts — append-only event-log replay (no React, no Zustand)
// ============================================================
// The entire sync merge algorithm, per docs/SYNC_ARCHITECTURE.md §4: two devices
// reviewing the same card before either syncs is not a conflict, it's two real
// events that both happened. Current card state is a derived value — the event
// with the latest reviewedAt for a card. No per-field merge logic exists to get
// subtly wrong, because no field is ever updated in place, only appended.
// ============================================================
// DEPENDS ON: lib/reviewEvent.ts (ReviewEvent), lib/srs.ts (CardProgress, CardState)
// USED BY: hooks/useSync.ts (Task #517) — replayLatestEventPerCard resolves a
//          downloaded event set to per-card sync state; syncedStateToCardProgress
//          converts that into the shape store/srsStore.ts's `cards` map expects.
// ============================================================

import type { ReviewEvent } from "@/lib/reviewEvent";
import { GRADE_TO_RATING } from "@/lib/reviewEvent";
import type { CardProgress, CardState } from "@/lib/srs";

// Deliberately NOT the full lib/srs.ts CardProgress shape: `retrievability` is not
// part of what syncs (docs/SYNC_ARCHITECTURE.md §2 lists only cardId, stability,
// difficulty, dueDate, lastReview, reviewCount, lapses) because it's continuously
// time-dependent (decays every moment, not just at review time) rather than an
// event-derivable fact. `state` IS included (unlike the original design) — see
// replayLatestEventPerCard's comment for why it has to be computed here, with the
// full per-card event list in hand, rather than guessed later from an aggregate.
export interface SyncedCardState {
  cardId: string;
  stability: number;
  difficulty: number;
  dueDate: number;
  lastReview: number; // the winning event's reviewedAt
  reviewCount: number; // count(*) for this card across the merged event set
  lapses: number; // real lapses only — see the chronological-replay comment below
  rating: number; // the winning event's own rating
  state: CardState;
}

const AGAIN_RATING = GRADE_TO_RATING.again;

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

    // `state` and `lapses` both need to know whether this card had ALREADY graduated
    // out of new/learning before a given "again" rating, not just how many "again"
    // ratings exist in total. lib/srs.ts's scheduleCard() only transitions to "review"
    // on a non-again grade while new/learning, and only counts a lapse — or enters
    // "relearning" — on an again grade AFTER that point (lib/srs.ts:146-171). A naive
    // count(*) of again-ratings (the original version of this function) can't tell
    // "failed twice while still learning" from "lapsed after graduating" — the former
    // is common during the introduction engine's intensive Day 1 phase (BRAND.md:
    // 6-10 exposures, real odds of 2+ consecutive "again" answers before the first
    // success), and misclassifying it as "relearning" sends the NEXT scheduleCard()
    // call down the wrong branch (stabilityAfterForgetting/stabilityAfterRecall
    // instead of a clean learning re-initialization), corrupting stability/difficulty
    // math for that card. Walking the events in real chronological order (reviewedAt,
    // not array position — same ordering signal this function already uses to pick
    // the "latest" event) and tracking graduation as we go fixes both fields with the
    // one pass.
    const chronological = [...cardEvents].sort((a, b) => a.reviewedAt - b.reviewedAt);
    let everGraduated = false;
    let lapses = 0;
    for (const event of chronological) {
      if (event.rating === AGAIN_RATING) {
        if (everGraduated) lapses += 1;
      } else {
        everGraduated = true;
      }
    }

    const state: CardState =
      latest.rating !== AGAIN_RATING ? "review" : everGraduated ? "relearning" : "learning";

    result[cardId] = {
      cardId,
      stability: latest.stability,
      difficulty: latest.difficulty,
      dueDate: latest.dueDate,
      lastReview: latest.reviewedAt,
      reviewCount,
      lapses,
      rating: latest.rating,
      state,
    };
  }
  return result;
}

// Converts a replayed SyncedCardState into the full CardProgress shape
// store/srsStore.ts's `cards` map expects. `retrievability` is deliberately NOT
// reconstructed here (see the SyncedCardState comment above) — it's continuously
// time-dependent and store/srsStore.ts's getProgress()/scheduleCard() path already
// recomputes it fresh from `dueDate`/`stability` on every read, the same as it does
// for any other card. Safe to set to 1 as a placeholder that the next real read
// immediately supersedes. `state` and `lapses` are already correctly derived by
// replayLatestEventPerCard above — this function just carries them through.
export function syncedStateToCardProgress(state: SyncedCardState): CardProgress {
  return {
    cardId: state.cardId,
    state: state.state,
    stability: state.stability,
    difficulty: state.difficulty,
    retrievability: 1,
    dueDate: state.dueDate,
    lapses: state.lapses,
    reps: state.reviewCount,
  };
}
