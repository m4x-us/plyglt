// ============================================================
// PACK RESOLVER — pure orchestration: resolve a target lang (base, static, or
// specialty) into a single load result
// ============================================================
// The decision logic for WHAT to load in WHICH order lived inline in
// useLangPack's effect (~30 lines of branching) — business logic in a hook,
// testable only through renderHook/jsdom. Extracted here as a pure function
// (Task #378 WorldClass remediation) so the branching is unit-testable in
// node and the hook shrinks to wiring.
//
// Dependencies are INJECTED (io parameter) rather than imported so that:
// (a) this module stays trivially unit-testable with plain fakes, and
// (b) hooks/useLangPack.test.ts — which mocks @/lib/packLoader at the module
//     level — keeps exercising the REAL resolver against those mocks.
// ============================================================
// DEPENDS ON: @/lib/langRegistry (SPECIALTY_PACKS), @/lib/packTypes (types),
//             @/lib/basePackLoader (LoadPackOptions type only), @/content/types (Unit type)
// USED BY: hooks/useLangPack.ts; tests/packResolver.test.ts
// ============================================================

import { SPECIALTY_PACKS } from "@/lib/langRegistry";
import type { Manifest, LoadPackResult } from "@/lib/packTypes";
import type { LoadPackOptions } from "@/lib/basePackLoader";
import type { Unit } from "@/content/types";

export interface StaticPackEntry {
  units: Unit[];
  unitMap: Record<string, Unit>;
}

/** The two loader primitives the resolver orchestrates — injected by the caller. */
export interface PackResolverIO {
  loadPack: (lang: string, manifest: Manifest | null, options?: LoadPackOptions) => Promise<LoadPackResult>;
  seedMemCache: (lang: string, units: Unit[]) => boolean;
}

/** baseFailed distinguishes a propagated BASE-pack failure from the target pack's own
 * failure so the UI can pick an accurate message — a base failure must never surface as
 * an add-on purchase prompt (#378 audit F007). */
export interface ResolvedLoad {
  result: LoadPackResult;
  baseFailed: boolean;
}

/**
 * Loads targetLang, first satisfying a specialty pack's base-pack precondition.
 *
 * A full-page reload wipes memCache before any load runs (app/page.tsx's handleSelect
 * navigates via window.location.href), so loadSpecialtyPack's memCache.has(baseLang)
 * precondition fails unconditionally unless the base pack is seeded (static) or loaded
 * (network) here, post-reload, before the specialty pack is requested. Seeding at
 * selection time, pre-reload, would be wiped and is worthless. (#378)
 *
 * Branches:
 * - Non-specialty target → single loadPack call.
 * - Specialty with a statically-bundled base → synchronous seed (idempotent,
 *   check-before-write in seedMemCache), then load the specialty code.
 * - Specialty with a network base → await the base load; on failure propagate the base
 *   result with baseFailed:true and never request the specialty code (calling it would
 *   only re-derive a less specific base_pack_not_loaded and discard the real cause).
 *   Reachability: no registered specialty pack has a network base today (it-medical →
 *   static "it") — the branch activates the moment such a pack flips ready:true in the
 *   registry, with no code change here; covered by registry-injected tests until then.
 *
 * Only ready specialty entries participate (sp.ready) — an unready code is unloadable
 * downstream and must not trigger base seeding/loading (#378 audit F011).
 */
export async function resolveTargetPack(
  targetLang: string,
  manifest: Manifest | null,
  options: LoadPackOptions,
  staticPacks: Record<string, StaticPackEntry>,
  io: PackResolverIO
): Promise<ResolvedLoad> {
  const spec = SPECIALTY_PACKS.find((sp) => sp.code === targetLang && sp.ready);
  if (!spec) {
    return { result: await io.loadPack(targetLang, manifest, options), baseFailed: false };
  }
  const baseLang = spec.baseLang;
  const staticBase = staticPacks[baseLang];
  if (staticBase) {
    // A refused seed (non-free or unready base — seedMemCache fails closed) means the
    // specialty precondition CANNOT be satisfied: surface base_pack_not_loaded here,
    // immediately and attributably, instead of letting loadSpecialtyPack rediscover it
    // as a causally-distant failure. This is the reason seedMemCache returns boolean.
    if (!io.seedMemCache(baseLang, staticBase.units)) {
      return { result: { ok: false, error: "base_pack_not_loaded" }, baseFailed: true };
    }
    return { result: await io.loadPack(targetLang, manifest, options), baseFailed: false };
  }
  const baseResult = await io.loadPack(baseLang, manifest, options);
  if (!baseResult.ok) {
    return { result: baseResult, baseFailed: true };
  }
  return { result: await io.loadPack(targetLang, manifest, options), baseFailed: false };
}
