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
// was wrong — `it`, the only READY:true, currently-selectable language
// (lib/langRegistry.ts), is bundled into the JS as static TypeScript content
// (hooks/useLangPack.ts's STATIC_PACKS), never fetched as `it.json` over the
// network at runtime at all; `packLoading` for it resolves to `false`
// synchronously. The widening was REVERTED to 15000ms on that basis alone —
// sufficient by itself, since no reachable-today path can make `packLoading`
// network-bound at all.
//
// Round-10 audit finding (Agent A / Agent B / Red Agent R / Agent K, 4-way
// convergent): round 9's own revert comment additionally claimed `packLoading`
// is "GUARANTEED to resolve within 20s regardless of connection speed" for a
// HYPOTHETICAL future dynamically-loaded language — false, caught by the exact
// class of error round 9 itself was fixing (Rule 23b: the fix's own new
// comment recreated the defect it closed). Two independent reasons the "~20s"
// figure understates the real bound: (1) `hooks/useLangPack.ts`'s dynamic-load
// effect chains `fetchManifest()` and `loadPack()` (a THIRD `loadPack()` for a
// specialty pack) SEQUENTIALLY via `.then()`, each independently bounded by
// `FETCH_TIMEOUT_MS` (20000ms) — not raced against one shared ceiling — plus
// up to `HYDRATION_GRACE_MS` (3000ms) before the chain even starts; (2) BOTH
// `lib/basePackLoader.ts` AND `lib/specialtyPackLoader.ts` run the identical
// unbounded cache-read step (`readCacheMeta`/`readCacheData`, backed by
// platform storage — an unbounded Tauri IPC call on desktop) BEFORE their own
// `fetchWithTimeout` call even starts, with no timeout of its own — so the
// "a THIRD `loadPack()` for a specialty pack" in point (1) means this
// unbounded stretch can occur TWICE in series (base pack's, then specialty
// pack's), not once (round-11 audit finding, Agent A: round 10's own
// correction named only the base-pack instance and omitted its byte-for-byte
// sibling in specialtyPackLoader.ts — itself a fresh instance of exactly the
// "fix generalizes to one instance, not the identical sibling" pattern this
// hook's own comment history has now shipped four rounds running). Neither
// of these facts changes today's revert decision (still correct — `it` never
// enters this path at all, so no live number is currently mistuned) — but a
// precise numeric replacement bound would be dishonest given (2) is
// structurally unbounded (twice over). Revisiting this hook once a
// dynamically-loaded language ships `ready:true` requires re-deriving the
// real bound from the actual sequential storage+fetch chain at that time —
// including BOTH loader files' unbounded cache-read steps — not reusing any
// single figure asserted here today. See .autocode/debt.md Task #378
// (sharpened round 9) for the related gap this hook's retry mechanism
// depends on for that future case (app/study/page.tsx never surfaces
// useLangPack()'s `error` field).
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
