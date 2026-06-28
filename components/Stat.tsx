// ============================================================
// Stat.tsx — Single stat box showing a label and numeric or string value
// ============================================================
export function Stat({
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
