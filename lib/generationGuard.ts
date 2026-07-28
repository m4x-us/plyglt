// ============================================================
// GENERATION GUARD — reusable snapshot/bump/compare invalidation primitive
// ============================================================
// The "snapshot a generation at entry, bump on invalidation, refuse writes
// when the snapshot is stale" shape appeared twice in this codebase —
// basePackLoader's evictionGeneration and specialtyPackLoader's
// deactivationGeneration (Task #394) — as two hand-rolled counters. This
// module is the single shared primitive (extracted 2026-07-17, Task #378
// WorldClass remediation; AGENTS.md duplicated-logic ban).
// ============================================================
// DEPENDS ON: nothing (pure)
// USED BY: lib/basePackLoader.ts (one guard per language, eviction guard),
//          lib/specialtyPackLoader.ts (deactivationGuard, Task #394 — the two isStale
//          checks bracketing the merge now live in lib/specialtyPackMerge.ts, Task #447),
//          and store/entitlementAddOns.ts (deactivationGuard, Task #449). All three
//          adoptions are complete — none is a carry-forward.
// ============================================================

export interface GenerationGuard {
  /** Capture the current generation before starting async work. */
  snapshot(): number;
  /** True when an invalidation happened after the given snapshot was taken —
   * the holder must not write its results back to shared caches. */
  isStale(snapshot: number): boolean;
  /** Invalidate every outstanding snapshot (call BEFORE clearing the state
   * the in-flight work would otherwise resurrect). */
  bump(): void;
}

export function createGenerationGuard(): GenerationGuard {
  let generation = 0;
  return {
    snapshot: () => generation,
    isStale: (snapshot: number) => snapshot !== generation,
    bump: () => { generation++; },
  };
}
