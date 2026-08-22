// ============================================================
// StudyHeader.tsx — top bar for the active study screen (snooze/back button + status badges)
// ============================================================
// Extracted from app/study/page.tsx under the Rule 1 150-line route cap.
// ============================================================
// DEPENDS ON: @/lib/cardLabels (tierLabel)
// USED BY: app/study/page.tsx
// ============================================================
"use client";

import { tierLabel } from "@/lib/cardLabels";

interface StudyHeaderProps {
  isInterrupt: boolean;
  isGlobal: boolean;
  headerTitle: string;
  onSnooze: () => void;
  snoozeMinutes: number;
  onHome: () => void;
  pos: number;
  queueLength: number;
  unitName: string;
  tier: number;
  sessionCorrect: number;
  sessionTotal: number;
}

export default function StudyHeader({
  isInterrupt,
  isGlobal,
  headerTitle,
  onSnooze,
  snoozeMinutes,
  onHome,
  pos,
  queueLength,
  unitName,
  tier,
  sessionCorrect,
  sessionTotal,
}: StudyHeaderProps) {
  return (
    <div className="flex items-center justify-between max-w-xl mx-auto w-full mb-6">
      {isInterrupt ? (
        <button onClick={onSnooze} className="text-yellow-600 hover:text-yellow-400 text-sm font-medium transition-colors">
          Snooze {snoozeMinutes} min
        </button>
      ) : (
        <button onClick={onHome} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← {headerTitle}
        </button>
      )}
      <div className="flex items-center gap-3 text-sm">
        {isInterrupt && <span className="text-xs bg-yellow-900/40 text-yellow-500 px-2 py-0.5 rounded-full font-medium">{pos + 1}/{queueLength}</span>}
        {(isGlobal || isInterrupt) && unitName && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{unitName}</span>}
        <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
          Tier {tier} · {tierLabel(tier)}
        </span>
        {sessionTotal > 0 && <span className="text-gray-500">{sessionCorrect}/{sessionTotal} correct</span>}
      </div>
    </div>
  );
}
