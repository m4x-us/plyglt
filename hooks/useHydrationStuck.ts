// ============================================================
// useHydrationStuck.ts — bounded, read-only observation of a loading condition
// that isn't guaranteed to resolve on its own (Task #644)
// ============================================================
// `useIsHydratedStrict` (lib/storage.ts) never resolves via HYDRATION_FAILSAFE_MS
// by design — that property is exactly what makes it safe to gate real data
// writes on (see app/study/page.tsx's Task #628 comment). But the same property
// means a genuine storage failure (Tauri disk-read error, corrupted store file,
// a permanently failing IPC call — all documented as real possibilities in
// lib/storage.ts's own comments) leaves a caller gated on it with no signal to
// ever show the user anything but an indefinite loading state.
//
// This hook does NOT unblock the caller's gate — it only tells the caller when
// enough time has passed that it's safe to assume something is actually wrong,
// so the UI can offer a retry affordance instead of hanging forever. Deliberately
// a much longer window than HYDRATION_FAILSAFE_MS (3000ms): that failsafe exists
// to unblock ordinary slow-but-working hydration, whereas this timeout exists to
// distinguish "still loading" from "never going to finish."
//
// Round-7 audit finding (Agent W / Red Agent R, convergent, severity 7): the
// first version of this hook took only `hydratedStrict` as input, but its real
// (and only) caller gates its loading screen on a 3-way OR
// (`!hydrated || packLoading || !hydratedStrict`). If `hydratedStrict` resolved
// but `packLoading` was the one still stuck, the hook never observed it — either
// the screen hung with no retry (packLoading was the one hanging) or, worse, a
// `stuck=true` latched from an earlier `hydratedStrict` stall never cleared once
// `hydratedStrict` resolved, showing a hydration-specific retry message for an
// unrelated, still-pending pack-loading condition. Fix: this hook takes whichever
// single boolean the caller's own gate condition evaluates to — the caller is
// responsible for combining its own conditions before calling in, so the
// "caller has stopped reading this value once the gate opens" invariant below is
// true by construction rather than by an assumption about what the gate contains.
"use client";

import { useEffect, useState } from "react";

export const HYDRATION_STUCK_TIMEOUT_MS = 15000;

export function useHydrationStuck(blocked: boolean, timeoutMs: number = HYDRATION_STUCK_TIMEOUT_MS): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // No reset-to-false branch needed: `stuck` only ever flips to true via the
    // timer below, and `blocked` going false means the caller's own gate has
    // opened — by construction, a caller gating render on `blocked` has already
    // stopped reading this value once that happens. Returning early here
    // (rather than calling setState synchronously in the effect body) also
    // avoids a cascading-render lint violation for a call that would be a no-op
    // in every reachable case.
    if (!blocked) return;
    const timer = setTimeout(() => setStuck(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [blocked, timeoutMs]);

  return stuck;
}
