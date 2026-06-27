import { unitMasteryPct, MASTERY_GATE } from "@/store/srsStore";
import type { CardProgress } from "@/lib/srs";
import type { Unit } from "@/content/types";
import UnitRow, { type UnitStats } from "@/components/UnitRow";

type LevelSectionProps = {
  lvl: string;
  label: string;
  prevLvl: string;
  units: Unit[];
  unlocked: boolean;
  masteryPct: number;
  cards: Record<string, CardProgress>;
  unitMap: Record<string, Unit>;
  getStats: (unitCards: Unit["cards"]) => UnitStats;
};

export default function LevelSection({
  label,
  prevLvl,
  units,
  unlocked,
  masteryPct,
  cards,
  unitMap,
  getStats,
}: LevelSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest">{label}</h2>
          {!unlocked && <span className="text-xs text-gray-700">🔒 locked</span>}
        </div>
        {unlocked && masteryPct > 0 && (
          <span className="text-xs text-gray-500">{masteryPct}% mastered</span>
        )}
      </div>

      {!unlocked ? (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4 opacity-50">
          <span className="text-2xl">🔒</span>
          <div>
            <div className="text-gray-600 font-semibold text-sm">{label}</div>
            <div className="text-gray-700 text-xs mt-0.5">Complete {prevLvl} to unlock</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {units.map((unit) => {
            const mastery = unitMasteryPct(unit, cards);
            const prereqsMet = unit.prerequisiteUnits.every((uid) => {
              const prereqUnit = unitMap[uid];
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
}
