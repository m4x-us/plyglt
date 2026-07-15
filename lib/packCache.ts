// ============================================================
// packCache.ts — In-memory cache and platform storage I/O for language packs.
// ============================================================
/**
 * packCache.ts — In-memory cache and platform storage I/O for language packs.
 *
 * Owns:
 *   - PackMemCacheImpl / memCache — session-scoped in-memory cache singleton
 *   - loadedAddOns bookkeeping — which specialty codes are merged this session (#328)
 *   - Platform storage helpers — read/write/clear pack JSON and metadata
 *   - Parse/validate/cache helpers — shared tails for all loadPack origins
 *
 * No React. No Zustand imports.
 *
 * Used by: lib/packLoader.ts (primary consumer), lib/specialtyPackLoader.ts
 *   (imports readCacheMeta, writeCacheMeta, readCacheData, writeCacheData, clearPackCache,
 *   isAddOnLoaded, markAddOnLoaded, clearLoadedAddOns; re-exports getLoadedAddOns).
 *
 * Import history note (#328): packCache previously imported clearSpecialtyPacksForLang from
 * lib/specialtyPackLoader.ts, creating a genuine circular ES-module dependency (each file
 * imported from the other). Breaking the cycle required moving loadedAddOns and its management
 * functions here — they are cache state (tracking what is merged into memCache) and belong
 * alongside the other cache-state operations already in this file.
 */

import { createPlatformStorage } from "@/lib/storage";
import { SPECIALTY_PACKS } from "@/lib/langRegistry";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack, LoadPackResult, PackMemCache } from "@/lib/packTypes";

// ── Cache metadata shape ──────────────────────────────────────────────────────

export interface CachedPackMeta {
  version: string;
  sha256: string;
  cachedAt: number;
}

// ── Specialty add-on tracking ─────────────────────────────────────────────────
//
// Moved from lib/specialtyPackLoader.ts (#328) to break the circular ES-module dependency.
// These are cache state — they track which specialty packs are merged into memCache this session.
// Updating them atomically with cache writes (which already live here) is the correct ownership.

const loadedAddOns: string[] = [];

/** Returns a copy of the specialty pack codes currently merged into memCache this session. */
export function getLoadedAddOns(): string[] {
  return [...loadedAddOns];
}

/** Returns whether a specialty pack code has been merged into memCache this session. */
export function isAddOnLoaded(lang: string): boolean {
  return loadedAddOns.includes(lang);
}

/** Records that a specialty pack code has been merged into memCache. */
export function markAddOnLoaded(lang: string): void {
  loadedAddOns.push(lang);
}

/**
 * Clears all session add-on tracking without touching memCache or platform storage.
 * Called by specialtyPackLoader.clearSpecialtyCache (for the entitlementStore eviction flow
 * and the packLoader.clearCacheForTesting path — both of which independently manage memCache
 * and storage eviction separately).
 */
export function clearLoadedAddOns(): void {
  loadedAddOns.length = 0;
}

/**
 * Removes from loadedAddOns every specialty code whose baseLang matches the given base pack.
 * Returns the list of pruned codes so the caller can also clear their storage keys.
 * Called by PackMemCacheImpl.write() (base pack replaced in-memory) and clearPackCache()
 * (base pack fully evicted including storage) — both below in this file.
 */
export function clearSpecialtyPacksForLang(baseLang: string): string[] {
  const codesForBase = new Set(
    SPECIALTY_PACKS.filter(sp => sp.baseLang === baseLang).map(sp => sp.code),
  );
  const pruned: string[] = [];
  for (let i = loadedAddOns.length - 1; i >= 0; i--) {
    if (codesForBase.has(loadedAddOns[i]!)) {
      pruned.push(loadedAddOns[i]!);
      loadedAddOns.splice(i, 1);
    }
  }
  return pruned;
}

// ── In-memory cache ───────────────────────────────────────────────────────────
//
// Implements PackMemCache (lib/packTypes.ts) — see that interface's doc comment for why `write`
// and `merge` exist instead of a generic `set`. This is the only place that constructs the
// underlying Map; every other file (lib/specialtyPackLoader.ts) only ever sees the narrow
// interface, never the raw Map, so it cannot call an unguarded `.set(...)`.
class PackMemCacheImpl implements PackMemCache {
  private readonly map = new Map<string, Pack>();

  has(lang: string): boolean {
    return this.map.has(lang);
  }

  get(lang: string): Pack | undefined {
    return this.map.get(lang);
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }

  write(lang: string, pack: Pack): void {
    const pruned = clearSpecialtyPacksForLang(lang);
    this.map.set(lang, pack);
    // Fire-and-forget: in-memory state above is already correct; storage cleanup is best-effort.
    // Errors are logged inside _clearSpecialtyStorageKeys — nothing is silently swallowed. (#346)
    void _clearSpecialtyStorageKeys(pruned, "WRITE");
  }

  merge(lang: string, mergedPack: Pack): void {
    this.map.set(lang, mergedPack);
  }

  delete(lang: string): void {
    this.map.delete(lang);
  }

  clear(): void {
    this.map.clear();
  }
}

export const memCache: PackMemCache = new PackMemCacheImpl();

// ── Platform storage (lazy singleton) ─────────────────────────────────────────

let _storage: ReturnType<typeof createPlatformStorage> | null = null;

function getStorage() {
  if (!_storage) {
    // Single Tauri Store file for all packs — avoids one file-open per language
    _storage = createPlatformStorage("pack-cache");
  }
  return _storage;
}

// ── Storage key constants ─────────────────────────────────────────────────────

const CACHE_META_PREFIX = "pack-meta-v1-";
const CACHE_DATA_PREFIX = "pack-data-v1-";

// ── Async storage helpers ─────────────────────────────────────────────────────

export async function readCacheMeta(lang: string): Promise<CachedPackMeta | null> {
  try {
    const raw = await getStorage().getItem(CACHE_META_PREFIX + lang);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPackMeta;
  } catch (err) {
    console.error(`[ERR-CACHE-META-${Date.now()}]`, err);
    return null;
  }
}

export async function writeCacheMeta(lang: string, meta: CachedPackMeta): Promise<void> {
  await getStorage().setItem(CACHE_META_PREFIX + lang, JSON.stringify(meta));
}

export async function readCacheData(lang: string): Promise<string | null> {
  try {
    return await getStorage().getItem(CACHE_DATA_PREFIX + lang);
  } catch (err) {
    console.error(`[ERR-CACHE-DATA-${Date.now()}]`, err);
    return null;
  }
}

export async function writeCacheData(lang: string, json: string): Promise<void> {
  await getStorage().setItem(CACHE_DATA_PREFIX + lang, json);
}

// Clears the persisted storage keys for each pruned specialty code.
// Called from PackMemCacheImpl.write() (fire-and-forget — in-memory state is already correct;
// storage cleanup is best-effort, errors are logged) and from clearPackCache() (awaited —
// full eviction must leave no orphaned bytes on disk).
async function _clearSpecialtyStorageKeys(prunedCodes: string[], context: "WRITE" | "CLEAR"): Promise<void> {
  if (prunedCodes.length === 0) return;
  const results = await Promise.allSettled(
    prunedCodes.flatMap(code => [
      getStorage().removeItem(CACHE_META_PREFIX + code),
      getStorage().removeItem(CACHE_DATA_PREFIX + code),
    ]),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const code = prunedCodes[Math.floor(i / 2)]!;
      const keyType = i % 2 === 0 ? "meta" : "data";
      console.error(
        `[ERR-CACHE-${context}-SPECIALTY-${keyType.toUpperCase()}-${code}-${Date.now()}] storage removeItem failed — ${keyType} key may persist`,
        r.reason,
      );
    }
  });
}

/**
 * Clears a base pack's cache entries (memory + platform storage) and prunes any specialty
 * add-ons merged into it. Every call site automatically gets all three: memory deletion,
 * base-pack storage removal, and specialty storage removal. Pruning is delegated to
 * _clearSpecialtyStorageKeys, which PackMemCacheImpl.write() reuses for the in-memory-
 * replace case — one composable helper, two callers, no per-call-site boilerplate.
 */
export async function clearPackCache(lang: string): Promise<void> {
  // Synchronous state changes run first — before any async I/O — so a concurrent
  // loadPack or loadSpecialtyPack that completes during the await cannot have its
  // freshly-written memCache entry wiped when this eviction's delete executes later. (#358)
  memCache.delete(lang);
  const prunedCodes = clearSpecialtyPacksForLang(lang);
  // allSettled: both base-pack removals run regardless of whether either throws.
  const [metaResult, dataResult] = await Promise.allSettled([
    getStorage().removeItem(CACHE_META_PREFIX + lang),
    getStorage().removeItem(CACHE_DATA_PREFIX + lang),
  ]);
  if (metaResult.status === "rejected") {
    console.error(`[ERR-CACHE-CLEAR-META-${lang}-${Date.now()}] storage removeItem failed — meta key may persist`, metaResult.reason);
  }
  if (dataResult.status === "rejected") {
    console.error(`[ERR-CACHE-CLEAR-DATA-${lang}-${Date.now()}] storage removeItem failed — data key may persist`, dataResult.reason);
  }
  await _clearSpecialtyStorageKeys(prunedCodes, "CLEAR");
}

// ── Shared parse/validate/cache-or-evict helpers ──────────────────────────────
//
// loadPack serves pack JSON from 5 different origins (2 cache-hit branches, 2 offline-fallback
// branches, 1 fresh-download success). All 5 need the same guarantee: clearSpecialtyPacksForLang
// must run before the cache is overwritten, so a merged specialty pack's tracking state never
// outlives the data it was merged into. `cacheAndReturn` gets this for free by calling
// `memCache.write` (see PackMemCache in lib/packTypes.ts) rather than a raw Map.set — there is no
// raw `set` exposed on `memCache` for a future call site to bypass. (The eviction-side pairing is
// handled inside clearPackCache itself — see its doc comment above.) Only 3 of these 5 origins
// (the fresh-download success path and the 2 offline-fallback branches) previously hand-rolled
// this pairing before Task #260's extraction; the 2 cache-hit branches never had it at all —
// routing all 5 through one funnel closes that gap for every origin uniformly.

/** Success tail shared by every site that adds `pack` to the cache under `lang`. */
export function cacheAndReturn(lang: string, pack: Pack): LoadPackResult {
  memCache.write(lang, pack);
  return { ok: true, pack };
}

/**
 * Failure tail for previously-cached bytes that fail to parse or fail shape validation.
 * Evicts the corrupted cache entry — without this, a corrupted cache entry blocks every future
 * load forever. Not used by the fresh-download path: a malformed server response shouldn't evict
 * a still-good local cache, since nothing has been cached from it yet.
 */
export async function evictAndReject(lang: string): Promise<LoadPackResult> {
  await clearPackCache(lang);
  return { ok: false, error: "parse_error" };
}

/** Shape-validates an already-parsed pack, evicting on failure or caching on success. */
export async function validateAndCache(lang: string, pack: Pack): Promise<LoadPackResult> {
  if (!hasValidUnitsArray(pack)) {
    // Same log-before-evict discipline as the JSON.parse-throw path just below — without this,
    // an operator sees a log line for corrupt JSON but nothing for wrong-shape JSON, even though
    // both silently wipe the user's local cache.
    console.error(`[SHAPE_INVALID_FAIL-${lang}-${Date.now()}] pack failed hasValidUnitsArray — evicting`);
    return evictAndReject(lang);
  }
  return cacheAndReturn(lang, pack);
}

/**
 * Parses and shape-validates JSON already sitting in cache. Used by the 2 offline-fallback
 * branches, where a JSON.parse throw and a shape-validation failure both mean the same thing
 * (no further fallback exists — return the error immediately). NOT used by the 2 cache-hit
 * branches: those wrap their own JSON.parse in an outer try/catch so a parse throw there falls
 * through to attempt a fresh download instead of erroring immediately — a fresh download hasn't
 * been attempted yet at that point, so a corrupt cache entry there isn't necessarily fatal. Those
 * branches call validateAndCache directly once parsing succeeds, preserving that distinction.
 */
export async function parseValidateAndCache(lang: string, jsonText: string): Promise<LoadPackResult> {
  let pack: Pack;
  try {
    pack = JSON.parse(jsonText) as Pack;
  } catch (err) {
    console.error(`[CACHE_PARSE_FAIL-${Date.now()}]`, err);
    return evictAndReject(lang);
  }
  return validateAndCache(lang, pack);
}

// ── Testing support ───────────────────────────────────────────────────────────

/**
 * Resets all state owned by this module.
 * @internal Called by packLoader.clearCacheForTesting — do not call directly in application code.
 */
export function clearPackCacheState(): void {
  memCache.clear();
  loadedAddOns.length = 0;
  _storage = null;
}
