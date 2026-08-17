// ============================================================
// useHydrationStuck.ts — bounded, read-only observation of a hydration signal
// that never resolves on its own (Task #644)
// ============================================================
// `useIsHydratedStrict` (lib/storage.ts) never resolves via HYDRATION_FAILSAFE_MS
// by design — that property is exactly what makes it safe to gate real data
// writes on (see app/study/page.tsx's Task #628 comment). But the same property
// means a genuine storage failure (Tauri disk-read error, corrupted store file,
// a permanently failing IPC call — all documented as real possibilities in
// lib/storage.ts's own comments) leaves a caller gated on it with no signal to
// ever show the user anything but an indefinite loading state.
//
// This hook does NOT unblock the strict gate — it only tells the caller when
// enough time has passed that it's safe to assume something is actually wrong,
// so the UI can offer a retry affordance instead of hanging forever. Deliberately
// a much longer window than HYDRATION_FAILSAFE_MS (3000ms): that failsafe exists
// to unblock ordinary slow-but-working hydration, whereas this timeout exists to
// distinguish "still loading" from "never going to finish."
"use client";

import { useEffect, useState } from "react";

export const HYDRATION_STUCK_TIMEOUT_MS = 15000;

export function useHydrationStuck(hydratedStrict: boolean, timeoutMs: number = HYDRATION_STUCK_TIMEOUT_MS): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // No reset-to-false branch needed: `stuck` only ever flips to true via the
    // timer below, and hydratedStrict transitions false→true at most once (a
    // real Zustand hydration completes once) — by the time that happens, a
    // caller gating render on `!hydratedStrict` has already stopped reading
    // this value. Returning early here (rather than calling setState
    // synchronously in the effect body) also avoids a cascading-render lint
    // violation for a call that would be a no-op in every reachable case.
    if (hydratedStrict) return;
    const timer = setTimeout(() => setStuck(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [hydratedStrict, timeoutMs]);

  return stuck;
}
