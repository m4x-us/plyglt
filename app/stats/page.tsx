// ============================================================
// page.tsx — Stats page: FSRS difficulty, at-risk cards, and retention by level
// ============================================================
"use client";

import Link from "next/link";
import { useStatsData } from "@/hooks/useStatsData";
import DifficultyBar, { stabilityColorClass } from "@/components/DifficultyBar";

export default function StatsPage() {
  const { loading, seen, totalCards, now, hardest, weakestTags, levelStability, atRisk } =
    useStatsData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold">Learning Stats</h1>
            <p className="text-gray-500 text-sm mt-1">
              {seen} of {totalCards} cards seen
            </p>
          </div>
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← Home
          </Link>
        </div>

        {seen === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <div className="text-4xl mb-4">📊</div>
            <p>Start studying to see your stats here.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {atRisk.length > 0 && (
              <section>
                <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  At risk — ready &gt;7 days
                </h2>
                <div className="space-y-2">
                  {atRisk.slice(0, 5).map(({ card, progress }) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-xl border border-red-900 bg-red-950/20 px-4 py-3"
                    >
                      <span className="text-white text-sm truncate mr-4">{card.prompt}</span>
                      <span className="text-red-400 text-xs flex-shrink-0">
                        {Math.floor((now - progress.dueDate) / 86400000)}d ago
                      </span>
                    </div>
                  ))}
                  {atRisk.length > 5 && (
                    <p className="text-gray-600 text-xs text-right">
                      +{atRisk.length - 5} more — use global review to clear them
                    </p>
                  )}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                Hardest cards (by FSRS difficulty)
              </h2>
              {hardest.length === 0 ? (
                <p className="text-gray-700 text-sm">No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {hardest.map(({ card, progress }) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
                    >
                      <span className="text-white text-sm truncate mr-4">{card.prompt}</span>
                      <DifficultyBar value={progress.difficulty} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {weakestTags.length > 0 && (
              <section>
                <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Weakest topics (avg difficulty ≥ 3 cards)
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {weakestTags.map(({ tag, avgDifficulty, count }) => (
                    <div
                      key={tag}
                      className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-300 text-sm font-medium">{tag}</span>
                        <DifficultyBar value={avgDifficulty} />
                      </div>
                      <div className="text-gray-600 text-xs">{count} cards</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                Retention strength by level (median stability)
              </h2>
              <div className="space-y-3">
                {levelStability.map(({ level, median: med, count }) => (
                  <div key={level}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm">{level}</span>
                      <span className="text-gray-500 text-xs">
                        {count === 0
                          ? "No mastered cards"
                          : `${Math.round(med)}d median · ${count} cards`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${stabilityColorClass(med)}`}
                        style={{ width: `${Math.min(100, (med / 60) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-gray-700 text-xs mt-3">
                Green = 21+ days · Yellow = 7–21 days · Red = &lt;7 days
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
