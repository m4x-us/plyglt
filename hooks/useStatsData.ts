// ============================================================
// useStatsData.ts — aggregates SRS progress data for the stats page
// ============================================================
import { useState } from "react";
import { useLangPack } from "@/hooks/useLangPack";
import { useSRSStore, isMastered } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";
import type { Card } from "@/content/types";

export type CardWithProgress = { card: Card; progress: CardProgress };

export type LevelStability = {
  level: "A1" | "A2" | "B1" | "B2";
  median: number;
  count: number;
};

export type WeakTag = { tag: string; avgDifficulty: number; count: number };

export type StatsData = {
  loading: boolean;
  seen: number;
  totalCards: number;
  now: number;
  hardest: CardWithProgress[];
  weakestTags: WeakTag[];
  levelStability: LevelStability[];
  atRisk: CardWithProgress[];
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const LEVELS = ["A1", "A2", "B1", "B2"] as const;

export function useStatsData(): StatsData {
  const { units, loading } = useLangPack();
  const { cards } = useSRSStore();
  // Lazy initializer avoids calling Date.now() during render (react-hooks/purity).
  const [now] = useState<number>(Date.now);

  if (loading) {
    return {
      loading: true,
      seen: 0,
      totalCards: 0,
      now,
      hardest: [],
      weakestTags: [],
      levelStability: [],
      atRisk: [],
    };
  }

  const allCards: CardWithProgress[] = [];
  for (const unit of units) {
    for (const card of unit.cards) {
      const progress = cards[card.id];
      if (progress) allCards.push({ card, progress });
    }
  }

  const seen = allCards.length;
  const totalCards = units.reduce((s, u) => s + u.cards.length, 0);

  const hardest = [...allCards]
    .sort((a, b) => b.progress.difficulty - a.progress.difficulty)
    .slice(0, 10);

  const tagDifficulty: Record<string, number[]> = {};
  for (const { card, progress } of allCards) {
    for (const tag of card.tags) {
      if (!tagDifficulty[tag]) tagDifficulty[tag] = [];
      tagDifficulty[tag].push(progress.difficulty);
    }
  }
  const weakestTags: WeakTag[] = Object.entries(tagDifficulty)
    .filter(([, vals]) => vals.length >= 3)
    .map(([tag, vals]) => ({
      tag,
      avgDifficulty: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }))
    .sort((a, b) => b.avgDifficulty - a.avgDifficulty)
    .slice(0, 8);

  const levelStability: LevelStability[] = LEVELS.map((level) => {
    const stabilities = units
      .filter((u) => u.level === level)
      .flatMap((u) => u.cards)
      .map((c) => cards[c.id])
      .filter((p): p is CardProgress => p?.state === "review")
      .map((p) => p.stability);
    return { level, median: median(stabilities), count: stabilities.length };
  });

  const atRisk = allCards.filter(
    ({ progress }) =>
      isMastered(progress) && now - progress.dueDate > OVERDUE_THRESHOLD_MS
  );

  return { loading: false, seen, totalCards, now, hardest, weakestTags, levelStability, atRisk };
}
