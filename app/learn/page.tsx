// ============================================================
// page.tsx — Home/learn page: lists language units and global study entry
// ============================================================
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSRSStore, MASTERY_GATE, levelMasteryPct, currentStudyLevel } from "@/store/srsStore";
import { useLangPack } from "@/hooks/useLangPack";
import { LANG_PAIR_KEY } from "@/lib/constants";
import { listen } from "@/lib/tauri";
import { updateTrayBadge } from "@/lib/tauriInterrupt";
import { createPlatformStorage, useIsHydrated } from "@/lib/storage";

// Route through the platform storage abstraction — never call localStorage directly (CLAUDE.md).
const _langPairStore = createPlatformStorage("lang");
import type { Unit } from "@/content/types";
import LevelSection from "@/components/LevelSection";

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

  useEffect(() => { updateTrayBadge(totalDue); }, [totalDue]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<void>("tray:study", () => { router.push("/study?mode=global"); }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, [router]);

  const hydrated = useIsHydrated(useSRSStore);

  const byLevel = LEVELS.reduce<Record<Level, Unit[]>>((acc, lvl) => {
    acc[lvl] = ALL_UNITS.filter((u) => u.level === lvl);
    return acc;
  }, { A1: [], A2: [], B1: [], B2: [] });

  const levelMastery = (lvl: string): number => levelMasteryPct(byLevel[lvl as Level] ?? [], cards);
  const currentLevel = currentStudyLevel(LEVELS, levelMastery);
  const levelUnlocked = (lvl: Level) => {
    const idx = LEVELS.indexOf(lvl);
    return idx === 0 || levelMastery(LEVELS[idx - 1]!) >= MASTERY_GATE;
  };

  if (!hydrated) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
  );
  if (packLoading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading {lang.name} pack…</div>
    </div>
  );
  if (packError) return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
      <div className="text-red-400 text-sm">Could not load the {lang.name} pack.</div>
      <Link href="/" className="text-yellow-600 hover:text-yellow-500 text-sm">← Choose a different language</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12" style={{ fontFamily: "sans-serif" }}>
      <div className="text-center mb-8 w-full max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-4xl">{lang.flag}</span>
          <h1 className="text-3xl font-bold tracking-tight">{lang.uiStrings.appTitle}</h1>
        </div>
        <p className="text-gray-500 text-sm">{lang.uiStrings.appSubtitle}</p>
        <div className="flex items-center justify-center gap-6 mt-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{streak}</div>
            <div className="text-xs text-gray-500">day streak 🔥</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div className="text-center">
            <div className={`text-2xl font-bold ${totalDue > 0 ? "text-red-400" : "text-gray-400"}`}>{totalDue}</div>
            <div className="text-xs text-gray-500">cards ready</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{currentLevel}</div>
            <div className="text-xs text-gray-500">current level</div>
          </div>
        </div>
        {totalDue > 0 && (
          <Link href="/study?mode=global" className="mt-5 inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 border border-red-700 text-red-200 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
            Review all {totalDue} ready cards →
          </Link>
        )}
      </div>

      <div className="w-full max-w-xl space-y-8">
        {LEVELS.map((lvl, idx) => {
          if (byLevel[lvl].length === 0) return null;
          return (
            <LevelSection
              key={lvl}
              lvl={lvl}
              label={LEVEL_LABELS[lvl]}
              prevLvl={idx > 0 ? LEVELS[idx - 1]! : ""}
              units={byLevel[lvl]}
              unlocked={levelUnlocked(lvl)}
              masteryPct={levelMastery(lvl)}
              cards={cards}
              unitMap={UNIT_MAP}
              getStats={getStats}
            />
          );
        })}
      </div>

      <div className="mt-12 flex items-center gap-4">
        <p className="text-gray-700 text-xs">{lang.uiStrings.curriculumCredit} · {ALL_UNITS.length} units</p>
        <Link href="/stats" className="text-gray-700 hover:text-gray-400 text-xs transition-colors">Stats →</Link>
        <Link href="/settings" className="text-gray-700 hover:text-gray-400 text-xs transition-colors">Settings →</Link>
        <Link href="/" onClick={() => { void _langPairStore.removeItem(LANG_PAIR_KEY); }} className="text-gray-700 hover:text-gray-400 text-xs transition-colors">Switch language →</Link>
      </div>
    </div>
  );
}
