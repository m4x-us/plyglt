// ============================================================
// packLoader.ts — Fetches, verifies, and caches language pack JSON files with sha256 integrity
// ============================================================
/**
 * packLoader.ts — Fetches, verifies, and caches language pack JSON files.
 *
 * Depends on: @/lib/storage (platform storage), @/lib/langRegistry (allowlist)
 * Used by:    hooks/useLangPack.ts
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
 * ("it") pack in memCache. The base pack must be loaded first. Merged units are
 * additive — base units are never removed. loadedAddOns tracks which add-ons are
 * merged this session. Since SPECIALTY_PACKS is currently empty, the specialty path
 * never executes — the structure is in place for when content arrives.
 *
 * Public API: loadPack, getInstalledPacks, getLoadedAddOns, evictPack, fetchManifest, clearCacheForTesting
 */

import { createPlatformStorage } from "@/lib/storage";
import { READY_PACK_CODES, SPECIALTY_PACKS, isValidPackCode, type PackCode } from "@/lib/langRegistry";
import { loadSpecialtyPack, clearSpecialtyCache, clearSpecialtyPacksForLang } from "@/lib/specialtyPackLoader";
import { sha256Hex, packUrl } from "@/lib/utils";
export { getLoadedAddOns } from "@/lib/specialtyPackLoader";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Manifest, Pack, LoadPackResult, PackMemCache } from "@/lib/packTypes";
export type { PackMeta, Manifest, Pack, LoadPackResult } from "@/lib/packTypes";

// ── Private cache metadata type (internal to packLoader) ─────────────────────

interface CachedPackMeta {
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

const memCache: PackMemCache = new PackMemCacheImpl();

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

async function readCacheMeta(lang: string): Promise<CachedPackMeta | null> {
  try {
    const raw = await getStorage().getItem(CACHE_META_PREFIX + lang);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPackMeta;
  } catch (err) {
    console.error(`[ERR-CACHE-META-${Date.now()}]`, err);
    return null;
  }
}

async function writeCacheMeta(lang: string, meta: CachedPackMeta): Promise<void> {
  await getStorage().setItem(CACHE_META_PREFIX + lang, JSON.stringify(meta));
}

async function readCacheData(lang: string): Promise<string | null> {
  try {
    return await getStorage().getItem(CACHE_DATA_PREFIX + lang);
  } catch (err) {
    console.error(`[ERR-CACHE-DATA-${Date.now()}]`, err);
    return null;
  }
}

async function writeCacheData(lang: string, json: string): Promise<void> {
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
 */
async function clearPackCache(lang: string): Promise<void> {
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
  clearSpecialtyPacksForLang(lang);
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
function cacheAndReturn(lang: string, pack: Pack): LoadPackResult {
  memCache.write(lang, pack);
  return { ok: true, pack };
}

/**
 * Failure tail for previously-cached bytes that fail to parse or fail shape validation.
 * Evicts the corrupted cache entry — without this, a corrupted cache entry blocks every future
 * load forever. Not used by the fresh-download path: a malformed server response shouldn't evict
 * a still-good local cache, since nothing has been cached from it yet.
 */
async function evictAndReject(lang: string): Promise<LoadPackResult> {
  await clearPackCache(lang);
  return { ok: false, error: "parse_error" };
}

/** Shape-validates an already-parsed pack, evicting on failure or caching on success. */
async function validateAndCache(lang: string, pack: Pack): Promise<LoadPackResult> {
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
async function parseValidateAndCache(lang: string, jsonText: string): Promise<LoadPackResult> {
  let pack: Pack;
  try {
    pack = JSON.parse(jsonText) as Pack;
  } catch (err) {
    console.error(`[CACHE_PARSE_FAIL-${Date.now()}]`, err);
    return evictAndReject(lang);
  }
  return validateAndCache(lang, pack);
}

// ── Pack URL helpers ──────────────────────────────────────────────────────────

function manifestUrl(): string {
  return `/packs/manifest.json`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches and parses the pack manifest.
 * Returns null if the network is unavailable (caller uses cached version).
 */
export async function fetchManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch(manifestUrl(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Manifest;
  } catch (err) {
    // Log before returning null — a silent network error here causes loadPack to skip
    // SHA-256 verification, which is a silent security downgrade. Ref ID aids diagnosis.
    console.error(`[MANIFEST_FETCH_FAIL-${Date.now()}]`, err);
    return null;
  }
}

/**
 * Loads a pack for the given language code.
 *
 * Strategy:
 * 1. Memory cache hit — return immediately (same-session repeated calls).
 * 2. Platform storage hit with valid version — return from storage.
 * 3. Download → verify sha256 → write to storage → cache in memory → return.
 * 4. If download fails but a cached (possibly stale) version exists → return it
 *    (offline graceful degradation).
 */
export async function loadPack(
  lang: string,
  manifest: Manifest | null,
  options?: { forceRedownload?: boolean }
): Promise<LoadPackResult> {
  // Accept ready base packs (READY_PACK_CODES) and ready specialty packs (SPECIALTY_PACKS with
  // ready:true). Reject everything else — unknown codes (path traversal) and registered-but-unready
  // packs. "invalid_lang" is distinct from "download_failed" so callers never retry unknown codes.
  const isReadyBasePack = READY_PACK_CODES.some(c => c === lang);
  const isReadySpecialtyPack = SPECIALTY_PACKS.some(sp => sp.code === lang && sp.ready);
  if (!isReadyBasePack && !isReadySpecialtyPack) {
    return { ok: false, error: "invalid_lang" };
  }

  // ── Specialty pack path ────────────────────────────────────────────────────
  // Delegated to lib/specialtyPackLoader.ts. memCache is passed so the add-on
  // units can be merged into the already-loaded base pack entry.
  if (isReadySpecialtyPack) {
    return loadSpecialtyPack(lang, memCache, manifest);
  }

  // 1. Memory hit — fastest path, avoids all storage I/O
  if (!options?.forceRedownload && memCache.has(lang)) {
    return { ok: true, pack: memCache.get(lang)! };
  }

  const manifestEntry = manifest?.packs?.[lang];
  const [cachedMeta, initialCachedData] = await Promise.all([
    readCacheMeta(lang),
    readCacheData(lang),
  ]);
  let cachedData: string | null = initialCachedData;

  // Cache hit: version matches and data is present
  const cacheValid =
    !options?.forceRedownload &&
    cachedMeta !== null &&
    cachedData !== null &&
    (manifestEntry === undefined || cachedMeta.version === manifestEntry.version);

  if (cacheValid && cachedData) {
    try {
      if (manifestEntry) {
        // Re-verify hash — never trust data that might have been corrupted since caching
        const actual = await sha256Hex(cachedData);
        if (actual !== manifestEntry.sha256) {
          // clearPackCache also prunes specialty tracking for lang (see its doc comment) — this
          // branch is only reachable when memCache.has(lang) was already false (step 1's
          // memory-hit check would have short-circuited otherwise), so there is never a merged
          // specialty pack in memCache here to worry about pruning stale; the prune still runs,
          // it's simply a no-op in that case. The guarantee holds regardless of this invariant.
          await clearPackCache(lang);
          cachedData = null; // A003: prevent integrity-failed bytes from reaching stale-cache fallback
          // fall through to re-download
        } else {
          // JSON.parse stays inside this outer try (not routed through parseValidateAndCache) so a
          // throw here falls through to attempt a fresh download below, rather than erroring
          // immediately — no download has been attempted yet at this point in the function.
          const pack = JSON.parse(cachedData) as Pack;
          return await validateAndCache(lang, pack);
        }
      } else {
        // No manifest to compare against — serve cache as-is (offline degradation).
        // Same fall-through-on-parse-throw reasoning as the branch above.
        const pack = JSON.parse(cachedData) as Pack;
        return await validateAndCache(lang, pack);
      }
    } catch (err) {
      console.error(`[CACHE_PARSE_FAIL-${Date.now()}]`, err);
      await clearPackCache(lang);
      // fall through to re-download
    }
  }

  // Download needed
  let json: string;
  try {
    const res = await fetch(packUrl(lang), { cache: "no-store" });
    if (!res.ok) {
      // Offline fallback: serve stale cache if available
      if (cachedData) {
        return await parseValidateAndCache(lang, cachedData);
      }
      return { ok: false, error: "download_failed" };
    }
    json = await res.text();
  } catch (err) {
    // Network error — serve stale cache
    console.error(`[PACK_DOWNLOAD_FAIL-${Date.now()}]`, err);
    if (cachedData) {
      return await parseValidateAndCache(lang, cachedData);
    }
    return { ok: false, error: "download_failed" };
  }

  // Verify sha256 if manifest is available — never serve a corrupted pack
  if (manifestEntry) {
    const actual = await sha256Hex(json);
    if (actual !== manifestEntry.sha256) {
      // Do NOT write corrupted data to cache
      return { ok: false, error: "checksum_mismatch" };
    }
  }

  // Parse. Failure here is NOT routed through parseValidateAndCache/evictAndReject: these are
  // freshly-downloaded bytes, not previously-cached ones, so there is nothing of this data's own
  // to evict — a malformed server response must not blow away an existing, still-good local cache.
  let pack: Pack;
  try {
    pack = JSON.parse(json) as Pack;
  } catch (err) {
    console.error(`[PACK_PARSE_FAIL-${Date.now()}]`, err);
    return { ok: false, error: "parse_error" };
  }

  if (!hasValidUnitsArray(pack)) {
    console.error(`[SHAPE_INVALID_FAIL-${lang}-${Date.now()}] freshly-downloaded pack failed hasValidUnitsArray`);
    return { ok: false, error: "parse_error" };
  }

  // Atomic-style cache write: data first, then meta.
  // If tab closes between writes, meta will be missing → triggers fresh download next time.
  // QuotaExceededError is caught here — the pack is still valid and goes into memCache for
  // this session. It will be re-downloaded on next launch.
  try {
    await writeCacheData(lang, json);
    await writeCacheMeta(lang, {
      version: manifestEntry?.version ?? pack.packVersion,
      sha256: manifestEntry?.sha256 ?? "",
      cachedAt: Date.now(),
    });
  } catch (err) {
    console.error(`[PACK_CACHE_WRITE_FAIL-${lang}] Storage write failed — pack available this session only:`, err);
  }
  return cacheAndReturn(lang, pack);
}

/**
 * Returns the list of base language codes loaded in the current session.
 * Safe: base pack entries in memCache are only written via loadPack(), which validates
 * against READY_PACK_CODES — so this can never return an unregistered or unready code.
 */
export function getInstalledPacks(): PackCode[] {
  return Array.from(memCache.keys()) as PackCode[];
}

/**
 * Evicts a cached pack from memory and platform storage
 * (e.g. after purchase reversal or manual reset). clearPackCache itself prunes any specialty
 * add-ons merged into this base pack — see its doc comment.
 *
 * Guard uses isValidPackCode (ALL_PACK_CODES): any registered code can be evicted
 * for cleanup, even unready ones. Rejects unregistered codes to prevent clearPackCache
 * from operating on poisoned storage key namespaces.
 */
export async function evictPack(lang: string): Promise<void> {
  if (!isValidPackCode(lang)) {
    // Task #271: log specialty codes — a silent no-op violates Rule 8 (Log Everything).
    // Specialty packs cannot be evicted individually; evict the base language pack, which
    // prunes them via clearPackCache → clearSpecialtyPacksForLang.
    const match = SPECIALTY_PACKS.find(sp => sp.code === lang);
    if (match) {
      console.warn(`[evictPack] "${lang}" is a specialty pack — cannot be evicted individually; evict the base language pack ("${match.baseLang}") instead`);
    }
    return;
  }
  await clearPackCache(lang);
}

/**
 * Resets all in-memory and storage state.
 * @internal Test use only — do not call in application code.
 */
export function clearCacheForTesting(): void {
  memCache.clear();
  clearSpecialtyCache();
  _storage = null;
}
