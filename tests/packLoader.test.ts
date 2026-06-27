// === tests/packLoader.test.ts ===
// Tests for lib/packLoader.ts — fetch, cache, verify, and evict language pack JSON files.
// Depends on: lib/packLoader, lib/langRegistry (via ALL_PACK_CODES allowlist guard)
// Coverage: loadPack (download, cache hit, memory hit, SHA-256, allowlist), getInstalledPacks, evictPack

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Manifest, Pack } from "@/lib/packLoader";
import { loadPack, getInstalledPacks, evictPack, clearCacheForTesting, fetchManifest } from "@/lib/packLoader";

// ── localStorage stub ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  key: (i) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};
vi.stubGlobal("window", { localStorage: localStorageMock });

// ── Web Crypto stub — real SHA256 via Node.js crypto ─────────────────────────
// Any bug in sha256Hex() (wrong algorithm, wrong hex encoding) will produce the
// wrong hex and fail the comparison against CORRECT_SHA below.

vi.stubGlobal("crypto", {
  subtle: {
    digest: async (_algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
      const hash = createHash("sha256").update(Buffer.from(data)).digest();
      return hash.buffer as ArrayBuffer;
    },
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakePack = (): Pack => ({
  _version: 1,
  lang: "it",
  packVersion: "1.0.0",
  canonicalSource: "en",
  name: "Italian",
  nativeName: "Italiano",
  flag: "🇮🇹",
  unitCount: 1,
  cardCount: 1,
  units: [],
});

// Derived from the actual fixture content — stays in sync because it's computed, not typed
const PACK_JSON = JSON.stringify(fakePack());
const CORRECT_SHA = createHash("sha256").update(PACK_JSON).digest("hex");

const fakeManifest = (sha256 = CORRECT_SHA): Manifest => ({
  _version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  packs: {
    it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹", version: "1.0.0", size: 100, sha256 },
  },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  clearCacheForTesting();
  vi.resetAllMocks();
});

describe("loadPack", () => {
  it("downloads and caches a pack when nothing is cached", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => JSON.stringify(fakePack()),
    }));

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.lang).toBe("it");
    // Data is now cached in platform storage
    expect(localStorageMock.getItem("pack-data-v1-it")).not.toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).not.toBeNull();
  });

  it("returns cached pack without fetching if version matches", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // Pre-seed cache with content that hashes to CORRECT_SHA
    localStorageMock.setItem("pack-data-v1-it", PACK_JSON);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: CORRECT_SHA, cachedAt: Date.now() }));

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns from memory cache on second call without touching storage", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => PACK_JSON,
    });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeManifest());
    expect(fetchSpy).toHaveBeenCalledOnce();

    // Second call — should return from memCache, no fetch, no storage read
    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce(); // still just once
  });

  it("rejects a pack with checksum mismatch and returns checksum_mismatch", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => JSON.stringify(fakePack()),
    }));

    // Change last char to something guaranteed different from what it actually is
    const lastChar = CORRECT_SHA[CORRECT_SHA.length - 1];
    const badLastChar = lastChar === "f" ? "e" : "f";
    const badManifest = fakeManifest(CORRECT_SHA.slice(0, -1) + badLastChar);
    const result = await loadPack("it", badManifest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("checksum_mismatch");
    // Nothing written to cache
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
  });

  it("returns download_failed if fetch returns non-200 and no cache", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503 }));

    const result = await loadPack("it", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("download_failed");
  });

  it("serves stale cache when network is unavailable", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("Network error"); });

    const pack = fakePack();
    localStorageMock.setItem("pack-data-v1-it", JSON.stringify(pack));
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.0", sha256: "", cachedAt: Date.now() }));

    // New manifest has version 1.0.0 — but fetch fails → serve stale
    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.lang).toBe("it");
  });

  it("returns parse_error when downloaded pack JSON has null units field", async () => {
    const malformedPack = { ...fakePack(), units: null };
    const malformedJson = JSON.stringify(malformedPack);
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => malformedJson,
    }));

    // Use a manifest whose sha256 matches the malformed JSON so we get past the checksum check
    const { createHash } = await import("node:crypto");
    const sha = createHash("sha256").update(malformedJson).digest("hex");
    const result = await loadPack("it", fakeManifest(sha));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
  });

  it("evicts cache and re-downloads when cached data has wrong SHA256", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => PACK_JSON,
    });
    vi.stubGlobal("fetch", fetchSpy);

    // Seed cache with content that is structurally valid JSON but wrong hash
    localStorageMock.setItem("pack-data-v1-it", '{"corrupted":true}');
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({
      version: "1.0.0",
      sha256: CORRECT_SHA, // manifest says this hash, but the data above doesn't match
      cachedAt: Date.now(),
    }));

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce(); // confirmed: evicted and re-fetched
  });
});

describe("getInstalledPacks / evictPack", () => {
  it("lists packs loaded in the current session", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => PACK_JSON,
    }));

    await loadPack("it", fakeManifest());
    const installed = getInstalledPacks();
    expect(installed).toContain("it");
  });

  it("removes pack from memory and storage on evict", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => PACK_JSON,
    }));

    await loadPack("it", fakeManifest());
    expect(getInstalledPacks()).toContain("it");

    await evictPack("it");
    expect(getInstalledPacks()).not.toContain("it");
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
  });
});

describe("loadPack — allowlist validation", () => {
  it("returns invalid_lang without fetch for path traversal: ../evil", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("../evil", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid_lang without fetch for path traversal: ../../etc/passwd", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("../../etc/passwd", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proceeds to fetch for valid lang code: it", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => PACK_JSON,
    });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("returns invalid_lang for empty string lang code", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid_lang for invalid lang even with forceRedownload:true", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("../evil", null, { forceRedownload: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid_lang for registered but unready pack code (es) — fail fast, no CDN request", async () => {
    // Task #068 / Option B: loadPack uses READY_PACK_CODES, not ALL_PACK_CODES.
    // "es" is registered but has ready:false — rejected before any network attempt.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("es", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("loadPack — corrupted cache logging (CACHE_PARSE_FAIL)", () => {
  it("logs CACHE_PARSE_FAIL and falls through to re-download when cached data is invalid JSON", async () => {
    // Seed cache with corrupted JSON and no manifest (null skips SHA-256 check, so
    // JSON.parse is the first thing that can throw — triggers the catch at line 226).
    localStorageMock.setItem("pack-data-v1-it", "{broken");
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: "", cachedAt: Date.now() }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it", null);

    // Corrupted cache must not be served — must fall through to network
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.lang).toBe("it");
    expect(fetchSpy).toHaveBeenCalledOnce();

    // Rule 8: error logged with CACHE_PARSE_FAIL ref ID
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("CACHE_PARSE_FAIL"))).toBe(true);
  });
});

describe("readCacheMeta / readCacheData — storage error logging", () => {
  it("logs ERR-CACHE-META and ERR-CACHE-DATA when storage getItem throws", async () => {
    // Both storage reads must surface their error — silent failure here hides corrupted storage.
    vi.spyOn(localStorageMock, "getItem").mockImplementation(() => {
      throw new Error("Storage inaccessible");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => ({ ok: true, text: async () => PACK_JSON }));

    const result = await loadPack("it", fakeManifest());

    // Storage errors are non-fatal — download proceeds and pack is returned
    expect(result.ok).toBe(true);

    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("ERR-CACHE-META"))).toBe(true);
    expect(logKeys.some(msg => msg.includes("ERR-CACHE-DATA"))).toBe(true);
  });
});

describe("fetchManifest — network error logging", () => {
  it("logs MANIFEST_FETCH_FAIL when fetch throws a network error", async () => {
    // Silent failure here causes loadPack to skip SHA-256 verification — a security downgrade.
    // Rule 8: all catches must log with a ref ID.
    vi.stubGlobal("fetch", async () => { throw new Error("Network error"); });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fetchManifest();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("MANIFEST_FETCH_FAIL"),
      expect.any(Error),
    );
  });
});

describe("loadPack — QuotaExceededError handling", () => {
  it("returns ok:true and memCaches pack when storage write throws QuotaExceededError", async () => {
    // Simulates disk-full / browser storage quota exceeded during pack write.
    // The pack must still be returned for the current session (memCache populated),
    // the error must be logged, and a second call must hit memCache without re-fetching.
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => PACK_JSON,
    });
    vi.stubGlobal("fetch", fetchSpy);

    vi.spyOn(localStorageMock, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await loadPack("it", fakeManifest());

    // Pack returned successfully — storage failure is non-fatal
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.lang).toBe("it");

    // Rule 8: error logged with PACK_CACHE_WRITE_FAIL ref ID — no silent catch
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("PACK_CACHE_WRITE_FAIL"),
      expect.any(DOMException),
    );

    // Second call: pack is in memCache — fetch is NOT repeated
    const result2 = await loadPack("it", fakeManifest());
    expect(result2.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe("loadPack — A003: cachedData nulled after SHA-eviction (integrity bypass prevention)", () => {
  it("returns download_failed (not integrity-failed cache) when SHA-eviction is followed by network failure", async () => {
    // Seed cache with data whose SHA does not match the manifest (simulates corrupted cache).
    // Without A003 fix: cachedData stays non-null after eviction; stale-cache fallback serves it → ok:true.
    // With A003 fix: cachedData is nulled after eviction; stale-cache fallback skips → ok:false download_failed.
    const corruptedData = '{"corrupted":true}';
    localStorageMock.setItem("pack-data-v1-it", corruptedData);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({
      version: "1.0.0",
      sha256: CORRECT_SHA, // manifest SHA matches the good pack, NOT the corrupted data
      cachedAt: Date.now(),
    }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    // Network failure forces the stale-cache path — where the bug would manifest
    vi.stubGlobal("fetch", async () => { throw new Error("Network unavailable"); });

    const result = await loadPack("it", fakeManifest());

    // Must not serve the integrity-failed cached data
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("download_failed");
  });
});

describe("evictPack — allowlist validation", () => {
  it("silently no-ops for unknown lang — guard prevents clearPackCache from running", async () => {
    // Pre-seed poisoned entries under the malicious key so the test can observe whether clearPackCache ran
    localStorageMock.setItem("pack-meta-v1-../evil", "poison");
    localStorageMock.setItem("pack-data-v1-../evil", "poison-data");
    // Seed real Italian data to confirm it was not collateral-damaged
    const italianMeta = JSON.stringify({ version: "1.0.0", sha256: "", cachedAt: Date.now() });
    localStorageMock.setItem("pack-meta-v1-it", italianMeta);

    await evictPack("../evil");

    // Guard fired — clearPackCache was NOT called — poisoned entries must still exist
    expect(localStorageMock.getItem("pack-meta-v1-../evil")).toBe("poison");
    expect(localStorageMock.getItem("pack-data-v1-../evil")).toBe("poison-data");
    // Italian data not collateral-damaged (exact value preserved)
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBe(italianMeta);
  });
});
