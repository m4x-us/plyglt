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
// so the UI can offer a retry affordance instead of hanging forever.
//
// Round-7 audit finding (Agent W / Red Agent R, convergent, severity 7): the
// first version of this hook took only `hydratedStrict` as input, but its real
// (and only) caller gates its loading screen on a 3-way OR
// (`!hydrated || packLoading || !hydratedStrict`). If `hydratedStrict` resolved
// but `packLoading` was the one still stuck, the hook never observed it. Fix:
// this hook takes whichever single boolean the caller's own gate condition
// evaluates to — the caller is responsible for combining its own conditions
// before calling in, so the "caller has stopped reading this value once the
// gate opens" invariant below is true by construction. Verified safe against a
// re-triggering `blocked` (true→false→true within one mount): `packLoading`
// (hooks/useLangPack.ts) only ever transitions true→false, exactly once per
// mount, same as `hydratedStrict` — a language switch reloads the whole page
// (CLAUDE.md) rather than re-triggering loading on an already-mounted hook.
//
// Round-8 audit finding (Red Agent R, CHAOS, severity 7): widening the input to
// include `packLoading` also widened what "stuck" has to mean. The original
// 15000ms was tuned for HYDRATION_FAILSAFE_MS-adjacent local storage stalls —
// no network dependency, should resolve near-instantly or never. `packLoading`
// is a network fetch of `public/packs/{lang}.json` (~8.6MB uncompressed for
// `it`, and CURRICULUM.md documents the curriculum still actively growing) —
// on an ordinary (not even "slow") 3G connection, downloading that much data
// can legitimately take well over 15s, even accounting for gzip/brotli
// compression on JSON. The old threshold would show "Couldn't load your
// progress" — and its Retry button would restart the identical slow fetch —
// for users who are simply on a slow connection with a load that's genuinely
// still progressing. Fixed: widened to accommodate a realistic slow-connection
// pack download while still bounding a truly dead connection under a minute.
"use client";

import { useEffect, useState } from "react";

export const HYDRATION_STUCK_TIMEOUT_MS = 45000;

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
