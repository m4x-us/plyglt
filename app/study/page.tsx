// ============================================================
// page.tsx — Study page: spaced repetition review queue for a unit or global session
// ============================================================
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useSRSStore, unitMasteryPct, MASTERY_GATE, localDateStr } from "@/store/srsStore";
import { useLangPack } from "@/hooks/useLangPack";
import { useSettingsStore } from "@/store/settingsStore";
import { useSyncStore } from "@/store/syncStore";
import { useIsHydrated } from "@/lib/storage";
import StudyCard from "@/components/StudyCard";
import StudyDoneScreen from "@/components/StudyDoneScreen";
import StudyResumePrompt from "@/components/StudyResumePrompt";
import StudyEmptyQueue from "@/components/StudyEmptyQueue";
import StudyUnitNotFound from "@/components/StudyUnitNotFound";
import { exitMandatoryMode, snoozeInterrupt } from "@/lib/tauriInterrupt";
import { buildQueue, findUnitName } from "@/lib/queue";
import { useStudySession } from "@/hooks/useStudySession";
import { useSync } from "@/hooks/useSync";
import { tierLabel } from "@/lib/cardLabels";

const INTERRUPT_CARD_LIMIT = 5;

function StudyInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const unitId = searchParams.get("unit") ?? "";
  const mode = searchParams.get("mode");
  const isGlobal = mode === "global";
  const isInterrupt = mode === "interrupt";

  const { getDueCards, getNewCards, commitSession, cards, clearActiveSession, getResumableSession, recordIntroductionResult, introductions, getIntroductionDueCardIds, canIntroduceNewCard, introduceCard } = useSRSStore();
  const enqueueReviewEventRaw = useSyncStore((s) => s.enqueueReviewEvent);
  const { triggerSyncSoon } = useSync();
  // Nudges a sync soon after every review (hooks/useSync.ts's debounce) instead of
  // waiting for the periodic timer — Task #518's live test showed a review sitting
  // unsynced for minutes reads as broken.
  const enqueueReviewEvent: typeof enqueueReviewEventRaw = (...args) => { enqueueReviewEventRaw(...args); triggerSyncSoon(); };
  const snoozeMinutes = useSettingsStore((s) => s.snoozeMinutes);
  const { units: ALL_UNITS, unitMap: UNIT_MAP, lang, loading: packLoading } = useLangPack();

  const allCards = useMemo(
    () => (isGlobal || isInterrupt ? ALL_UNITS.flatMap((u) => u.cards) : UNIT_MAP[unitId]?.cards ?? []),
    [isGlobal, isInterrupt, unitId, ALL_UNITS, UNIT_MAP]
  );

  const unit = isGlobal || isInterrupt ? null : (UNIT_MAP[unitId] ?? null);

  const prereqsMet = useMemo(() => {
    if (isGlobal || isInterrupt || !unit) return true;
    return unit.prerequisiteUnits.every((uid) => {
      const prereqUnit = UNIT_MAP[uid];
      return prereqUnit ? unitMasteryPct(prereqUnit, cards) >= MASTERY_GATE : true;
    });
  }, [isGlobal, isInterrupt, unit, cards, UNIT_MAP]);

  const initialQueue = useMemo(() => {
    if (!prereqsMet) return [];
    const full = buildQueue(allCards, getDueCards, getNewCards, isGlobal || isInterrupt, getIntroductionDueCardIds);
    return isInterrupt ? full.slice(0, INTERRUPT_CARD_LIMIT) : full;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, isGlobal, isInterrupt, prereqsMet]);

  const allCardMap = useMemo(
    () => Object.fromEntries(allCards.map((c) => [c.id, c])),
    [allCards]
  );

  const { queue, pos, sessionCorrect, sessionTotal, resumeDecision, setResumeDecision, handleRate, resetToQueue } =
    useStudySession({ initialQueue, allCardMap, isGlobal, unitId, getResumableSession, clearActiveSession, commitSession, canIntroduceNewCard, introduceCard, cards, introductions, enqueueReviewEvent });

  const hydrated = useIsHydrated(useSRSStore);
  if (!hydrated || packLoading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Loading…</div>;
  if (!isGlobal && !isInterrupt && !unit) return <StudyUnitNotFound mode={mode} unitId={unitId} onHome={() => router.push("/learn")} />;

  if (initialQueue.length === 0) return <StudyEmptyQueue isInterrupt={isInterrupt} onHome={() => router.push("/learn")} />;

  if (resumeDecision === "pending") {
    const saved = getResumableSession();
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
  const currentCard = queue[pos]!;

  if (isDone) {
    const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    const unitCards = isGlobal || isInterrupt ? ALL_UNITS.flatMap((u) => u.cards) : unit!.cards;
    return (
      <StudyDoneScreen
        isInterrupt={isInterrupt} isGlobal={isGlobal} unit={unit}
        sessionCorrect={sessionCorrect} sessionTotal={sessionTotal} pct={pct}
        stillDue={getDueCards(unitCards).length}
        onHome={() => router.push("/learn")}
        onStudyMore={!isGlobal ? () => resetToQueue(buildQueue(allCards, getDueCards, getNewCards, false)) : null}
        onExitInterrupt={exitMandatoryMode}
      />
    );
  }

  const unitName = isGlobal || isInterrupt ? findUnitName(currentCard.id, ALL_UNITS) : unit!.name;
  const headerTitle = isInterrupt ? "Quick review" : isGlobal ? "Global Review" : `${unit!.emoji} ${unit!.name}`;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-8">
      <div className="flex items-center justify-between max-w-xl mx-auto w-full mb-6">
        {isInterrupt ? (
          <button
            onClick={async () => {
              try { await snoozeInterrupt(snoozeMinutes); } catch (err) { console.error(`[ERR-IPC-SNOOZE-${Date.now()}] Snooze failed:`, err); }
              try { await exitMandatoryMode(); } catch (err) { console.error(`[ERR-IPC-EXIT-${Date.now()}] exitMandatoryMode failed:`, err); } finally { router.push("/learn"); }
            }}
            className="text-yellow-600 hover:text-yellow-400 text-sm font-medium transition-colors"
          >
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
