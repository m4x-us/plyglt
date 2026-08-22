// ============================================================
// useInterruptSessionGrowth.ts — Hook: grows an interrupt session's queue while the user's time budget allows
// ============================================================
// Extracted out of hooks/useStudySession.ts (2026-08-21 owner request) to keep that file
// under CLAUDE.md's 400-line services/hooks cap — that file already has its own extraction
// history for the same reason (Task #630). This hook owns exactly one piece of mutable
// state (the lazily-fetched near-due card pool) and exposes a single pure-shaped function;
// useStudySession.ts's handleRate calls it once per rating.
// ============================================================
// DEPENDS ON: @/lib/queue
// USED BY: hooks/useStudySession.ts
// ============================================================
"use client";

import { useRef } from "react";
import type { Card } from "@/content/types";
import { shouldGrowInterruptSession, selectNextGrowthCard } from "@/lib/queue";

/**
 * Returns a `growQueue` function: given the queue as it stands after this rating, appends
 * one more near-due card if `isInterrupt` is true AND the user's time budget
 * (targetSeconds, measured from sessionStartedAt) hasn't elapsed yet — a no-op (same queue
 * reference returned) for a non-interrupt session or once time is up, safe to compare with
 * `!==` for "did growth happen."
 *
 * getNearDueCards scans+sorts the entire cross-unit catalog (documented cost in
 * useStudySession.ts's runFillPass) — fetched at most ONCE per hook instance (this ref
 * persists across renders of one session, reset naturally on remount), cached, and reused
 * for every later growth trigger, instead of paying that cost on every rating. Same
 * one-shot-snapshot staleness tolerance as runFillPass's own near-due fetch (never
 * re-scanned mid-session either) — accepted for the same reason.
 */
export function useInterruptSessionGrowth(getNearDueCards: (limit: number) => Card[]) {
  const nearDueGrowthPoolRef = useRef<Card[] | null>(null);

  return function growQueue(isInterrupt: boolean, queue: readonly Card[], sessionStartedAt: number, targetSeconds: number): Card[] {
    if (!isInterrupt) return queue as Card[];
    const elapsedMs = Date.now() - sessionStartedAt;
    if (!shouldGrowInterruptSession(elapsedMs, targetSeconds, queue.length)) return queue as Card[];
    if (nearDueGrowthPoolRef.current === null) {
      nearDueGrowthPoolRef.current = getNearDueCards(Number.MAX_SAFE_INTEGER);
    }
    const growthCard = selectNextGrowthCard(queue, nearDueGrowthPoolRef.current);
    return growthCard ? [...queue, growthCard] : (queue as Card[]);
  };
}
