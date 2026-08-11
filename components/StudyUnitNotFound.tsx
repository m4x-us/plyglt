// ============================================================
// StudyUnitNotFound.tsx — "Unit not found" dead-end guard, with a real way out
// ============================================================
// Task #166 live-testing finding (2026-08-10, Windows VM): this render path is only
// reachable when `mode` stops being "interrupt" while the page is still up — the exact
// circumstances that lead there are still under investigation (logged below for the next
// occurrence), but whatever the cause, the app must never leave the user with no way out.
// Real, confirmed live impact: `enter_mandatory_mode` (src-tauri/src/interrupt.rs) sets
// set_closable(false) and set_minimizable(false) on the main window — if this render path
// is hit while that lock is still active (mode-vs-window-lock are two separate,
// unsynchronized state machines; the lock is a one-time Rust call, not tied to the
// current render's `mode`), the window's own close/minimize buttons stop working with
// zero in-app escape. A live tester's only way out was a Task Manager force-kill.
// Always calls exitMandatoryMode() before navigating home — unconditionally, not gated
// on the current (already-false, by construction) `isInterrupt` value, since that value
// cannot be trusted to reflect whether the Rust-side window lock is still active. Calling
// it when the window isn't locked is a safe no-op (resets already-normal window flags).
// ============================================================
// DEPENDS ON: @/lib/tauriInterrupt (exitMandatoryMode)
// USED BY: app/study/page.tsx
// ============================================================
"use client";

import { useEffect } from "react";
import { exitMandatoryMode } from "@/lib/tauriInterrupt";

interface StudyUnitNotFoundProps {
  mode: string | null;
  unitId: string;
  onHome: () => void;
}

export default function StudyUnitNotFound({ mode, unitId, onHome }: StudyUnitNotFoundProps) {
  // Logging is a side effect, not part of render — console.error itself is pure, but
  // Date.now() inside the log line is not, so this must run in an effect rather than
  // directly in the render body (React's "no impure calls during render" rule).
  useEffect(() => {
    console.error(
      `[ERR-STUDY-UNIT-NOT-FOUND-${Date.now()}] Reached the unit-not-found dead-end guard — ` +
        `mode=${JSON.stringify(mode)} unitId=${JSON.stringify(unitId)}`
    );
  }, [mode, unitId]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-white mb-2">Unit not found.</h1>
      <p className="text-gray-500 mb-8">This unit couldn&apos;t be loaded.</p>
      <button
        onClick={async () => {
          try {
            await exitMandatoryMode();
          } catch (err) {
            console.error(`[ERR-IPC-EXIT-${Date.now()}] exitMandatoryMode failed:`, err);
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
