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
import StudyUnitNotFound from "@/components/StudyUnitNotFound";
import { exitMandatoryMode } from "@/lib/tauriInterrupt";
import { findUnitName } from "@/lib/queue";
import { useStudySession } from "@/hooks/useStudySession";
import { useStudyQueueSetup } from "@/hooks/useStudyQueueSetup";
import { computeStudyDoneScreenProps } from "@/hooks/studyDoneScreenProps";
import { useSnoozeAndExit } from "@/hooks/useSnoozeAndExit";
import { useSync } from "@/hooks/useSync";
import { tierLabel } from "@/lib/cardLabels";

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
  const handleSnooze = useSnoozeAndExit(snoozeMinutes);
  const { units: ALL_UNITS, unitMap: UNIT_MAP, lang, loading: packLoading } = useLangPack();

  // Task #612: card-scope/prerequisite/initial-queue computation extracted to
  // hooks/useStudyQueueSetup.ts to keep this route under CLAUDE.md's 150-line cap.
  const { allCards, unit, initialQueue, allCardMap } = useStudyQueueSetup({
    isGlobal, isInterrupt, unitId, allUnits: ALL_UNITS, unitMap: UNIT_MAP, cards,
    getDueCards, getNewCards, getIntroductionDueCardIds,
  });

  // Task #542/#583/#620: this binding scans+sorts the full allCards catalog once per mount —
  // see hooks/useStudySession.ts's near-due fill step for the cost/accepted-debt analysis.
  const { queue, pos, sessionCorrect, sessionTotal, resumeDecision, setResumeDecision, handleRate, resetToQueue } =
    useStudySession({ initialQueue, allCardMap, isGlobal, isInterrupt, unitId, getResumableSession, peekResumableSession, clearExpiredResumableSession, clearActiveSession, commitSession, canIntroduceNewCard, introduceCard, getNearDueCards: (limit) => getNearDueCards(allCards, limit), cards, introductions, enqueueReviewEvent });

  // Task #628 (Wave 8): `hydrated` (lenient) alone would unblock this screen
  // within HYDRATION_FAILSAFE_MS even without real hydration (Task #406: never
  // hang forever) — but everything past it writes real data (handleRate →
  // commitSession; onRate → recordIntroductionResult), the exact reachability
  // path F002 found still open after hooks/useStudySession.ts's own write got
  // strict-gated. `hydratedStrict` (never resolves via the failsafe) closes it —
  // combined into one condition since both render identical UI; no SEPARATE
  // generous write-gating timeout, since any such timeout just reintroduces the
  // same race later (lib/storage.ts's Task #627 collision fix note applies).
  const hydrated = useIsHydrated(useSRSStore);
  const hydratedStrict = useIsHydratedStrict(useSRSStore);
  if (!hydrated || packLoading || !hydratedStrict) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Loading…</div>;
  if (!isGlobal && !isInterrupt && !unit) return <StudyUnitNotFound mode={mode} unitId={unitId} onHome={() => router.push("/learn")} />;

  // Checks the hook's live `queue`, not the `initialQueue` memo snapshot: an interrupt
  // session's mount effect can fill an empty initialQueue via flex introduction.
  if (queue.length === 0) return <StudyEmptyQueue isInterrupt={isInterrupt} onHome={() => router.push("/learn")} />;

  if (resumeDecision === "pending") {
    // Task #608: peekResumableSession is the render-phase-safe read.
    const saved = peekResumableSession();
    return (
      <StudyResumePrompt
        resumePos={saved?.position ?? 0}
        resumeTotal={saved?.queueIds.length ?? 0}
        onDecline={() => setResumeDecision("declined")}
        onAccept={() => setResumeDecision("accepted")}
      />
    );
  }

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

  // Task #599: only asserted non-null after the isDone branch above has already
  // returned — pos < queue.length is guaranteed here, whereas evaluating this
  // before that branch (the prior ordering) asserted non-null before its own
  // precondition was confirmed, even though isDone's own branch never read it.
  const currentCard = queue[pos]!;
  const unitName = isGlobal || isInterrupt ? findUnitName(currentCard.id, ALL_UNITS) : unit!.name;
  const headerTitle = isInterrupt ? "Quick review" : isGlobal ? "Global Review" : `${unit!.emoji} ${unit!.name}`;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-8">
      <div className="flex items-center justify-between max-w-xl mx-auto w-full mb-6">
        {isInterrupt ? (
          <button onClick={handleSnooze} className="text-yellow-600 hover:text-yellow-400 text-sm font-medium transition-colors">
            Snooze {snoozeMinutes} min
          </button>
        ) : (
          <button onClick={() => router.push("/learn")} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← {headerTitle}
          </button>
        )}
        <div className="flex items-center gap-3 text-sm">
          {isInterrupt && <span className="text-xs bg-yellow-900/40 text-yellow-500 px-2 py-0.5 rounded-full font-medium">{pos + 1}/{queue.length}</span>}
          {(isGlobal || isInterrupt) && unitName && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{unitName}</span>}
          <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
            Tier {currentCard.tier} · {tierLabel(currentCard.tier)}
          </span>
          {sessionTotal > 0 && <span className="text-gray-500">{sessionCorrect}/{sessionTotal} correct</span>}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <StudyCard key={`${currentCard.id}-${pos}`} card={currentCard} lang={lang} cardNumber={pos + 1} totalCards={queue.length} onRate={(g) => { handleRate(g); const r = introductions[currentCard.id]; if (r && !r.graduated) recordIntroductionResult(currentCard.id, g !== "again", localDateStr()); }} />
      </div>
    </div>
  );
}

export default function StudyPage() {
  return <Suspense><StudyInner /></Suspense>;
}
