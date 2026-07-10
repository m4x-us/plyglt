// ============================================================
// packLoader.ts — Fetches, verifies, and caches language pack JSON files with sha256 integrity
// ============================================================
/**
 * packLoader.ts — Fetches, verifies, and caches language pack JSON files.
 *
 * Depends on: @/lib/packCache (in-memory and storage I/O layer), @/lib/langRegistry (allowlist)
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
 *
 * Low-level cache I/O lives in lib/packCache.ts (extracted Task #275 to satisfy the
 * 400-line service cap — Rule 1, AGENTS.md/philosophy.md).
 */

import { READY_PACK_CODES, SPECIALTY_PACKS, isReadySpecialtyPackCode, isValidPackCode, type PackCode } from "@/lib/langRegistry";
import { loadSpecialtyPack, clearSpecialtyCache } from "@/lib/specialtyPackLoader";
import { sha256Hex, packUrl } from "@/lib/utils";
export { getLoadedAddOns } from "@/lib/specialtyPackLoader";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Manifest, Pack, LoadPackResult } from "@/lib/packTypes";
export type { PackMeta, Manifest, Pack, LoadPackResult } from "@/lib/packTypes";
import {
  memCache,
  readCacheMeta,
  readCacheData,
  writeCacheData,
  writeCacheMeta,
  clearPackCache,
  cacheAndReturn,
  validateAndCache,
  parseValidateAndCache,
  clearPackCacheState,
} from "@/lib/packCache";

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
  options?: { forceRedownload?: boolean; purchasedAddOns?: string[] }
): Promise<LoadPackResult> {
  // Accept ready base packs (READY_PACK_CODES) and ready specialty packs (isReadySpecialtyPackCode).
  // Reject everything else — unknown codes (path traversal) and registered-but-unready packs.
  // "invalid_lang" is distinct from "download_failed" so callers never retry unknown codes.
  // #266: isReadySpecialtyPackCode(lang) replaces the former inline SPECIALTY_PACKS.some(...)
  // so the .ready check is not duplicated (lib/langRegistry.ts is the single source of truth).
  const isReadyBasePack = READY_PACK_CODES.some(c => c === lang);
  const isReadySpecialtyPack = isReadySpecialtyPackCode(lang);
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
  clearPackCacheState();  // resets memCache and _storage (lib/packCache.ts)
  clearSpecialtyCache();  // resets loadedAddOns and inFlight (lib/specialtyPackLoader.ts)
}
