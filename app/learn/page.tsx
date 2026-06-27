"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSRSStore, unitMasteryPct, isMastered, MASTERY_GATE } from "@/store/srsStore";
import { useLangPack } from "@/hooks/useLangPack";
import { LANG_PAIR_KEY } from "@/lib/constants";
import { updateTrayBadge, listen } from "@/lib/tauri";
import { useIsHydrated } from "@/lib/storage";
import type { Unit } from "@/content/types";

const LEVELS = ["A1", "A2", "B1", "B2"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABELS: Record<Level, string> = {
  A1: "A1 — Beginner",
  A2: "A2 — Elementary",
  B1: "B1 — Intermediate",
  B2: "B2 — Upper Intermediate",
};

export default function Home() {
  const router = useRouter();
  const { cards, getStats, streak } = useSRSStore();
  const { units: ALL_UNITS, unitMap: UNIT_MAP, lang, loading: packLoading, error: packError } = useLangPack();

  const totalDue = ALL_UNITS.reduce((sum, u) => sum + getStats(u.cards).due, 0);

  // Keep the system tray badge in sync with the due count whenever it changes
  useEffect(() => {
    updateTrayBadge(totalDue);
  }, [totalDue]);

  // Listen for "Study Now" from the system tray menu → navigate to global review
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<void>("tray:study", () => {
      router.push("/study?mode=global");
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, [router]);

  const hydrated = useIsHydrated(useSRSStore);

  // Group units by level
  const byLevel = LEVELS.reduce<Record<Level, Unit[]>>((acc, lvl) => {
    acc[lvl] = ALL_UNITS.filter((u) => u.level === lvl);
    return acc;
  }, { A1: [], A2: [], B1: [], B2: [] });

  // Per-level aggregate mastery
  const levelMastery = (lvl: Level) => {
    const units = byLevel[lvl];
    if (units.length === 0) return 0;
    const total = units.reduce((s, u) => s + u.cards.length, 0);
    const mastered = units.reduce(
      (s, u) => s + u.cards.filter((c) => isMastered(cards[c.id])).length,
      0
    );
    return total === 0 ? 0 : Math.round((mastered / total) * 100);
  };

  // Determine current level (highest level with any progress)
  const currentLevel = (() => {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      // Non-null: i is within LEVELS bounds
      const pct = levelMastery(LEVELS[i]!);
      if (pct > 0) return LEVELS[i]!;
    }
    return "A1" as Level;
  })();

  // A level is accessible if the previous level is ≥ MASTERY_GATE or it's A1
  const levelUnlocked = (lvl: Level) => {
    const idx = LEVELS.indexOf(lvl);
    if (idx === 0) return true;
    // Non-null: idx > 0 is guaranteed by the early return above
    return levelMastery(LEVELS[idx - 1]!) >= MASTERY_GATE;
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (packLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading {lang.name} pack…</div>
      </div>
    );
  }

  if (packError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-sm">Could not load the {lang.name} pack.</div>
        <Link href="/" className="text-yellow-600 hover:text-yellow-500 text-sm">← Choose a different language</Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12"
      style={{ fontFamily: "sans-serif" }}
    >
      {/* Header */}
      <div className="text-center mb-8 w-full max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-4xl">{lang.flag}</span>
          <h1 className="text-3xl font-bold tracking-tight">{lang.uiStrings.appTitle}</h1>
        </div>
        <p className="text-gray-500 text-sm">
          {lang.uiStrings.appSubtitle}
        </p>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-6 mt-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{streak}</div>
            <div className="text-xs text-gray-500">day streak 🔥</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div className="text-center">
            <div className={`text-2xl font-bold ${totalDue > 0 ? "text-red-400" : "text-gray-400"}`}>
              {totalDue}
            </div>
            <div className="text-xs text-gray-500">cards due</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{currentLevel}</div>
            <div className="text-xs text-gray-500">current level</div>
          </div>
        </div>

        {/* Global review button */}
        {totalDue > 0 && (
          <Link
            href="/study?mode=global"
            className="mt-5 inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 border border-red-700 text-red-200 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            Review all {totalDue} due cards →
          </Link>
        )}
      </div>

      {/* Level sections */}
      <div className="w-full max-w-xl space-y-8">
        {LEVELS.map((lvl) => {
          const units = byLevel[lvl];
          if (units.length === 0) return null;
          const unlocked = levelUnlocked(lvl);
          const pct = levelMastery(lvl);

          return (
            <div key={lvl}>
              {/* Level header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs text-gray-500 uppercase tracking-widest">
                    {LEVEL_LABELS[lvl]}
                  </h2>
                  {!unlocked && <span className="text-xs text-gray-700">🔒 locked</span>}
                </div>
                {unlocked && pct > 0 && (
                  <span className="text-xs text-gray-500">{pct}% mastered</span>
                )}
              </div>

              {/* Locked level: single banner */}
              {!unlocked ? (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4 opacity-50">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <div className="text-gray-600 font-semibold text-sm">{LEVEL_LABELS[lvl]}</div>
                    <div className="text-gray-700 text-xs mt-0.5">
                      Complete {LEVELS[LEVELS.indexOf(lvl) - 1]!} to unlock
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {units.map((unit) => {
                    const mastery = unitMasteryPct(unit, cards);
                    const prereqsMet = unit.prerequisiteUnits.every((uid) => {
                      const prereqUnit = UNIT_MAP[uid];
                      return prereqUnit ? unitMasteryPct(prereqUnit, cards) >= MASTERY_GATE : false;
                    });
                    const unitUnlocked = unit.prerequisiteUnits.length === 0 || prereqsMet;
                    const stats = getStats(unit.cards);
                    const isComplete = mastery >= MASTERY_GATE;

                    return (
                      <UnitRow
                        key={unit.id}
                        unit={unit}
                        stats={stats}
                        masteryPct={mastery}
                        unlocked={unitUnlocked}
                        isComplete={isComplete}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-12 flex items-center gap-4">
        <p className="text-gray-700 text-xs">
          {lang.uiStrings.curriculumCredit} · {ALL_UNITS.length} units
        </p>
        <Link href="/stats" className="text-gray-700 hover:text-gray-400 text-xs transition-colors">
          Stats →
        </Link>
        <Link href="/settings" className="text-gray-700 hover:text-gray-400 text-xs transition-colors">
          Settings →
        </Link>
        <Link href="/" onClick={() => { window.localStorage.removeItem(LANG_PAIR_KEY); }} className="text-gray-700 hover:text-gray-400 text-xs transition-colors">
          Switch language →
        </Link>
      </div>
    </div>
  );
}

type UnitStats = {
  due: number;
  learning: number;
  mastered: number;
  total: number;
  masteryPct: number;
};

function UnitRow({
  unit,
  stats,
  masteryPct,
  unlocked,
  isComplete,
}: {
  unit: Unit;
  stats: UnitStats;
  masteryPct: number;
  unlocked: boolean;
  isComplete: boolean;
}) {
  const hasDue = stats.due > 0;
  const isNew = stats.mastered === 0 && stats.learning === 0;

  const content = (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all group ${
        !unlocked
          ? "border-gray-800 bg-gray-900/40 opacity-50 cursor-not-allowed"
          : isComplete
          ? "border-green-800 bg-green-950/20 hover:border-green-700 hover:bg-green-950/30"
          : hasDue
          ? "border-red-800 bg-gray-900 hover:border-red-700 hover:bg-gray-800"
          : "border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800"
      }`}
    >
      <div className="text-3xl flex-shrink-0 w-10 text-center">
        {!unlocked ? "🔒" : unit.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`font-semibold ${
              !unlocked
                ? "text-gray-600"
                : isComplete
                ? "text-green-300 group-hover:text-green-200"
                : "text-white group-hover:text-yellow-300"
            } transition-colors`}
          >
            {unit.name}
          </span>
        </div>
        <p className="text-gray-500 text-xs mb-2">{unit.theme}</p>

        {unlocked && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${isComplete ? "bg-green-500" : "bg-yellow-600"}`}
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 flex-shrink-0">
              {stats.mastered}/{stats.total}
            </span>
          </div>
        )}

        {!unlocked && (
          <p className="text-xs text-gray-700">Complete previous unit to unlock</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {unlocked && hasDue && (
          <span className="text-xs bg-red-900 text-red-300 rounded-full px-2 py-0.5 font-semibold">
            {stats.due} due
          </span>
        )}
        {unlocked && !hasDue && isNew && (
          <span className="text-xs text-gray-600">New</span>
        )}
        {unlocked && !hasDue && !isNew && isComplete && (
          <span className="text-xs text-green-700">✓ Complete</span>
        )}
        {unlocked && !hasDue && !isNew && !isComplete && (
          <span className="text-xs text-green-700">✓ Up to date</span>
        )}
        {unlocked && (
          <span className="text-gray-600 text-lg group-hover:text-white transition-colors">›</span>
        )}
      </div>
    </div>
  );

  if (!unlocked) return <div>{content}</div>;
  return <Link href={`/study?unit=${unit.id}`}>{content}</Link>;
}
