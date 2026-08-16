// ============================================================
// studyDoneScreenProps.ts — Task #612 (Wave 6): computes StudyDoneScreen's derived props
// ============================================================
// Extracted out of app/study/page.tsx's `isDone` branch to keep that route within
// CLAUDE.md's ~150-line route cap — same "extract from this exact file" pattern as
// hooks/useSnoozeAndExit.ts (Task #530) and hooks/useStudyQueueSetup.ts (also Task #612).
// Deliberately a PLAIN function, not a React hook (no "use" prefix, calls no hooks
// internally) — page.tsx's `isDone` branch sits after several earlier conditional early
// returns (hydrated/packLoading, unit-not-found, empty queue), so anything called only
// inside that branch cannot itself be a hook without violating the Rules of Hooks.
// ============================================================
// DEPENDS ON: @/lib/queue (buildQueue), @/content/types
// USED BY: app/study/page.tsx
// ============================================================
import type { Card, Unit } from "@/content/types";
import { buildQueue } from "@/lib/queue";

export interface StudyDoneScreenPropsInput {
  isGlobal: boolean;
  isInterrupt: boolean;
  unit: Unit | null;
  allUnits: Unit[];
  allCards: Card[];
  sessionCorrect: number;
  sessionTotal: number;
  getDueCards: (unitCards: Card[]) => string[];
  getNewCards: (unitCards: Card[], limit?: number) => Card[];
  getIntroductionDueCardIds: (today: string) => string[];
  resetToQueue: (fresh: Card[]) => void;
}

export interface StudyDoneScreenPropsResult {
  pct: number;
  stillDue: number;
  onStudyMore: (() => void) | null;
}

export function computeStudyDoneScreenProps({
  isGlobal,
  isInterrupt,
  unit,
  allUnits,
  allCards,
  sessionCorrect,
  sessionTotal,
  getDueCards,
  getNewCards,
  getIntroductionDueCardIds,
  resetToQueue,
}: StudyDoneScreenPropsInput): StudyDoneScreenPropsResult {
  const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
  const unitCards = isGlobal || isInterrupt ? allUnits.flatMap((u) => u.cards) : unit!.cards;
  const stillDue = getDueCards(unitCards).length;

  // Task #569: disabled for interrupt sessions too, not just global ones. An interrupt
  // session's `allCards` is the full cross-unit catalog, and this rebuild calls
  // buildQueue with globalMode=false (interleaving up to SESSION_NEW_LIMIT new cards)
  // with no INTERRUPT_SESSION_CAP slice applied — unlike the initial queue's own
  // construction (hooks/useStudyQueueSetup.ts), which does slice interrupt queues to
  // the cap. "Study more" doesn't fit an interrupt's own framing anyway (BRAND.md: a
  // short, bounded burst, not an open-ended session) — the fix is to not offer it
  // here, matching every other interrupt-specific cap this route already enforces.
  const onStudyMore = !isGlobal && !isInterrupt
    ? () => resetToQueue(buildQueue(allCards, getDueCards, getNewCards, false, getIntroductionDueCardIds))
    : null;

  return { pct, stillDue, onStudyMore };
}
