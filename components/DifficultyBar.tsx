// ============================================================
// DifficultyBar.tsx — visual bar showing FSRS card difficulty (1–10 scale)
// ============================================================

export function stabilityColorClass(medianDays: number): string {
  return medianDays >= 21 ? "bg-green-500" : medianDays >= 7 ? "bg-yellow-500" : "bg-red-500";
}

export default function DifficultyBar({ value }: { value: number }) {
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
