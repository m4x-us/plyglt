// ============================================================
// StudyDoneScreen.tsx — End-of-session screen showing score and navigation options
// ============================================================
import type { Unit } from "@/content/types";
import { Stat } from "@/components/Stat";

export default function StudyDoneScreen({
  isInterrupt,
  isGlobal,
  unit,
  sessionCorrect,
  sessionTotal,
  pct,
  stillDue,
  onHome,
  onStudyMore,
  onExitInterrupt,
}: {
  isInterrupt: boolean;
  isGlobal: boolean;
  unit: Unit | null;
  sessionCorrect: number;
  sessionTotal: number;
  pct: number;
  stillDue: number;
  onHome: () => void;
  onStudyMore: (() => void) | null;
  onExitInterrupt: () => Promise<void>;
}) {
  if (isInterrupt) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-3xl font-bold text-green-400 mb-2">Review complete.</h1>
        <p className="text-gray-400 mb-8">{sessionCorrect}/{sessionTotal} correct</p>
        <button
          onClick={async () => {
            try { await onExitInterrupt(); } catch (err) { console.error(`[ERR-IPC-EXIT-${Date.now()}] exitMandatoryMode failed:`, err); }
            onHome();
          }}
          className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  const title = "Session complete.";
  const subtitle = isGlobal ? "Every due card cleared." : `${unit!.emoji} ${unit!.name}`;

  return (
    <div
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center"
      style={{ fontFamily: "serif" }}
    >

      <h1 className="text-3xl font-bold text-yellow-400 mb-2">{title}</h1>
      <p className="text-gray-400 mb-8">{subtitle}</p>
      <div className="grid grid-cols-3 gap-6 mb-10 w-full max-w-sm">
        <Stat label="Reviewed" value={sessionTotal} />
        <Stat label="Correct" value={`${pct}%`} highlight={pct >= 70} />
        <Stat label="Still due" value={stillDue} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onHome}
          className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          ← Home
        </button>
        {onStudyMore && (
          <button
            onClick={onStudyMore}
            className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Study More →
          </button>
        )}
      </div>
    </div>
  );
}
