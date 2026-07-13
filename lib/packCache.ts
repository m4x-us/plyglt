// ============================================================
// packCache.ts — In-memory cache and platform storage I/O for language packs.
// ============================================================
/**
 * packCache.ts — Low-level cache layer extracted from packLoader.ts (Task #275).
 *
 * Owns:
 *   - PackMemCacheImpl / memCache — session-scoped in-memory cache singleton
 *   - Platform storage helpers — read/write/clear pack JSON and metadata
 *   - Parse/validate/cache helpers — shared tails for all loadPack origins
 *
 * No React. No Zustand imports.
 *
 * @internal Used by lib/packLoader.ts. Not part of the module's external public API.
 */

import { createPlatformStorage } from "@/lib/storage";
import { clearSpecialtyPacksForLang } from "@/lib/specialtyPackLoader";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack, LoadPackResult, PackMemCache } from "@/lib/packTypes";

// ── Cache metadata shape ──────────────────────────────────────────────────────

export interface CachedPackMeta {
  version: string;
  sha256: string;
  cachedAt: number;
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
    clearSpecialtyPacksForLang(lang);
    this.map.set(lang, pack);
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

/**
 * Clears a base pack's cache entries (memory + platform storage) and prunes any specialty
 * add-ons merged into it — the two are inseparable: an evicted base pack can never have its
 * merge state left dangling. Pruning lives INSIDE this function, not at each call site, because
 * 4 consecutive Batch 18 remediation tasks (#250, #251, #253, #259) each independently forgot
 * to pair the two calls at one or more of clearPackCache's several call sites — most recently
 * Task #259 added clearSpecialtyPacksForLang after 3 of loadPack's cache-write call sites but
 * missed 4 sibling clearPackCache-and-return call sites in the same two blocks it was editing.
 * Folding the prune into clearPackCache itself means every call site, present and any added
 * later, gets the guarantee automatically — there is no longer a second line to remember.
 *
 * As of #319: also clears each pruned specialty code's own persisted storage keys. Each
 * specialty pack has its own pack-meta-v1-{code} and pack-data-v1-{code} entries written by
 * lib/specialtyPackLoader._mergeFromJson. Without clearing them, evicting a base pack leaves
 * orphaned specialty bytes on disk — they would be served from cache on the next load without
 * re-verifying against the current manifest's sha256, even though their in-memory tracking
 * was pruned. clearSpecialtyPacksForLang now returns the pruned codes so this function can
 * target their storage keys directly.
 */
export async function clearPackCache(lang: string): Promise<void> {
  // allSettled: both removals run regardless of whether either throws.
  // memCache.delete always runs after — a storage I/O failure must never leave
  // a stale in-memory entry that silently bypasses the eviction.
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
  memCache.delete(lang);
  // Prune in-memory add-on tracking and collect the evicted codes so their own
  // storage entries can also be cleared (#319 — previously only pruned in-memory state).
  const prunedCodes = clearSpecialtyPacksForLang(lang);
  if (prunedCodes.length > 0) {
    const specialtyResults = await Promise.allSettled(
      prunedCodes.flatMap(code => [
        getStorage().removeItem(CACHE_META_PREFIX + code),
        getStorage().removeItem(CACHE_DATA_PREFIX + code),
      ]),
    );
    specialtyResults.forEach((r, i) => {
      if (r.status === "rejected") {
        const code = prunedCodes[Math.floor(i / 2)]!;
        const keyType = i % 2 === 0 ? "meta" : "data";
        console.error(
          `[ERR-CACHE-CLEAR-SPECIALTY-${keyType.toUpperCase()}-${code}-${Date.now()}] storage removeItem failed — ${keyType} key may persist`,
          r.reason,
        );
      }
    });
  }
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
  _storage = null;
}
