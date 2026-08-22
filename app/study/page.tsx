// ============================================================
// page.tsx — Study page: spaced repetition review queue for a unit or global session
// ============================================================
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useSRSStore, localDateStr } from "@/store/srsStore";
import { useLangPack } from "@/hooks/useLangPack";
import { useSettingsStore } from "@/store/settingsStore";
import { useSyncStore } from "@/store/syncStore";
import { useIsHydrated, useIsHydratedStrict } from "@/lib/storage";
import StudyCard from "@/components/StudyCard";
import StudyDoneScreen from "@/components/StudyDoneScreen";
import StudyResumePrompt from "@/components/StudyResumePrompt";
import StudyEmptyQueue from "@/components/StudyEmptyQueue";
import StudyHydrationStuck from "@/components/StudyHydrationStuck";
import StudyUnitNotFound from "@/components/StudyUnitNotFound";
import StudyHeader from "@/components/StudyHeader";
import { exitMandatoryMode } from "@/lib/tauriInterrupt";
import { findUnitName, INTERRUPT_SESSION_CAP } from "@/lib/queue";
import { useStudySession } from "@/hooks/useStudySession";
import { useStudyQueueSetup } from "@/hooks/useStudyQueueSetup";
import { computeStudyDoneScreenProps } from "@/hooks/studyDoneScreenProps";
import { useSnoozeAndExit } from "@/hooks/useSnoozeAndExit";
import { useSync } from "@/hooks/useSync";
import { useHydrationStuck } from "@/hooks/useHydrationStuck";

function StudyInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const unitId = searchParams.get("unit") ?? "";
  // Task #595: `mode` (isInterrupt/isGlobal below) has no entitlement/Pro gate —
  // intentional (CLAUDE.md §5's client-only honor-system model), not a gap.
  const mode = searchParams.get("mode");
  const isGlobal = mode === "global";
  const isInterrupt = mode === "interrupt";

  const { getDueCards, getNewCards, getNearDueCards, commitSession, cards, clearActiveSession, getResumableSession, peekResumableSession, clearExpiredResumableSession, recordIntroductionResult, introductions, getIntroductionDueCardIds, canIntroduceNewCard, introduceCard } = useSRSStore();
  const enqueueReviewEventRaw = useSyncStore((s) => s.enqueueReviewEvent);
  const { triggerSyncSoon } = useSync();
  // Task #518: nudges a sync soon after every review instead of waiting for the periodic timer.
  const enqueueReviewEvent: typeof enqueueReviewEventRaw = (...args) => { enqueueReviewEventRaw(...args); triggerSyncSoon(); };
  const snoozeMinutes = useSettingsStore((s) => s.snoozeMinutes);
  const sessionTargetSeconds = useSettingsStore((s) => s.sessionTargetSeconds);
  const handleSnooze = useSnoozeAndExit(snoozeMinutes);
  const { units: ALL_UNITS, unitMap: UNIT_MAP, lang, loading: packLoading } = useLangPack();

  // Task #612: card-scope/queue computation extracted to hooks/useStudyQueueSetup.ts (line-cap).
  const { allCards, unit, initialQueue, allCardMap } = useStudyQueueSetup({
    isGlobal, isInterrupt, unitId, allUnits: ALL_UNITS, unitMap: UNIT_MAP, cards,
    getDueCards, getNewCards, getIntroductionDueCardIds,
  });

  // Task #542/#583/#620: scans+sorts allCards once per mount — see useStudySession.ts.
  const { queue, pos, sessionCorrect, sessionTotal, resumeDecision, setResumeDecision, handleRate, resetToQueue } =
    useStudySession({ initialQueue, allCardMap, isGlobal, isInterrupt, unitId, sessionTargetSeconds, getResumableSession, peekResumableSession, clearExpiredResumableSession, clearActiveSession, commitSession, canIntroduceNewCard, introduceCard, getNearDueCards: (limit) => getNearDueCards(allCards, limit), cards, introductions, enqueueReviewEvent });

  // Task #628: `hydratedStrict` (never resolves via HYDRATION_FAILSAFE_MS,
  // unlike lenient `hydrated`) gates real writes past this screen.
  const hydrated = useIsHydrated(useSRSStore);
  const hydratedStrict = useIsHydratedStrict(useSRSStore);
  const stillLoading = !hydrated || packLoading || !hydratedStrict;
  // Task #644: bounded retry escape hatch — hooks/useHydrationStuck.ts — fed the
  // SAME composite condition the gate checks (round-7 fix; a version scoped to
  // hydratedStrict alone missed a stuck packLoading). Never bypasses the gate.
  const hydrationStuck = useHydrationStuck(stillLoading);
  if (stillLoading) {
    if (hydrationStuck) return <StudyHydrationStuck />;
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Loading…</div>;
  }
  if (!isGlobal && !isInterrupt && !unit) return <StudyUnitNotFound mode={mode} unitId={unitId} onHome={() => router.push("/learn")} />;

  // Round-7 fix: checked BEFORE the empty-queue check — the mount-fill effect
  // skips filling while pending (Task #629), so a caught-up day can have an
  // empty queue AND a pending resume at once; the old order hid this prompt.
  if (resumeDecision === "pending") {
    // Task #608: peekResumableSession is the render-phase-safe read.
    const saved = peekResumableSession();
    return (
      <StudyResumePrompt
        resumePos={isInterrupt ? Math.min(saved?.position ?? 0, INTERRUPT_SESSION_CAP - 1) : (saved?.position ?? 0)}
        resumeTotal={isInterrupt ? Math.min(saved?.queueIds.length ?? 0, INTERRUPT_SESSION_CAP) : (saved?.queueIds.length ?? 0)}
        onDecline={() => setResumeDecision("declined")}
        onAccept={() => setResumeDecision("accepted")}
      />
    );
  }

  // Checks the hook's live `queue`, not the `initialQueue` memo snapshot: an interrupt
  // session's mount effect can fill an empty initialQueue via flex introduction.
  if (queue.length === 0) return <StudyEmptyQueue isInterrupt={isInterrupt} onHome={() => router.push("/learn")} />;

  const isDone = pos >= queue.length;

  if (isDone) {
    // Task #612: derived-props extracted to hooks/studyDoneScreenProps.ts (a
    // plain function, not a hook — see its own header) for the line-count cap.
    const { pct, stillDue, onStudyMore } = computeStudyDoneScreenProps({
      isGlobal, isInterrupt, unit, allUnits: ALL_UNITS, allCards,
      sessionCorrect, sessionTotal, getDueCards, getNewCards, getIntroductionDueCardIds, resetToQueue,
    });
    return (
      <StudyDoneScreen
        isInterrupt={isInterrupt} isGlobal={isGlobal} unit={unit}
        sessionCorrect={sessionCorrect} sessionTotal={sessionTotal} pct={pct}
        stillDue={stillDue}
        onHome={() => router.push("/learn")}
        onStudyMore={onStudyMore}
        onExitInterrupt={exitMandatoryMode}
      />
    );
  }

  // Task #599: asserted non-null only after isDone's branch returns — pos < queue.length is guaranteed here.
  const currentCard = queue[pos]!;
  const unitName = isGlobal || isInterrupt ? findUnitName(currentCard.id, ALL_UNITS) : unit!.name;
  const headerTitle = isInterrupt ? "Quick review" : isGlobal ? "Global Review" : `${unit!.emoji} ${unit!.name}`;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-8">
      <StudyHeader
        isInterrupt={isInterrupt} isGlobal={isGlobal} headerTitle={headerTitle}
        onSnooze={handleSnooze} snoozeMinutes={snoozeMinutes} onHome={() => router.push("/learn")}
        pos={pos} queueLength={queue.length} unitName={unitName} tier={currentCard.tier}
        sessionCorrect={sessionCorrect} sessionTotal={sessionTotal}
      />
      <div className="flex-1 flex items-center justify-center">
        <StudyCard key={`${currentCard.id}-${pos}`} card={currentCard} lang={lang} cardNumber={pos + 1} totalCards={queue.length} onRate={(g) => { handleRate(g); const r = introductions[currentCard.id]; if (r && !r.graduated) recordIntroductionResult(currentCard.id, g !== "again", localDateStr()); }} />
      </div>
    </div>
  );
}

// Task #654: Next.js App Router doesn't remount on a same-pathname, query-string-only
// navigation (e.g. a push tap routing "/study?unit=X" -> "/study?mode=interrupt"), so
// without a key StudyInner's useStudySession() instance survives untouched — stale
// queue/pos from the PRIOR session while the header relabels. Keying on mode+unitId
// forces a real remount whenever session identity changes.
function StudyPageKeyed() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get("unit") ?? "";
  const mode = searchParams.get("mode");
  const sessionKey = `${mode ?? "unit"}-${unitId}`;
  return <StudyInner key={sessionKey} />;
}

export default function StudyPage() {
  return <Suspense><StudyPageKeyed /></Suspense>;
}
