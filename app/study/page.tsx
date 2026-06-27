"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useEffect, useRef } from "react";
import { useSRSStore, unitMasteryPct, MASTERY_GATE } from "@/store/srsStore";
import { useLangPack } from "@/hooks/useLangPack";
import { useSettingsStore } from "@/store/settingsStore";
import { useIsHydrated } from "@/lib/storage";
import StudyCard from "@/components/StudyCard";
import { exitMandatoryMode, snoozeInterrupt } from "@/lib/tauri";
import { buildQueue, findUnitName } from "@/lib/queue";
import type { Grade } from "@/lib/srs";
import type { Card } from "@/content/types";

const INTERRUPT_CARD_LIMIT = 5;

function StudyInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const unitId = searchParams.get("unit") ?? "";
  const mode = searchParams.get("mode");
  const isGlobal = mode === "global";
  const isInterrupt = mode === "interrupt";

  const { getDueCards, getNewCards, commitSession, cards, clearActiveSession, getResumableSession } = useSRSStore();
  const snoozeMinutes = useSettingsStore((s) => s.snoozeMinutes);
  const { units: ALL_UNITS, unitMap: UNIT_MAP, loading: packLoading } = useLangPack();

  // Build the card pool
  const allCards = useMemo(
    () => (isGlobal || isInterrupt ? ALL_UNITS.flatMap((u) => u.cards) : UNIT_MAP[unitId]?.cards ?? []),
    [isGlobal, isInterrupt, unitId, ALL_UNITS, UNIT_MAP]
  );

  const unit = isGlobal || isInterrupt ? null : UNIT_MAP[unitId];

  // Gate new cards if unit prerequisites aren't met — prevents direct URL bypass
  const prereqsMet = useMemo(() => {
    if (isGlobal || isInterrupt || !unit) return true;
    return unit.prerequisiteUnits.every((uid) => {
      const prereqUnit = UNIT_MAP[uid];
      return prereqUnit ? unitMasteryPct(prereqUnit, cards) >= MASTERY_GATE : true;
    });
  }, [isGlobal, isInterrupt, unit, cards, UNIT_MAP]);

  const initialQueue = useMemo(() => {
    if (!prereqsMet) return [];
    const full = buildQueue(allCards, getDueCards, getNewCards, isGlobal || isInterrupt);
    return isInterrupt ? full.slice(0, INTERRUPT_CARD_LIMIT) : full;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, isGlobal, isInterrupt, prereqsMet]);

  // Build a card map for O(1) lookup by ID (needed for session resume)
  const allCardMap = useMemo(
    () => Object.fromEntries(allCards.map((c) => [c.id, c])),
    [allCards]
  );

  // Resume detection: compute synchronously at init so no cascading setState-in-effect.
  const [resumeDecision, setResumeDecision] = useState<"pending" | "accepted" | "declined" | null>(() => {
    const saved = getResumableSession();
    const sessionKey = isGlobal ? "global" : unitId;
    if (saved && saved.unitId === sessionKey && saved.position < saved.queueIds.length) {
      return "pending";
    }
    return null;
  });
  // Initialized to 0; set to Date.now() in the apply-resume effect (below) so Date.now()
  // is never called during render — satisfies react-hooks/purity.
  const sessionStartedAtRef = useRef<number>(0);

  // Derive initial queue/pos from resume decision
  const resumedQueue = useMemo((): Card[] | null => {
    if (resumeDecision !== "accepted") return null;
    const saved = getResumableSession();
    if (!saved) return null;
    return saved.queueIds.map((id) => allCardMap[id]).filter((c): c is Card => !!c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const resumedPos = useMemo((): number => {
    if (resumeDecision !== "accepted") return 0;
    const saved = getResumableSession();
    return saved?.position ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const [queue, setQueue] = useState<Card[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  // Apply resume when decision is made.
  // Multiple synchronous setState calls inside this effect are intentional —
  // React 18 batches them into a single re-render. Batch D (D2) will refactor
  // this effect into a useReducer, eliminating the setState-in-effect pattern.
  useEffect(() => {
    if (resumeDecision === "accepted" && resumedQueue) {
      const saved = getResumableSession();
      /* eslint-disable react-hooks/set-state-in-effect -- React 18 batches; useReducer refactor in Batch D/D2 */
      setQueue(resumedQueue);
      setPos(resumedPos);
      setSessionCorrect(saved?.sessionCorrect ?? 0);
      setSessionTotal(saved?.sessionTotal ?? 0);
      /* eslint-enable react-hooks/set-state-in-effect */
      sessionStartedAtRef.current = saved?.startedAt ?? Date.now();
    } else if (resumeDecision === "declined") {
      clearActiveSession();
      setQueue(initialQueue);
      setPos(0);
      setSessionCorrect(0);
      setSessionTotal(0);
      sessionStartedAtRef.current = Date.now();
    } else if (resumeDecision === null) {
      // No saved session — fresh start
      sessionStartedAtRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  // Clear persisted session when it naturally completes
  useEffect(() => {
    if (pos >= queue.length && queue.length > 0) {
      clearActiveSession();
    }
  }, [pos, queue.length, clearActiveSession]);

  const hydrated = useIsHydrated(useSRSStore);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (packLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!isGlobal && !isInterrupt && !unit) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        Unit not found.
      </div>
    );
  }

  if (initialQueue.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-green-400 mb-2">All caught up!</h1>
        <p className="text-gray-500 mb-8">No cards due right now.</p>
        <button
          onClick={async () => {
            if (isInterrupt) await exitMandatoryMode();
            router.push("/learn");
          }}
          className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          ← Home
        </button>
      </div>
    );
  }

  // Show resume prompt before starting
  if (resumeDecision === "pending") {
    const saved = getResumableSession();
    const resumePos = saved?.position ?? 0;
    const resumeTotal = saved?.queueIds.length ?? 0;
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">↩</div>
        <h1 className="text-2xl font-bold text-white mb-2">Resume where you left off?</h1>
        <p className="text-gray-500 mb-8">
          Card {resumePos + 1} of {resumeTotal} — session still in progress
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setResumeDecision("declined")}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Start over
          </button>
          <button
            onClick={() => setResumeDecision("accepted")}
            className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Resume →
          </button>
        </div>
      </div>
    );
  }

  const isDone = pos >= queue.length;
  // Non-null: handleRate and the card renderer are only reached when !isDone (pos < queue.length)
  const currentCard = queue[pos]!;

  const handleRate = (grade: Grade) => {
    const wasCorrect = grade !== "again";
    const newTotal = sessionTotal + 1;
    const newCorrect = wasCorrect ? sessionCorrect + 1 : sessionCorrect;
    const newPos = pos + 1;

    let newQueue = queue;
    if (grade === "again") {
      newQueue = [...queue];
      const reinsertAt = Math.min(pos + 3, newQueue.length);
      newQueue.splice(reinsertAt, 0, currentCard);
      setQueue(newQueue);
    }

    // Atomically persists card rating + session state + streak in one set() call.
    // A crash mid-handleRate can no longer leave streak incremented but card unrated.
    commitSession(currentCard.id, grade, {
      unitId: isGlobal ? "global" : unitId,
      queueIds: newQueue.map((c) => c.id),
      position: newPos,
      sessionCorrect: newCorrect,
      sessionTotal: newTotal,
      startedAt: sessionStartedAtRef.current,
    });

    setSessionTotal(newTotal);
    if (wasCorrect) setSessionCorrect(newCorrect);
    setPos(newPos);
  };

  if (isDone) {
    const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;

    if (isInterrupt) {
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-green-400 mb-2">Quick Review Done!</h1>
          <p className="text-gray-400 mb-8">
            {sessionCorrect}/{sessionTotal} correct
          </p>
          <button
            onClick={async () => {
              await exitMandatoryMode();
              router.push("/learn");
            }}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      );
    }

    const title = isGlobal ? "All Due Reviews Done!" : "Session Complete!";
    const subtitle = isGlobal ? "Every due card cleared." : `${unit!.emoji} ${unit!.name}`;

    return (
      <div
        className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center"
        style={{ fontFamily: "serif" }}
      >
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">{title}</h1>
        <p className="text-gray-400 mb-8">{subtitle}</p>

        <div className="grid grid-cols-3 gap-6 mb-10 w-full max-w-sm">
          <Stat label="Reviewed" value={sessionTotal} />
          <Stat label="Correct" value={`${pct}%`} highlight={pct >= 70} />
          <Stat
            label="Still due"
            value={getDueCards(isGlobal ? ALL_UNITS.flatMap((u) => u.cards) : unit!.cards).length}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/learn")}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            ← Home
          </button>
          {!isGlobal && (
            <button
              onClick={() => {
                const fresh = buildQueue(allCards, getDueCards, getNewCards, false);
                setQueue(fresh);
                setPos(0);
                setSessionCorrect(0);
                setSessionTotal(0);
              }}
              className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              Study More →
            </button>
          )}
        </div>
      </div>
    );
  }

  const tierLabel: Record<number, string> = {
    1: "Vocabulary",
    2: "Grammar",
    3: "Phrases",
    4: "Sentences",
  };

  const unitName = isGlobal || isInterrupt ? findUnitName(currentCard.id, ALL_UNITS) : unit!.name;
  const headerTitle = isInterrupt
    ? "⏰ Quick Review"
    : isGlobal
    ? "Global Review"
    : `${unit!.emoji} ${unit!.name}`;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between max-w-xl mx-auto w-full mb-6">
        {isInterrupt ? (
          <button
            onClick={async () => {
              try {
                await snoozeInterrupt(snoozeMinutes);
              } catch (err) {
                console.error(`[ERR-IPC-SNOOZE-${Date.now()}] Snooze failed:`, err);
              }
              try { await exitMandatoryMode(); } finally { router.push("/learn"); }
            }}
            className="text-yellow-600 hover:text-yellow-400 text-sm font-medium transition-colors"
          >
            Snooze {snoozeMinutes} min
          </button>
        ) : (
          <button
            onClick={() => router.push("/learn")}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← {headerTitle}
          </button>
        )}
        <div className="flex items-center gap-3 text-sm">
          {isInterrupt && (
            <span className="text-xs bg-yellow-900/40 text-yellow-500 px-2 py-0.5 rounded-full font-medium">
              {pos + 1}/{queue.length}
            </span>
          )}
          {(isGlobal || isInterrupt) && unitName && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {unitName}
            </span>
          )}
          <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
            Tier {currentCard.tier} · {tierLabel[currentCard.tier] ?? ""}
          </span>
          {sessionTotal > 0 && (
            <span className="text-gray-500">
              {sessionCorrect}/{sessionTotal} correct
            </span>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        <StudyCard
          key={`${currentCard.id}-${pos}`}
          card={currentCard}
          cardNumber={pos + 1}
          totalCards={queue.length}
          onRate={handleRate}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`text-2xl font-bold ${highlight ? "text-green-400" : "text-white"}`}>
        {value}
      </div>
      <div className="text-gray-500 text-xs mt-1">{label}</div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense>
      <StudyInner />
    </Suspense>
  );
}
