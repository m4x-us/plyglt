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
// (hooks/useLangPack.ts) only ever transitions true→false, at most once per
// mount, same as `hydratedStrict` — a language switch reloads the whole page
// (CLAUDE.md) rather than re-triggering loading on an already-mounted hook.
//
// Round-8 audit finding (Red Agent R, CHAOS): widening the input to include
// `packLoading` also widened what "stuck" has to mean, and round 8 widened
// 15000ms -> 45000ms reasoning that a slow-connection download of the ~8.6MB
// `it.json` pack could legitimately exceed 15s. Round-9 audit finding (Red
// Agent R / Agent B / Agent A, 3-way convergent, severity 7): that reasoning
// was wrong on two independent counts, and the widening was REVERTED. (1)
// `it` — the only READY:true, currently-selectable language (lib/langRegistry.ts)
// — is bundled into the JS as static TypeScript content (hooks/useLangPack.ts's
// STATIC_PACKS), never fetched as `it.json` over the network at runtime at
// all; `packLoading` for it resolves to `false` synchronously. (2) even for a
// genuinely network-loaded pack (today only reachable once a non-static
// language ships ready:true), `lib/fetchWithTimeout.ts` hard-bounds every pack
// fetch to `FETCH_TIMEOUT_MS` (20000ms, lib/constants.ts) via an
// AbortController AND an independent Promise.race backstop — `packLoading`
// is therefore GUARANTEED to resolve to `false` (success or `download_failed`)
// within 20s regardless of connection speed. A composite `blocked` condition
// can never legitimately stay true past ~20s because of `packLoading` — only
// a genuine `hydratedStrict`/`hydrated` stall (no network dependency, should
// resolve near-instantly or never) can. Widening past that made the timeout
// structurally incapable of ever engaging for the scenario it claimed to fix,
// while tripling the wait for the one failure mode still reachable through it.
// Reverted to 15000ms — the original, correctly-reasoned value for a pure
// storage-hydration stall. Revisit only if a dynamically-loaded language ships
// `ready:true` AND real user reports show 15s is too tight for that specific
// path — at which point the fix belongs on surfacing useLangPack()'s `error`
// field (see .autocode/debt.md Task #378, sharpened this round) or a signal
// scoped to that failure mode specifically, not a blanket widening here.
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
