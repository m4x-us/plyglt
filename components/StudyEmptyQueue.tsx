// ============================================================
// StudyEmptyQueue.tsx — "Nothing ready" empty state for the study queue
// ============================================================
// Extracted from app/study/page.tsx under the Rule 1 150-line route cap.
// ============================================================
// DEPENDS ON: @/lib/tauriInterrupt (exitMandatoryMode)
// USED BY: app/study/page.tsx
// ============================================================
"use client";

import { exitMandatoryMode } from "@/lib/tauriInterrupt";

interface StudyEmptyQueueProps {
  isInterrupt: boolean;
  onHome: () => void;
}

export default function StudyEmptyQueue({ isInterrupt, onHome }: StudyEmptyQueueProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-green-400 mb-2">Nothing ready.</h1>
      <p className="text-gray-500 mb-8">Check back later.</p>
      <button
        onClick={async () => {
          if (isInterrupt) {
            try {
              await exitMandatoryMode();
            } catch (err) {
              console.error(`[ERR-IPC-EXIT-${Date.now()}] exitMandatoryMode failed:`, err);
            }
          }
          onHome();
        }}
        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
      >
        ← Home
      </button>
    </div>
  );
}
