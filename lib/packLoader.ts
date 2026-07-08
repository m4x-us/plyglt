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
 *   1. In-memory Map<string, Pack>  — per-session, zero-latency
 *   2. Platform storage              — Tauri Store (desktop) or localStorage (web)
 *   3. Network download              — fetch from /packs/{lang}.json
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
import { loadSpecialtyPack, clearSpecialtyCache } from "@/lib/specialtyPackLoader";
import { sha256Hex, packUrl } from "@/lib/utils";
export { getLoadedAddOns } from "@/lib/specialtyPackLoader";
import type { Manifest, Pack, LoadPackResult } from "@/lib/packTypes";
export type { PackMeta, Manifest, Pack, LoadPackResult } from "@/lib/packTypes";

// ── Private cache metadata type (internal to packLoader) ─────────────────────

interface CachedPackMeta {
  version: string;
  sha256: string;
  cachedAt: number;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

const memCache = new Map<string, Pack>();

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

async function clearPackCache(lang: string): Promise<void> {
  await getStorage().removeItem(CACHE_META_PREFIX + lang);
  await getStorage().removeItem(CACHE_DATA_PREFIX + lang);
  memCache.delete(lang);
}

// ── Pack shape validation ─────────────────────────────────────────────────────

// Shared guard for all JSON.parse(...) as Pack sites in loadPack.
// sha256 integrity (bytes haven't changed) and structural shape (bytes are a valid Pack)
// are orthogonal checks — a pack can pass sha256 yet have non-array units if the
// content-authoring pipeline produced malformed JSON. Apply both checks at every parse site.
function validatePackShape(pack: Pack): boolean {
  return Array.isArray(pack.units);
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
          await clearPackCache(lang);
          cachedData = null; // A003: prevent integrity-failed bytes from reaching stale-cache fallback
          // fall through to re-download
        } else {
          const pack = JSON.parse(cachedData) as Pack;
          if (!validatePackShape(pack)) {
            await clearPackCache(lang);
            cachedData = null; // A003-style: prevent bytes from reaching stale-cache fallback
            return { ok: false, error: "parse_error" };
          }
          memCache.set(lang, pack);
          return { ok: true, pack };
        }
      } else {
        // No manifest to compare against — serve cache as-is (offline degradation)
        const pack = JSON.parse(cachedData) as Pack;
        if (!validatePackShape(pack)) {
          await clearPackCache(lang);
          return { ok: false, error: "parse_error" };
        }
        memCache.set(lang, pack);
        return { ok: true, pack };
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
        try {
          const pack = JSON.parse(cachedData) as Pack;
          if (!validatePackShape(pack)) {
            return { ok: false, error: "parse_error" };
          }
          memCache.set(lang, pack);
          return { ok: true, pack };
        } catch (err) {
          console.error(`[CACHE_PARSE_FAIL-${Date.now()}]`, err);
          return { ok: false, error: "parse_error" };
        }
      }
      return { ok: false, error: "download_failed" };
    }
    json = await res.text();
  } catch (err) {
    // Network error — serve stale cache
    console.error(`[PACK_DOWNLOAD_FAIL-${Date.now()}]`, err);
    if (cachedData) {
      try {
        const pack = JSON.parse(cachedData) as Pack;
        if (!validatePackShape(pack)) {
          return { ok: false, error: "parse_error" };
        }
        memCache.set(lang, pack);
        return { ok: true, pack };
      } catch (parseErr) {
        console.error(`[CACHE_PARSE_FAIL-${Date.now()}]`, parseErr);
        return { ok: false, error: "parse_error" };
      }
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

  // Parse
  let pack: Pack;
  try {
    pack = JSON.parse(json) as Pack;
  } catch (err) {
    console.error(`[PACK_PARSE_FAIL-${Date.now()}]`, err);
    return { ok: false, error: "parse_error" };
  }

  if (!validatePackShape(pack)) {
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
  memCache.set(lang, pack);

  return { ok: true, pack };
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
 * (e.g. after purchase reversal or manual reset).
 *
 * Guard uses isValidPackCode (ALL_PACK_CODES): any registered code can be evicted
 * for cleanup, even unready ones. Rejects unregistered codes to prevent clearPackCache
 * from operating on poisoned storage key namespaces.
 */
export async function evictPack(lang: string): Promise<void> {
  if (!isValidPackCode(lang)) return;
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
