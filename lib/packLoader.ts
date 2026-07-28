// ============================================================
// packLoader.ts — Fetches, verifies, and caches language pack JSON files with sha256 integrity
// ============================================================
/**
 * packLoader.ts — Fetches, verifies, and caches language pack JSON files.
 *
 * Depends on: @/lib/langRegistry (canonical ready/valid predicates + registry constants),
 *             @/lib/specialtyPackLoader (specialty pack merge path),
 *             @/lib/basePackLoader (storage/network load mechanics + eviction guard —
 *             the Rule 1 extraction this file delegates to),
 *             @/lib/packCache (memCache + cache clearing), @/lib/packTypes (types)
 * Used by:    hooks/useLangPack.ts (via lib/packResolver.ts for load orchestration),
 *             store/entitlementStore.ts (evictPack, getLoadedAddOns)
 *
 * Storage hierarchy (fastest → slowest):
 *   1. In-memory cache (PackMemCache) — per-session, zero-latency
 *   2. Platform storage                — Tauri Store (desktop) or localStorage (web)
 *   3. Network download                — fetch from /packs/{lang}.json
 *
 * Security: loadPack validates lang against READY_PACK_CODES and SPECIALTY_PACKS
 * with ready:true (fail fast — unready and unknown codes return "invalid_lang" before
 * any network request). evictPack validates against isValidPackCode/ALL_PACK_CODES.
 * Both guards prevent path traversal and storage key poisoning.
 *
 * Specialty packs: loadPack("it-medical") merges the add-on's units into the base
 * ("it") pack in memCache. Merged units are additive — base units are never removed.
 * loadedAddOns tracks which add-ons are merged this session.
 *
 * Italian is served from statically-bundled content, bypassing loadPack entirely —
 * useLangPack.ts calls seedMemCache("it", units) so that memCache["it"] exists and the
 * specialty-pack precondition (memCache.has(baseLang)) can be satisfied. SPECIALTY_PACKS
 * currently holds one entry (it-medical, ready:false) — the ready gate, not emptiness,
 * keeps the specialty branch dormant until real specialty content ships. (#378 audit F008;
 * the wider stale-doc sweep is Task #382.)
 *
 * Public API: loadPack, getLoadedAddOns, evictPack, seedMemCache, fetchManifest, clearCacheForTesting
 *
 * Low-level cache I/O lives in lib/packCache.ts (extracted Task #275 to satisfy the
 * 400-line service cap — Rule 1, AGENTS.md/philosophy.md).
 *
 * Comment reference convention: #NNN cites a task; FNNN / K2-* / N* / F-C2-* cite audit
 * findings. Resolve any of them via `git log -S "<ref>"` or the .autocode/ history — the
 * inline text always carries the WHY on its own even if the citation is lost.
 */

import { isReadyBasePackCode, FREE_PACK_CODES, SPECIALTY_PACKS, isSpecialtyPackCode, isRegisteredSpecialtyCode, isValidPackCode, LANG_CONFIG_MAP, type PackCode } from "@/lib/langRegistry";
import type { Unit } from "@/content/types";
import { loadSpecialtyPack, clearSpecialtyCache } from "@/lib/specialtyPackLoader";
export { getLoadedAddOns } from "@/lib/specialtyPackLoader";
// Storage/network load mechanics + eviction-generation guard live in lib/basePackLoader.ts
// (Rule 1 extraction, #378 remediation). That module's loader is exported for THIS file only.
import { loadBasePackFromStorageOrNetwork, bumpEvictionGeneration } from "@/lib/basePackLoader";
import type { LoadPackOptions } from "@/lib/basePackLoader";
export type { LoadPackOptions } from "@/lib/basePackLoader";
import type { Manifest, Pack, LoadPackResult } from "@/lib/packTypes";
export type { PackMeta, Manifest, Pack, LoadPackResult } from "@/lib/packTypes";
import { memCache, clearPackCache, clearPackCacheState } from "@/lib/packCache";

// ── Pack URL helpers ──────────────────────────────────────────────────────────

function manifestUrl(): string {
  return `/packs/manifest.json`;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Multiple useLangPack instances mount concurrently in production (InterruptHandler in the
// global layout plus page components) and each triggers a manifest fetch on mount — share
// one in-flight request so N instances cost one network round-trip, mirroring the base-pack
// dedup below. Cleared on settle so a later refresh still refetches. (#378 WorldClass V2)
let inFlightManifest: Promise<Manifest | null> | null = null;

/**
 * Structural gate for the manifest (#379): a CDN can return an HTTP-200 error envelope
 * (valid JSON, wrong shape) that the former bare `as Manifest` cast waved through — loadPack
 * then saw packs === undefined and silently skipped sha256 verification for the session.
 * Checks exactly the fields loadPack consumes: a packs object whose every entry carries a
 * string version and sha256. Anything else is "no manifest" — same degradation as a network
 * failure, but LOGGED (Rule 8).
 */
function isValidManifestShape(raw: unknown): raw is Manifest {
  if (typeof raw !== "object" || raw === null) return false;
  const packs = (raw as { packs?: unknown }).packs;
  // Arrays satisfy typeof "object", and .every() is vacuously true on empty collections —
  // either would pass a truncated/wrong body and reproduce the exact silent-skip failure
  // this gate exists to close. The real exporter always emits ≥1 entry, so an empty packs
  // record is treated as malformed, not as a valid empty manifest. (#379 spot check DSC-2)
  if (typeof packs !== "object" || packs === null || Array.isArray(packs)) return false;
  if (Object.keys(packs).length === 0) return false;
  return Object.values(packs).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { version?: unknown }).version === "string" &&
      typeof (entry as { sha256?: unknown }).sha256 === "string"
  );
}

/**
 * Fetches, parses, and shape-validates the pack manifest. Concurrent callers share one
 * request. Returns null when the network is unavailable, the server errors, or the body is
 * not a structurally valid manifest — every null path logs a ref ID (a silent null makes
 * loadPack skip SHA-256 verification, which is a security downgrade).
 */
export function fetchManifest(): Promise<Manifest | null> {
  if (inFlightManifest) return inFlightManifest;
  const request = (async (): Promise<Manifest | null> => {
    try {
      const res = await fetch(manifestUrl(), { cache: "no-store" });
      if (!res.ok) {
        // #379: this branch previously returned null with zero logging, unlike the catch
        // below — an operator had no signal that every fresh download was unverified.
        console.error(`[MANIFEST_FETCH_HTTP-${res.status}-${Date.now()}] manifest request failed — loads consuming this result fall back to unverified downloads`);
        return null;
      }
      const raw: unknown = await res.json();
      if (!isValidManifestShape(raw)) {
        console.error(`[MANIFEST_SHAPE_INVALID-${Date.now()}] manifest body parsed but failed structural validation — treating as no manifest; loads consuming this result fall back to unverified downloads`);
        return null;
      }
      return raw;
    } catch (err) {
      // Log before returning null — a silent network error here causes loadPack to skip
      // SHA-256 verification, which is a silent security downgrade. Ref ID aids diagnosis.
      console.error(`[MANIFEST_FETCH_FAIL-${Date.now()}]`, err);
      return null;
    }
  })();
  inFlightManifest = request;
  const release = () => { if (inFlightManifest === request) inFlightManifest = null; };
  void request.then(release, release);
  return request;
}

// Shared-promise registry for in-flight base-pack loads, keyed by lang. Entries are removed
// by their own promise's compare-and-delete handler above (then(cb, cb) — robust to both
// settlement outcomes). basePackLoader's declared failure paths all return { ok: false }
// results rather than rejecting; cleanup does not depend on that holding. Post-eviction
// note (#378 cycle-2 N4): evictPack also drops the evicted lang's entry so NEW callers
// re-load fresh; callers already attached to the old promise are still served the
// pre-eviction bytes uncached — entitlement-safe because every caller passed its own
// gates before reaching the map. (#378)
const inFlightBaseLoads = new Map<string, Promise<LoadPackResult>>();

/**
 * Loads a pack for the given language code.
 *
 * Strategy (in order):
 * 0. Validation gates — ready-code allowlist, specialty delegation, base-pack entitlement.
 * 1. Memory cache hit — return immediately (same-session repeated calls).
 * 2. In-flight dedup — a concurrent load for the same lang shares one promise (#378).
 * 3. Platform storage hit with valid version — return from storage.
 * 4. Download → verify sha256 → write to storage → cache in memory → return.
 * 5. If download fails but a cached (possibly stale) version exists → re-verify it against
 *    the sha256 recorded at cache time when one exists (shape-validation only otherwise),
 *    then return it (offline graceful degradation).
 */
export async function loadPack(
  lang: string,
  manifest: Manifest | null,
  options?: LoadPackOptions
): Promise<LoadPackResult> {
  // Accept ready base packs and ready specialty packs — both via the registry's canonical
  // predicates. Reject everything else: unknown codes (path traversal) and
  // registered-but-unready packs. "invalid_lang" is distinct from "download_failed" so
  // callers never retry unknown codes. (#266 removed the inline specialty predicate;
  // Task #378 WorldClass removed the inline base predicate the same way.)
  const isReadyBasePack = isReadyBasePackCode(lang);
  const isReadySpecialtyPack = isSpecialtyPackCode(lang);
  if (!isReadyBasePack && !isReadySpecialtyPack) {
    return { ok: false, error: "invalid_lang" };
  }

  // ── Specialty pack path ────────────────────────────────────────────────────
  // Delegated to lib/specialtyPackLoader.ts. memCache is passed so the add-on
  // units can be merged into the already-loaded base pack entry.
  // purchasedAddOns is threaded through so loadSpecialtyPack can enforce the
  // client-side entitlement gate (Task #261).
  if (isReadySpecialtyPack) {
    return loadSpecialtyPack(lang, memCache, manifest, options?.purchasedAddOns ?? []);
  }

  // ── Base-pack entitlement check ───────────────────────────────────────────
  // Task #350: mirrors the specialty-pack purchasedAddOns gate for defense-in-depth.
  // Free packs (FREE_PACK_CODES) are always loadable. Non-free packs require the caller
  // to pass unlockedLangs containing the lang code. The primary gate is the UI layer
  // (LanguageGrid.tsx, app/page.tsx — isPackUnlocked); this is a secondary loader-layer
  // guard so the asymmetry with the specialty-pack path is eliminated.
  const isFreePack = FREE_PACK_CODES.some(c => c === lang);
  if (!isFreePack && !(options?.unlockedLangs ?? []).includes(lang)) {
    return { ok: false, error: "invalid_lang" };
  }

  // 1. Memory hit — fastest path, avoids all storage I/O
  if (!options?.forceRedownload && memCache.has(lang)) {
    return { ok: true, pack: memCache.get(lang)! };
  }

  // 2. In-flight dedup (#378): the memCache.has() check above is a TOCTOU gap — two
  // concurrent calls (StrictMode double-invoke, specialty base-load racing a direct load)
  // both see a miss and both download; the later write would clobber a specialty merge
  // performed in between (memCache.write clears specialty tracking for the lang). Sharing
  // one promise per lang closes the double-write class for every pairing: a non-forced
  // call consumes any in-flight promise, and a forced load REGISTERS its own promise
  // (without consuming — a forced caller demands fresh bytes) so later non-forced callers
  // piggyback on it instead of starting a competing write (#378 audit F010).
  if (!options?.forceRedownload) {
    const inFlight = inFlightBaseLoads.get(lang);
    if (inFlight) return inFlight;
  } else {
    // A forced load supersedes any already-pending normal load's right to cache: bump the
    // generation so the pending load (whose snapshot is now stale) skips its writes and
    // cannot clobber the forced load's fresh bytes if it settles later (#378 cycle-2 N3).
    // The forced load itself snapshots AFTER this bump, so its own writes land.
    bumpEvictionGeneration();
  }
  const load = loadBasePackFromStorageOrNetwork(lang, manifest, options);
  inFlightBaseLoads.set(lang, load);
  // Compare-and-delete: a forced load may have replaced this entry — only the entry's own
  // owner removes it, mirroring specialtyPackLoader's inFlight cleanup. then(cb, cb) rather
  // than .finally(): a bare void .finally() chain would surface a global unhandledrejection
  // if a future basePackLoader path ever rejected — cleanup must never add an error as a
  // side effect (poka-yoke; #378 cycle-2 K2-005).
  const releaseSlot = () => {
    if (inFlightBaseLoads.get(lang) === load) inFlightBaseLoads.delete(lang);
  };
  void load.then(releaseSlot, releaseSlot);
  return load;
}

/**
 * Seeds memCache with a synthetic Pack built from statically-bundled units.
 *
 * Italian (lang="it") is served from STATIC_PACKS in useLangPack.ts, bypassing loadPack
 * entirely — so memCache never gets an "it" entry via the normal load path. Without this
 * seed, loadSpecialtyPack's memCache.has(baseLang) precondition can never be satisfied for
 * any it-* specialty pack, making the entire specialty-pack architecture unreachable for the
 * only language that currently has content. (#296 — Option A chosen over Option B: Option B
 * would redesign loadSpecialtyPack's precondition inside lib/specialtyPackLoader.ts, which
 * is more invasive and harder to reason about; Option A seeds memCache as a cheap side-effect
 * of the existing static-pack fast path, leaving specialtyPackLoader.ts's contract unchanged.)
 *
 * Idempotent: no-ops when lang is already in memCache (a network-loaded entry must not be
 * overwritten by this synthetic one — whichever path populated memCache first is authoritative).
 *
 * Returns true when memCache holds the lang on exit (seeded now, or already present);
 * false when the write was rejected by a guard. A void return hid the refusal from callers
 * entirely — the first symptom was a causally-distant base_pack_not_loaded (#378 cycle-2
 * naive finding; Rule 8).
 *
 * Called by: hooks/useLangPack.ts — static-pack languages and specialty base seeding.
 */
export function seedMemCache(lang: string, units: Unit[]): boolean {
  // Task #337: guard against unregistered/unready codes — memCache must only ever
  // contain validated pack codes (defense-in-depth for the specialty precondition check).
  if (!isReadyBasePackCode(lang)) {
    console.error(`[ERR-SEED-INVALID-LANG-${lang}] seedMemCache called with unregistered or unready lang — write rejected`);
    return false;
  }
  // #378 audit F013: seeding has no entitlement context, so it must only ever populate
  // FREE packs. A non-free statically-bundled language would otherwise be seedable by the
  // specialty flow, and the specialty merge returns the FULL base pack — owning only the
  // add-on would grant the whole base language. Fail closed now so extending STATIC_PACKS
  // to a paid language forces an explicit entitlement-aware design instead of silently
  // reopening this hole.
  if (!FREE_PACK_CODES.some(c => c === lang)) {
    console.error(`[ERR-SEED-NONFREE-LANG-${lang}] seedMemCache called with a non-free lang — entitlement-blind seeding is restricted to FREE_PACK_CODES; write rejected`);
    return false;
  }
  if (memCache.has(lang)) return true;
  const config = LANG_CONFIG_MAP[lang] as (typeof LANG_CONFIG_MAP)[string] | undefined;
  const pack: Pack = {
    _version: 1,
    lang,
    packVersion: "static",
    canonicalSource: "en",
    name:       config?.name       ?? lang,
    nativeName: config?.nativeName ?? lang,
    flag:       config?.flag       ?? "",
    unitCount: units.length,
    cardCount: units.reduce((acc, u) => acc + u.cards.length, 0),
    units,
  };
  memCache.write(lang, pack);
  return true;
}

/** Result of evictPack (#398): a fulfilled promise alone no longer hides a no-op — the
 * result says exactly what happened, so callers can branch instead of parsing console
 * output. `useInstead` names the base language whose eviction clears a specialty code's
 * merged units. Discriminant is `evicted` (not LoadPackResult's `ok`): this is a
 * did-the-side-effect-happen report, not a data-or-error result. `fullyClean` (Task #415)
 * distinguishes a genuine, complete eviction from one where memCache was cleared but a
 * storage removal failed and logged (lib/packCache.ts's clearPackCache never rejects, so
 * this is the only way a caller can learn a residue was left behind). Lives here rather
 * than lib/packTypes.ts only because that file is owned by a concurrent stream this wave —
 * relocation tracked in stream debt. */
export type EvictPackResult =
  | { evicted: true; fullyClean: boolean }
  | { evicted: false; reason: "specialty_code"; useInstead: PackCode }
  | { evicted: false; reason: "unregistered_code" };

/**
 * Evicts a base language pack from memory and platform storage
 * (e.g. after purchase reversal or manual reset). clearPackCache also prunes any specialty
 * add-ons merged into this base pack — see its doc comment.
 *
 * Guard uses isValidPackCode (ALL_PACK_CODES = base pack codes only: "it" | "es").
 * Specialty pack codes are rejected — they cannot be evicted individually because their
 * units live merged inside the base pack's memCache entry. To evict a specialty add-on,
 * evict its base language pack (which prunes it via clearPackCache → clearSpecialtyPacksForLang).
 * Unregistered codes are also rejected to prevent clearPackCache from operating on poisoned
 * storage key namespaces. (#268)
 *
 * Caller contract (#325 → #398 → #415): the returned Promise ALWAYS resolves — evictPack
 * itself never rejects, because clearPackCache never rejects (it swallows every storage
 * failure internally via Promise.allSettled + logs, lib/packCache.ts). A caller that needs
 * to know whether a storage failure occurred (not just whether memCache was cleared) MUST
 * check `.fullyClean`, not wrap the call in try/catch — nothing here ever throws. The
 * former #325 caveat ("callers must not infer eviction from a fulfilled promise") is now
 * enforced by type: check `.evicted` (and, for the genuine-eviction branch, `.fullyClean`).
 * Rejected inputs log one warn each (#271/#341) — the previous second, escalated error log
 * existed only because the no-op was invisible to callers; the typed result is that signal
 * now (also resolves the #402 double-log finding).
 */
export async function evictPack(lang: string): Promise<EvictPackResult> {
  if (!isValidPackCode(lang)) {
    // Task #271: log specialty codes — a silent no-op violates Rule 8 (Log Everything).
    // Specialty packs cannot be evicted individually; evict the base language pack, which
    // prunes them via clearPackCache → clearSpecialtyPacksForLang.
    // Task #407: gate via the shared isRegisteredSpecialtyCode predicate; the non-null
    // assertion on the lookup below is safe because the gate already proved membership.
    if (isRegisteredSpecialtyCode(lang)) {
      const match = SPECIALTY_PACKS.find(sp => sp.code === lang)!;
      console.warn(`[evictPack] "${lang}" is a specialty pack — cannot be evicted individually; evict the base language pack ("${match.baseLang}") instead`);
      return { evicted: false, reason: "specialty_code", useInstead: match.baseLang };
    }
    // Task #341: fully unregistered code — log so callers know nothing was evicted.
    console.warn(`[evictPack] "${lang}" is not a registered base pack or specialty pack code — no-op`);
    return { evicted: false, reason: "unregistered_code" };
  }
  // #378 audit F001: bump BEFORE clearing so any base-pack load already in flight sees a
  // stale generation snapshot and skips its cache writes — an in-flight load must never
  // resurrect the pack this eviction is about to clear. Placed AFTER the validation guard
  // (WorldClass V4): a rejected no-op call must not void every in-flight load's caching
  // rights globally.
  bumpEvictionGeneration();
  // #378 cycle-2 N4: drop the evicted lang's in-flight entry so NEW callers start a fresh,
  // gate-checked load instead of piggybacking on the pre-eviction promise. Already-attached
  // callers still receive that promise's (uncached) result — see the registry doc above.
  inFlightBaseLoads.delete(lang);
  const fullyClean = await clearPackCache(lang);
  return { evicted: true, fullyClean };
}

/**
 * Resets all in-memory and storage state.
 * @internal Test use only — do not call in application code.
 */
export function clearCacheForTesting(): void {
  clearPackCacheState();  // resets memCache and _storage (lib/packCache.ts)
  clearSpecialtyCache();  // resets loadedAddOns and inFlight (lib/specialtyPackLoader.ts)
  inFlightBaseLoads.clear();  // resets base-pack load dedup (#378)
  // #378 cycle-2 F-C2-6: a load left in flight by a previous test must not write into the
  // cache this reset just cleared — same resurrection class evictPack guards against.
  bumpEvictionGeneration();
}
