// ============================================================
// reviewEvent.ts — pure ReviewEvent type + constructor (no React, no Zustand)
// ============================================================
// A ReviewEvent is one card review, captured at the moment scheduleCard() runs.
// This is the local, pre-sync shape of a row in supabase/migrations/*_review_events.sql —
// append-only, never mutated once created. See docs/SYNC_ARCHITECTURE.md §4 for why
// the sync layer is event-sourced rather than storing mutable per-card rows.
// ============================================================
// DEPENDS ON: lib/srs.ts (Grade, CardProgress)
// USED BY: store/syncStore.ts (enqueueReviewEvent), lib/conflictResolution.ts (replay)
// ============================================================

import type { CardProgress, Grade } from "@/lib/srs";

// FSRS grade → the numeric rating stored server-side (supabase/migrations/*_review_events.sql's
// `rating smallint check (rating between 1 and 4)`). Frozen so no caller can accidentally widen
// the mapping — a 5th grade value would need a matching schema migration, not just a code change.
export const GRADE_TO_RATING: Readonly<Record<Grade, number>> = Object.freeze({
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
});

export interface ReviewEvent {
  id: string; // client-generated (crypto.randomUUID()) — the real dedup key once synced
  cardId: string;
  reviewedAt: number; // unix ms — real review wall-clock time, not sync time
  rating: number; // 1-4, see GRADE_TO_RATING
  stability: number; // resulting FSRS state AFTER this review
  difficulty: number;
  dueDate: number; // unix ms
  deviceId: string; // diagnostic only, never used for conflict logic
}

// Builds a ReviewEvent from the CardProgress scheduleCard() just produced. `now` and `id` are
// injected (not read from Date.now()/crypto.randomUUID() internally) so this stays a pure,
// deterministically testable function — callers supply real values in production.
export function createReviewEvent(
  cardId: string,
  grade: Grade,
  resultingProgress: CardProgress,
  deviceId: string,
  now: number,
  id: string
): ReviewEvent {
  return {
    id,
    cardId,
    reviewedAt: now,
    rating: GRADE_TO_RATING[grade],
    stability: resultingProgress.stability,
    difficulty: resultingProgress.difficulty,
    dueDate: resultingProgress.dueDate,
    deviceId,
  };
}
