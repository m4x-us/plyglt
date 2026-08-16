// ============================================================
// useStudyQueueSetup.ts — Task #612 (Wave 6): computes the initial card set/queue for a study session
// ============================================================
// Extracted out of app/study/page.tsx to keep that route within CLAUDE.md's ~150-line
// route cap — same pattern as hooks/useSnoozeAndExit.ts's earlier extraction from this
// exact file (Task #530). Pure useMemo computation, no JSX: which cards are in scope
// (unit vs. global/interrupt's full catalog), whether this unit's prerequisites are met,
// the resulting initial queue (interrupt-capped), and the id-keyed card map
// hooks/useStudySession.ts needs. A test can import and exercise this hook directly
// without rendering the page — see Task #616 (deferred to Wave 7), which needs exactly
// that for a rewritten app/study/page.test.tsx.
// ============================================================
// DEPENDS ON: @/store/srsStore (unitMasteryPct, MASTERY_GATE), @/lib/queue
// USED BY: app/study/page.tsx
// ============================================================
"use client";

import { useMemo } from "react";
import type { Card, Unit } from "@/content/types";
import type { CardProgress } from "@/lib/srs";
import { unitMasteryPct, MASTERY_GATE } from "@/store/srsStore";
import { buildQueue, INTERRUPT_SESSION_CAP } from "@/lib/queue";

export interface UseStudyQueueSetupParams {
  isGlobal: boolean;
  isInterrupt: boolean;
  unitId: string;
  allUnits: Unit[];
  unitMap: Record<string, Unit>;
  cards: Record<string, CardProgress>;
  getDueCards: (unitCards: Card[]) => string[];
  getNewCards: (unitCards: Card[], limit?: number) => Card[];
  getIntroductionDueCardIds: (today: string) => string[];
}

export interface UseStudyQueueSetupResult {
  allCards: Card[];
  unit: Unit | null;
  initialQueue: Card[];
  allCardMap: Record<string, Card>;
}

export function useStudyQueueSetup({
  isGlobal,
  isInterrupt,
  unitId,
  allUnits,
  unitMap,
  cards,
  getDueCards,
  getNewCards,
  getIntroductionDueCardIds,
}: UseStudyQueueSetupParams): UseStudyQueueSetupResult {
  const allCards = useMemo(
    () => (isGlobal || isInterrupt ? allUnits.flatMap((u) => u.cards) : unitMap[unitId]?.cards ?? []),
    [isGlobal, isInterrupt, unitId, allUnits, unitMap]
  );

  const unit = isGlobal || isInterrupt ? null : (unitMap[unitId] ?? null);

  const prereqsMet = useMemo(() => {
    if (isGlobal || isInterrupt || !unit) return true;
    return unit.prerequisiteUnits.every((uid) => {
      const prereqUnit = unitMap[uid];
      return prereqUnit ? unitMasteryPct(prereqUnit, cards) >= MASTERY_GATE : true;
    });
  }, [isGlobal, isInterrupt, unit, cards, unitMap]);

  const initialQueue = useMemo(() => {
    if (!prereqsMet) return [];
    const full = buildQueue(allCards, getDueCards, getNewCards, isGlobal || isInterrupt, getIntroductionDueCardIds);
    return isInterrupt ? full.slice(0, INTERRUPT_SESSION_CAP) : full;
  }, [isGlobal, isInterrupt, prereqsMet, allCards, getDueCards, getNewCards, getIntroductionDueCardIds]);

  const allCardMap = useMemo(
    () => Object.fromEntries(allCards.map((c) => [c.id, c])),
    [allCards]
  );

  return { allCards, unit, initialQueue, allCardMap };
}
