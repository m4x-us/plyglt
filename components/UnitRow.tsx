// ============================================================
// UnitRow.tsx — Single row in the unit list showing progress and ready count
// ============================================================
import Link from "next/link";
import type { Unit } from "@/content/types";

export type UnitStats = {
  due: number;
  learning: number;
  mastered: number;
  total: number;
  masteryPct: number;
};

export default function UnitRow({
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
            {stats.due} ready
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
