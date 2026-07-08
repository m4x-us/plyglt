// === tests/packLoader.test.ts ===
// Tests for lib/packLoader.ts — fetch, cache, verify, and evict language pack JSON files.
// Depends on: lib/packLoader, lib/langRegistry (via ALL_PACK_CODES allowlist guard)
// Coverage: loadPack (download, cache hit, memory hit, SHA-256, allowlist), getInstalledPacks, evictPack

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Manifest, Pack } from "@/lib/packLoader";
import { loadPack, getInstalledPacks, getLoadedAddOns, evictPack, clearCacheForTesting, fetchManifest } from "@/lib/packLoader";
import type { SpecialtyPack } from "@/lib/langRegistry";

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

// ── Specialty pack mock ────────────────────────────────────────────────────────
// mockSpecialtyPacks is mutated per-describe-block via push/length=0.
// Global beforeEach clears it so existing tests (which require SPECIALTY_PACKS=[]) are unaffected.
const mockSpecialtyPacks = vi.hoisted<SpecialtyPack[]>(() => []);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return { ...actual, SPECIALTY_PACKS: mockSpecialtyPacks };
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

// ── Add-on pack fixture ───────────────────────────────────────────────────────
const fakeAddOnPack = (): Pack => ({
  _version: 1,
  lang: "it-medical",
  packVersion: "1.0.0",
  canonicalSource: "en",
  name: "Medical Italian",
  nativeName: "Italiano Medico",
  flag: "🇮🇹",
  unitCount: 5,
  cardCount: 50,
  units: [],
});
const ADD_ON_PACK_JSON = JSON.stringify(fakeAddOnPack());
const ADD_ON_SHA = createHash("sha256").update(ADD_ON_PACK_JSON).digest("hex");
const fakeAddOnManifest = (): Manifest => ({
  _version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  packs: {
    it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹", version: "1.0.0", size: 100, sha256: CORRECT_SHA },
    "it-medical": { name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹", version: "1.0.0", size: 50, sha256: ADD_ON_SHA },
  },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  clearCacheForTesting();
  vi.resetAllMocks();
  mockSpecialtyPacks.length = 0;
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
    // Data is now cached in platform storage — assert the exact stored content, not just presence.
    expect(localStorageMock.getItem("pack-data-v1-it")).toBe(PACK_JSON);
    const meta = JSON.parse(localStorageMock.getItem("pack-meta-v1-it")!);
    expect(meta.version).toBe("1.0.0");
    expect(meta.sha256).toBe(CORRECT_SHA);
    // Note: already an exact-value assertion (.toBe), not a banned existence-only pattern —
    // no existence-check tag needed. cachedAt is Date.now() at write time, genuinely
    // non-deterministic, so type is the strongest check possible without a flaky range check.
    expect(typeof meta.cachedAt).toBe("number");
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

  it("returns parse_error when stale cached pack has non-array units field (semantic corruption)", async () => {
    // Seeds cache with syntactically-valid but semantically-malformed JSON (units is a string, not array).
    // Version mismatch (0.9.0 vs 1.0.0 in manifest) bypasses the cache-hit branch, so the stale-cache
    // fallback path runs when fetch throws. This test fails if the !Array.isArray(pack.units) guard is
    // removed from the stale-cache fallback path — the malformed pack would leak as ok:true.
    const malformedPack = { ...fakePack(), units: "not-an-array" };
    localStorageMock.setItem("pack-data-v1-it", JSON.stringify(malformedPack));
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.0", sha256: "", cachedAt: Date.now() }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => { throw new Error("Network error"); });

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
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

describe("loadPack — shape-validation at all cache-hit paths (Task #248)", () => {
  it("returns parse_error when sha256-verified cache-hit pack has non-array units", async () => {
    // The manifest sha256 matches the malformed data — the hash check passes — so shape validation
    // at the sha256-verified site is the only remaining guard. Without hasValidUnitsArray at this
    // site the malformed pack would return ok:true. Test fails if the guard is removed.
    const malformedPack = { ...fakePack(), units: "not-an-array" };
    const malformedJson = JSON.stringify(malformedPack);
    const { createHash: ch } = await import("node:crypto");
    const malformedSha = ch("sha256").update(malformedJson).digest("hex");

    localStorageMock.setItem("pack-data-v1-it", malformedJson);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: malformedSha, cachedAt: Date.now() }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // Manifest sha256 matches malformed data → hash passes → shape check fires
    const result = await loadPack("it", fakeManifest(malformedSha));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    // Shape validation rejects at cache-hit time — no download attempt
    expect(fetchSpy).not.toHaveBeenCalled();
    // Malformed data evicted from cache
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
  });

  it("returns parse_error when no-manifest cache-hit pack has non-array units", async () => {
    // No manifest (null) → no hash verification. Shape validation is the only safety check.
    // Without hasValidUnitsArray at the no-manifest site the malformed pack returns ok:true.
    // Test fails if the guard is removed from the no-manifest (offline-serve-as-is) branch.
    const malformedPack = { ...fakePack(), units: null };
    localStorageMock.setItem("pack-data-v1-it", JSON.stringify(malformedPack));
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: "", cachedAt: Date.now() }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    // No download attempted — shape check fires at cache-hit time
    expect(fetchSpy).not.toHaveBeenCalled();
    // Malformed data evicted from cache
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
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

describe("loadPack — specialty pack code validation", () => {
  it("returns invalid_lang for unregistered specialty-format code without fetching", async () => {
    // "it-medical" matches the specialty pack naming convention but is not in SPECIALTY_PACKS.
    // The guard must reject it as an unknown code (same path as path traversal attempts).
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it-medical", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid_lang for specialty-format code with forceRedownload:true", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it-business", null, { forceRedownload: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
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

describe("loadedAddOns — in-memory specialty pack tracking (Task #149)", () => {
  it("getLoadedAddOns returns an empty array before any add-ons are loaded", () => {
    // SPECIALTY_PACKS is empty — no add-on can ever be loaded in this environment.
    // This verifies the loadedAddOns array exists and starts clean each session.
    expect(getLoadedAddOns()).toEqual([]);
  });

  it("getLoadedAddOns returns a copy — mutation does not affect internal state", () => {
    const result = getLoadedAddOns();
    result.push("it-medical");
    // Internal loadedAddOns must still be empty — return value is a fresh copy
    expect(getLoadedAddOns()).toEqual([]);
  });

  it("clearCacheForTesting resets getLoadedAddOns to []", async () => {
    // Load a real pack so clearCacheForTesting has actual state to clear
    vi.stubGlobal("fetch", async () => ({ ok: true, text: async () => PACK_JSON }));
    await loadPack("it", fakeManifest());
    expect(getInstalledPacks()).toContain("it");

    clearCacheForTesting();

    // Both base packs and add-ons must be cleared
    expect(getInstalledPacks()).toEqual([]);
    expect(getLoadedAddOns()).toEqual([]);
  });

  it("loadPack with unregistered specialty-format code returns invalid_lang — not base_pack_not_loaded", async () => {
    // "it-medical" is not in SPECIALTY_PACKS (registry is empty) — must be rejected as
    // invalid_lang (unknown code), not base_pack_not_loaded (registered but base missing).
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it-medical", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getLoadedAddOns()).toEqual([]);
  });
});

describe("specialty pack merge path", () => {
  // Register a ready specialty pack before each test in this block.
  // Global beforeEach has already cleared mockSpecialtyPacks to [] — push here so
  // only tests inside this block see a non-empty SPECIALTY_PACKS.
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
  });

  it("fetches add-on, verifies sha256, merges units into base pack, and tracks in loadedAddOns", async () => {
    // This test fails if the isReadySpecialtyPack merge block in packLoader.ts is removed:
    // without it, loadPack("it-medical") loads as a standalone pack → unitCount=5, not 1+5=6.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })         // call 1: base "it"
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON }); // call 2: add-on "it-medical"
    vi.stubGlobal("fetch", fetchSpy);

    // Load base pack into memCache first — add-on requires it
    await loadPack("it", fakeAddOnManifest());

    const result = await loadPack("it-medical", fakeAddOnManifest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // unitCount and cardCount are the sum of base + add-on — not just the add-on alone
      expect(result.pack.unitCount).toBe(fakePack().unitCount + fakeAddOnPack().unitCount);
      expect(result.pack.cardCount).toBe(fakePack().cardCount + fakeAddOnPack().cardCount);
    }
    // Add-on is tracked for the session — idempotency guard relies on this
    expect(getLoadedAddOns()).toContain("it-medical");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns base_pack_not_loaded when base pack is not yet in memCache", async () => {
    // The merge path requires the base pack ("it") to be loaded before any add-on.
    // Callers must load the base first — this is enforced, not silently corrected.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it-medical", null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("base_pack_not_loaded");
    // Guard fires before any network request
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns merged pack without re-fetching when add-on is already loaded (idempotent)", async () => {
    // Merging the same add-on twice must be idempotent — units are not duplicated
    // and no second fetch is issued.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    await loadPack("it-medical", fakeAddOnManifest());
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Second add-on call — must return ok:true from the idempotency path, no 3rd fetch
    const result = await loadPack("it-medical", fakeAddOnManifest());
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // no additional fetch
    expect(getLoadedAddOns()).toContain("it-medical");
  });

  it("rejects a malformed add-on pack via the shared hasValidUnitsArray guard (Task #250)", async () => {
    // specialtyPackLoader.ts now delegates its shape check to lib/packTypes.ts's
    // hasValidUnitsArray instead of its own inline Array.isArray(...) copy. This test fails
    // if that delegation is removed and the sibling check regresses independently of
    // lib/packLoader.ts's own copy of the same guard.
    const malformedAddOnJson = JSON.stringify({ ...fakeAddOnPack(), units: "not-an-array" });
    const malformedSha = createHash("sha256").update(malformedAddOnJson).digest("hex");
    const baseManifest = fakeAddOnManifest();
    const manifest: Manifest = {
      ...baseManifest,
      packs: {
        ...baseManifest.packs,
        "it-medical": { ...baseManifest.packs["it-medical"]!, sha256: malformedSha },
      },
    };
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => malformedAddOnJson });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", manifest);
    const result = await loadPack("it-medical", manifest);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    expect(getLoadedAddOns()).not.toContain("it-medical");
  });
});
