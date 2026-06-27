"use client";

import Link from "next/link";
import { useState } from "react";
import { useLangPack } from "@/hooks/useLangPack";
import { useSRSStore, isMastered } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";
import type { Card } from "@/content/types";

// ── Data helpers ─────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Non-null: mid is within bounds (length > 0 checked above)
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ── Stats page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { units, loading: packLoading } = useLangPack();
  const { cards } = useSRSStore();
  // Captured once at mount — lazy initializer avoids calling Date.now() during render
  // (react-hooks/purity) while still providing a stable timestamp for the session.
  const [now] = useState<number>(Date.now);

  if (packLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  const allCards: { card: Card; progress: CardProgress }[] = [];
  for (const unit of units) {
    for (const card of unit.cards) {
      const progress = cards[card.id];
      if (progress) allCards.push({ card, progress });
    }
  }

  const seen = allCards.length;
  const totalCards = units.reduce((s, u) => s + u.cards.length, 0);

  // Section 1: Hardest cards (highest difficulty)
  const hardest = [...allCards]
    .sort((a, b) => b.progress.difficulty - a.progress.difficulty)
    .slice(0, 10);

  // Section 2: Weakest tags (highest avg difficulty)
  const tagDifficulty: Record<string, number[]> = {};
  for (const { card, progress } of allCards) {
    for (const tag of card.tags) {
      if (!tagDifficulty[tag]) tagDifficulty[tag] = [];
      tagDifficulty[tag].push(progress.difficulty);
    }
  }
  const weakestTags = Object.entries(tagDifficulty)
    .filter(([, vals]) => vals.length >= 3)
    .map(([tag, vals]) => ({
      tag,
      avgDifficulty: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }))
    .sort((a, b) => b.avgDifficulty - a.avgDifficulty)
    .slice(0, 8);

  // Section 3: Median stability by level
  const levels = ["A1", "A2", "B1", "B2"] as const;
  const levelStability = levels.map((level) => {
    const stabilities = units.filter((u) => u.level === level)
      .flatMap((u) => u.cards)
      .map((c) => cards[c.id])
      .filter((p): p is CardProgress => p?.state === "review")
      .map((p) => p.stability);
    return { level, median: median(stabilities), count: stabilities.length };
  });

  // Section 4: At-risk cards (overdue by > 7 days and in review state)
  const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
  const atRisk = allCards.filter(
    ({ progress }) =>
      isMastered(progress) && now - progress.dueDate > OVERDUE_THRESHOLD_MS
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold">Learning Stats</h1>
            <p className="text-gray-500 text-sm mt-1">
              {seen} of {totalCards} cards seen
            </p>
          </div>
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
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
            {/* Section 4: At-risk (shown prominently when non-empty) */}
            {atRisk.length > 0 && (
              <section>
                <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Retention at risk — overdue &gt;7 days
                </h2>
                <div className="space-y-2">
                  {atRisk.slice(0, 5).map(({ card, progress }) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-xl border border-red-900 bg-red-950/20 px-4 py-3"
                    >
                      <span className="text-white text-sm truncate mr-4">{card.prompt}</span>
                      <span className="text-red-400 text-xs flex-shrink-0">
                        {Math.floor((now - progress.dueDate) / 86400000)}d overdue
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

            {/* Section 1: Hardest cards */}
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

            {/* Section 2: Weakest tags */}
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

            {/* Section 3: Stability by level */}
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
                        className={`h-full rounded-full transition-all ${
                          med >= 21
                            ? "bg-green-500"
                            : med >= 7
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
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

function DifficultyBar({ value }: { value: number }) {
  const pct = ((value - 1) / 9) * 100;
  const color =
    pct > 66 ? "bg-red-500" : pct > 33 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-600 text-xs w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}
