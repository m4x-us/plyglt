// === tests/packLoader.test.ts ===
// Tests for lib/packLoader.ts — fetch, cache, verify, and evict language pack JSON files.
// Depends on: lib/packLoader, lib/langRegistry (via ALL_PACK_CODES allowlist guard)
// Coverage: loadPack (download, cache hit, memory hit, SHA-256, allowlist), evictPack, seedMemCache

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Manifest, Pack } from "@/lib/packLoader";
import { loadPack, getLoadedAddOns, evictPack, clearCacheForTesting, fetchManifest, seedMemCache } from "@/lib/packLoader";
import type { SpecialtyPack } from "@/lib/langRegistry";
import * as packTypesLib from "@/lib/packTypes";
import { memCache } from "@/lib/packCache";

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
// mockFreePackCodes controls FREE_PACK_CODES for #350 entitlement tests.
// Default: ["it"] (Italian is free). Reset to ["it"] in beforeEach.
const mockFreePackCodes = vi.hoisted<string[]>(() => ["it"]);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: mockSpecialtyPacks,
    FREE_PACK_CODES: mockFreePackCodes,
    // isSpecialtyPackCode closes over the module-scope SPECIALTY_PACKS binding, not the
    // exported one — override it here so it uses the per-test mockSpecialtyPacks array instead.
    isSpecialtyPackCode: (s: string) => mockSpecialtyPacks.some(sp => sp.code === s && sp.ready),
  };
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

// ── Add-on pack fixtures ──────────────────────────────────────────────────────
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

const fakeAddOnBusinessPack = (): Pack => ({
  _version: 1,
  lang: "it-business",
  packVersion: "1.0.0",
  canonicalSource: "en",
  name: "Business Italian",
  nativeName: "Italiano per gli Affari",
  flag: "🇮🇹",
  unitCount: 3,
  cardCount: 30,
  units: [],
});
const ADD_ON_BUSINESS_PACK_JSON = JSON.stringify(fakeAddOnBusinessPack());
const ADD_ON_BUSINESS_SHA = createHash("sha256").update(ADD_ON_BUSINESS_PACK_JSON).digest("hex");

const fakeAddOnManifest = (): Manifest => ({
  _version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  packs: {
    it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹", version: "1.0.0", size: 100, sha256: CORRECT_SHA },
    "it-medical": { name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹", version: "1.0.0", size: 50, sha256: ADD_ON_SHA },
  },
});

const fakeTwoAddOnManifest = (): Manifest => ({
  _version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  packs: {
    it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹", version: "1.0.0", size: 100, sha256: CORRECT_SHA },
    "it-medical": { name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹", version: "1.0.0", size: 50, sha256: ADD_ON_SHA },
    "it-business": { name: "Business Italian", nativeName: "Italiano per gli Affari", flag: "🇮🇹", version: "1.0.0", size: 40, sha256: ADD_ON_BUSINESS_SHA },
  },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  clearCacheForTesting();
  vi.resetAllMocks();
  mockSpecialtyPacks.length = 0;
  mockFreePackCodes.length = 0;
  mockFreePackCodes.push("it"); // default: Italian is free
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

  it("evicts a shape-invalid cache entry hit via the network-throws offline-fallback path (Task #251)", async () => {
    // Same setup as the semantic-corruption test above, but proves the corrupted entry is actually
    // cleared — not just rejected once. Without clearPackCache here, every subsequent offline load
    // attempt would hit the same corrupted bytes and return parse_error forever, with no path to
    // self-heal until a version bump succeeds online. This test fails if clearPackCache is removed
    // from this branch.
    const malformedPack = { ...fakePack(), units: "not-an-array" };
    localStorageMock.setItem("pack-data-v1-it", JSON.stringify(malformedPack));
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.0", sha256: "", cachedAt: Date.now() }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => { throw new Error("Network error"); });

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    // Corrupted cache entry evicted — a subsequent load isn't blocked by the same stale bytes
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    // Shape-validation failures must log, same as JSON.parse failures do (Task #260 follow-up)
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
  });

  it("evicts a shape-invalid cache entry hit via the !res.ok offline-fallback path (Task #251)", async () => {
    // Sibling of the network-throws test above — the !res.ok branch (HTTP error status) is a
    // structurally identical offline-fallback path with the same eviction requirement. This test
    // fails if clearPackCache is removed from this specific branch, even if the network-throws
    // branch above still has it — the two are fixed independently.
    const malformedPack = { ...fakePack(), units: "not-an-array" };
    localStorageMock.setItem("pack-data-v1-it", JSON.stringify(malformedPack));
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.0", sha256: "", cachedAt: Date.now() }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503 }));

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    // Shape-validation failures must log, same as JSON.parse failures do (Task #260 follow-up)
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
  });

  it("evicts a cache entry that fails to parse (invalid JSON, not just wrong shape) hit via the network-throws offline-fallback path (Task #260)", async () => {
    // Distinct sub-case from the "not-an-array" shape-check tests above: this cached data is
    // syntactically invalid JSON, so JSON.parse itself throws inside parseValidateAndCache rather
    // than hasValidUnitsArray rejecting a successfully-parsed object. Both sub-cases route through
    // the same shared evictAndReject tail, but this proves the parse-throw catch specifically
    // still evicts — this test fails if that catch stops calling clearPackCache.
    localStorageMock.setItem("pack-data-v1-it", "{not valid json");
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.0", sha256: "", cachedAt: Date.now() }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => { throw new Error("Network error"); });

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
  });

  it("evicts a cache entry that fails to parse (invalid JSON, not just wrong shape) hit via the !res.ok offline-fallback path (Task #260)", async () => {
    // Sibling of the network-throws parse-throw test above — same sub-case, other offline-fallback
    // branch. Fails if that branch's own routing through parseValidateAndCache regresses.
    localStorageMock.setItem("pack-data-v1-it", "{not valid json");
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.0", sha256: "", cachedAt: Date.now() }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503 }));

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
  });

  it("returns parse_error when downloaded pack JSON has null units field", async () => {
    const malformedPack = { ...fakePack(), units: null };
    const malformedJson = JSON.stringify(malformedPack);
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => malformedJson,
    }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Use a manifest whose sha256 matches the malformed JSON so we get past the checksum check
    const { createHash } = await import("node:crypto");
    const sha = createHash("sha256").update(malformedJson).digest("hex");
    const result = await loadPack("it", fakeManifest(sha));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");

    // Task #260 follow-up: shape-validation failures must log, same as JSON.parse failures do —
    // this fails if the SHAPE_INVALID_FAIL log call is removed from the fresh-download path.
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
  });

  it("returns parse_error when a downloaded pack has units with malformed card elements (#316)", async () => {
    // Before #316, hasValidUnitsArray checked only unit.id and unit.cards — a pack with
    // well-formed unit headers but card elements missing required fields (accepted, tags, tier)
    // would pass as ok:true. After #316, card element shapes are validated too.
    const malformedPack = {
      ...fakePack(),
      units: [
        {
          id: "unit-1",
          name: "Test Unit",
          level: "A1",
          theme: "test",
          emoji: "📚",
          prerequisiteUnits: [],
          cards: [
            // Missing required fields: accepted (array), tags (array), tier (number)
            { id: "card-1", type: "recognize", prompt: "ciao" },
          ],
        },
      ],
      unitCount: 1,
      cardCount: 1,
    };
    const malformedJson = JSON.stringify(malformedPack);
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => malformedJson,
    }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createHash } = await import("node:crypto");
    const sha = createHash("sha256").update(malformedJson).digest("hex");
    const result = await loadPack("it", fakeManifest(sha));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
    consoleErrorSpy.mockRestore();
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

describe("evictPack", () => {
  it("removes pack from memory and storage on evict", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeManifest());
    // Confirm pack is in memCache — second load issues no fetch
    await loadPack("it", fakeManifest());
    expect(fetchSpy).toHaveBeenCalledOnce();

    const evictResult = await evictPack("it");
    // #398 → #415: a real eviction reports itself in the result, not just via side effects —
    // fullyClean:true means every storage removal actually succeeded, not just memCache.
    expect(evictResult).toEqual({ evicted: true, fullyClean: true });
    // Pack cleared from storage
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    // memCache cleared — next load fetches again
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
  });

  it("reports fullyClean:false when a storage removal fails, but never rejects (#415)", async () => {
    // Before #415, clearPackCache swallowed this failure into a void return — evictPack's
    // caller had no way to distinguish this from a fully successful eviction. memCache is
    // still correctly cleared (in-memory state is synchronous, unaffected by storage errors).
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
    await loadPack("it", fakeManifest());

    const removeItemSpy = vi.spyOn(localStorageMock, "removeItem").mockImplementation(() => {
      throw new Error("storage removeItem failed");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const evictResult = await evictPack("it");
      expect(evictResult).toEqual({ evicted: true, fullyClean: false });
      expect(consoleErrorSpy.mock.calls.some(args => (args[0] as string).includes("ERR-CACHE-CLEAR-META"))).toBe(true);
      expect(consoleErrorSpy.mock.calls.some(args => (args[0] as string).includes("ERR-CACHE-CLEAR-DATA"))).toBe(true);
    } finally {
      removeItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }

    // memCache is still correctly cleared synchronously despite the storage failure — a
    // fresh loadPack no longer serves the evicted pack from the in-memory fast path. (The
    // stale bytes may still be served from the STORAGE cache-hit path, since removeItem
    // never actually cleared them — that residue is exactly what fullyClean:false reports.)
    expect(memCache.has("it")).toBe(false);
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

  it("logs MANIFEST_FETCH_HTTP with the status when the server responds non-ok (#379)", async () => {
    // Before #379 the !res.ok branch returned null with ZERO logging — loadPack then skips
    // sha256 verification for the whole session with no operator-visible signal (Rule 8).
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503 }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fetchManifest();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("MANIFEST_FETCH_HTTP-503"));
  });

  it("rejects a valid-JSON non-manifest body (CDN error envelope) with a MANIFEST_SHAPE_INVALID log (#379)", async () => {
    // An HTTP-200 error envelope ({"error":"..."}) previously passed the `as Manifest` cast
    // silently; loadPack saw manifest.packs === undefined and skipped verification.
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ error: "origin unavailable" }) }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fetchManifest();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("MANIFEST_SHAPE_INVALID"));
  });

  it("rejects a manifest whose pack entries lack the fields loadPack consumes (version/sha256) (#379)", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ _version: 1, generatedAt: "x", packs: { it: { name: "Italian" } } }),
    }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fetchManifest();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("MANIFEST_SHAPE_INVALID"));
  });

  it("rejects an array packs body and an empty packs record — vacuous-truth guard (#379 DSC-2)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Arrays pass typeof "object" and .every() is vacuously true on {} — both previously
    // slipped through and reproduced the silent verification skip.
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ packs: [] }) }));
    expect(await fetchManifest()).toBeNull();
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ packs: {} }) }));
    expect(await fetchManifest()).toBeNull();
    const shapeLogs = consoleErrorSpy.mock.calls.filter(
      args => typeof args[0] === "string" && (args[0] as string).includes("MANIFEST_SHAPE_INVALID")
    );
    expect(shapeLogs).toHaveLength(2);
  });

  it("accepts a well-formed manifest unchanged (#379 — shape gate must not reject real manifests)", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => fakeManifest() }));

    const result = await fetchManifest();

    expect(result).toEqual(fakeManifest());
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

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // Manifest sha256 matches malformed data → hash passes → shape check fires
    const result = await loadPack("it", fakeManifest(malformedSha));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    // Shape validation rejects at cache-hit time — no download attempt
    expect(fetchSpy).not.toHaveBeenCalled();
    // Malformed data evicted from cache — both keys, not just data (Task #260: a regression
    // dropping only meta-key removal from clearPackCache would slip past a data-key-only check)
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    // Shape-validation failures must log, same as JSON.parse failures do (Task #260 follow-up)
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
  });

  it("returns parse_error when no-manifest cache-hit pack has non-array units", async () => {
    // No manifest (null) → no hash verification. Shape validation is the only safety check.
    // Without hasValidUnitsArray at the no-manifest site the malformed pack returns ok:true.
    // Test fails if the guard is removed from the no-manifest (offline-serve-as-is) branch.
    const malformedPack = { ...fakePack(), units: null };
    localStorageMock.setItem("pack-data-v1-it", JSON.stringify(malformedPack));
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: "", cachedAt: Date.now() }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    // No download attempted — shape check fires at cache-hit time
    expect(fetchSpy).not.toHaveBeenCalled();
    // Malformed data evicted from cache — both keys, not just data (Task #260)
    expect(localStorageMock.getItem("pack-data-v1-it")).toBeNull();
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    // Shape-validation failures must log, same as JSON.parse failures do (Task #260 follow-up)
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
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

describe("clearPackCache — atomicity: memCache cleared even when storage removeItem throws (#252)", () => {
  it("clears memCache and logs error when the second storage removeItem throws — storage failure does not leave a stale in-memory entry", async () => {
    // Load a pack so it's in memCache and storage
    vi.stubGlobal("fetch", async () => ({ ok: true, text: async () => PACK_JSON }));
    const firstLoad = await loadPack("it", fakeManifest());
    expect(firstLoad.ok).toBe(true); // pack loaded into memCache

    // Mock removeItem to succeed for meta key, throw for data key (second call)
    let removeItemCallCount = 0;
    const removeItemSpy = vi.spyOn(localStorageMock, "removeItem").mockImplementation((key) => {
      removeItemCallCount++;
      if (removeItemCallCount === 2) throw new Error("Storage I/O error");
      delete store[key];
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await evictPack("it");
      // Error must be logged with ref ID — no silent failure
      const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
      expect(logKeys.some(msg => msg.includes("ERR-CACHE-CLEAR-DATA-it"))).toBe(true);
      // memCache must be cleared despite the storage throw — next load fetches again
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
      const result = await loadPack("it", fakeManifest());
      expect(result.ok).toBe(true);
    } finally {
      removeItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
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

    const evictResult = await evictPack("../evil");
    // #398: the no-op is now visible at the call site as a typed result
    expect(evictResult).toEqual({ evicted: false, reason: "unregistered_code" });

    // Guard fired — clearPackCache was NOT called — poisoned entries must still exist
    expect(localStorageMock.getItem("pack-meta-v1-../evil")).toBe("poison");
    expect(localStorageMock.getItem("pack-data-v1-../evil")).toBe("poison-data");
    // Italian data not collateral-damaged (exact value preserved)
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBe(italianMeta);
  });

  it("#271: evictPack logs a warning when given a registered specialty pack code — no silent no-op", async () => {
    // Specialty codes pass the isValidPackCode guard as false — Task #271 fix emits a warning
    // so callers know to evict the base language instead.
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const evictResult = await evictPack("it-medical");
      // #398: the specialty no-op names the base language to evict instead — in the RESULT,
      // so callers branch on data rather than parsing console output. The former second
      // (escalated error) log is gone: the typed result IS that signal now (#402 resolved).
      expect(evictResult).toEqual({ evicted: false, reason: "specialty_code", useInstead: "it" });
      const messages = warnSpy.mock.calls.map(args => args[0] as string);
      // Warning must name the specialty code and the correct base language to evict instead
      expect(messages.some(msg => msg.includes("it-medical"))).toBe(true);
      expect(messages.some(msg => msg.includes('"it"'))).toBe(true);
      // #398/#402 regression guard ON THE BRANCH THAT CHANGED: exactly one warn, and the
      // former escalated ERR-EVICT-SPECIALTY console.error must not return — the typed
      // result replaced it. Reintroducing either fails here.
      expect(warnSpy.mock.calls.filter(a => (a[0] as string).includes("it-medical"))).toHaveLength(1);
      expect(errorSpy.mock.calls.filter(a => typeof a[0] === "string" && (a[0] as string).includes("EVICT"))).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      mockSpecialtyPacks.length = 0;
    }
  });
});

describe("seedMemCache — #337 allowlist validation", () => {
  it("rejects an unregistered lang code and logs ERR-SEED-INVALID-LANG", () => {
    // Before #337, seedMemCache wrote directly to memCache with no READY_PACK_CODES check,
    // silently invalidating the memCache invariant (only validated codes may be present).
    // Deleting the guard causes this test to fail because: (a) no console.error is logged,
    // and (b) a subsequent loadPack("garbage", ...) would hit memCache instead of returning invalid_lang.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // The boolean return (cycle-2) makes the refusal directly assertable — false = rejected,
    // nothing written to memCache.
    expect(seedMemCache("garbage-code", [])).toBe(false);
    const messages = errorSpy.mock.calls.map(args => args[0] as string);
    expect(messages.some(msg => msg.includes("ERR-SEED-INVALID-LANG"))).toBe(true);
    errorSpy.mockRestore();
  });

  it("accepts a valid ready lang code without logging an error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    seedMemCache("it", []);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("evictPack — #341 garbage-code warning", () => {
  it("logs a warning when given a fully unregistered code (neither base nor specialty)", async () => {
    // Before #341, evictPack silently no-oped for garbage codes — violating Rule 8 (Log Everything).
    // Deleting the else-branch console.warn causes this test to fail.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const evictResult = await evictPack("garbage-xyz");
    expect(evictResult).toEqual({ evicted: false, reason: "unregistered_code" });
    const messages = warnSpy.mock.calls.map(args => args[0] as string);
    expect(messages.some(msg => msg.includes("garbage-xyz"))).toBe(true);
    // #398/#402: exactly ONE log per rejected call — the typed result replaced the
    // escalated duplicate error log.
    expect(warnSpy.mock.calls.filter(a => (a[0] as string).includes("garbage-xyz"))).toHaveLength(1);
    expect(errorSpy.mock.calls.filter(a => typeof a[0] === "string" && (a[0] as string).includes("EVICT"))).toHaveLength(0);
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("loadPack — #350 base-pack entitlement check", () => {
  it("returns invalid_lang for a non-free ready base pack when unlockedLangs is absent", async () => {
    // Before #350, the base-pack branch had no entitlement check — any caller could load any
    // ready base pack regardless of subscription status, unlike specialty packs which independently
    // re-check purchasedAddOns. This test fails if the FREE_PACK_CODES guard is removed.
    // mockFreePackCodes is empty (set via mockFreePackCodes.length=0 before push("it") in beforeEach,
    // then immediately cleared here) so "it" appears as a non-free pack.
    mockFreePackCodes.length = 0; // treat "it" as non-free for this test
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proceeds normally when unlockedLangs includes the non-free base pack code", async () => {
    // Mirrors the specialty-pack pattern: caller passes unlockedLangs to prove entitlement.
    mockFreePackCodes.length = 0; // treat "it" as non-free
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it", fakeManifest(), { unlockedLangs: ["it"] });
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("free base packs (FREE_PACK_CODES) load without unlockedLangs (no entitlement needed)", async () => {
    // Default mockFreePackCodes includes "it" — free packs must never require unlockedLangs.
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
    const r = await loadPack("it", fakeManifest());
    expect(r.ok).toBe(true); // pack loaded and in memCache

    clearCacheForTesting();

    // getLoadedAddOns must be cleared — primary purpose of this test
    expect(getLoadedAddOns()).toEqual([]);
    // memCache is cleared — verify by checking next memory-cache short-circuit does NOT fire:
    // a second loadPack call after clearCacheForTesting falls through to storage/network,
    // not the memCache.has() early return. clearPackCacheState nulls _storage but not
    // localStorage content, so the pack is served from storage (no fetch) — this is expected
    // and correct behaviour; we just confirm the call doesn't throw.
    const r2 = await loadPack("it", fakeManifest());
    expect(r2.ok).toBe(true);
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

  // Some tests below stub crypto.subtle.digest to reject, to prove the sha256Hex call sites
  // are guarded (#405). Restore the real digest after every test in this block so a leftover
  // rejecting stub can never leak into a later test.
  afterEach(() => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async (_algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
          const hash = createHash("sha256").update(Buffer.from(data)).digest();
          return hash.buffer as ArrayBuffer;
        },
      },
    });
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

    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

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

    const result = await loadPack("it-medical", null, { purchasedAddOns: ["it-medical"] });

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
    await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Second add-on call — must return ok:true from the idempotency path, no 3rd fetch
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // no additional fetch
    expect(getLoadedAddOns()).toContain("it-medical");
  });

  it("#253: evicting the base pack also removes its specialty add-ons from getLoadedAddOns", async () => {
    // Merge an add-on into the base pack, then evict the base — the add-on must no longer
    // be reported as loaded. Without the fix, loadedAddOns still shows "it-medical" and a
    // subsequent loadPack("it") + loadPack("it-medical") would silently skip the merge.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(getLoadedAddOns()).toContain("it-medical");

    // Evict the base pack — specialty add-on must be pruned
    await evictPack("it");

    // Base pack storage cleared — confirms eviction happened
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBeNull();
    expect(getLoadedAddOns()).not.toContain("it-medical");
  });

  it("#259: force-redownloading a base pack prunes its merged specialty add-on from getLoadedAddOns", async () => {
    // Merge the add-on, then force-redownload the base. Without the fix, the fresh unmerged
    // base pack overwrites memCache but loadedAddOns still reports "it-medical" as loaded —
    // getLoadedAddOns() lies about what's actually in memory.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })         // call 1: base "it"
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON }); // call 2: add-on "it-medical"
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(getLoadedAddOns()).toContain("it-medical");

    // Force-redownload the base — must prune the merged add-on from loadedAddOns
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON }));
    await loadPack("it", fakeAddOnManifest(), { forceRedownload: true });

    expect(getLoadedAddOns()).not.toContain("it-medical");
  });

  it("#259/#260: force-redownloading a base pack prunes its merged specialty add-on via the !res.ok offline-fallback path", async () => {
    // Sibling of the fresh-download-success #259 test above — this exercises a DIFFERENT one of
    // the 3 forceRedownload-reachable memCache.set sites (the offline-fallback path, reached when
    // the forced redownload's fetch itself fails and platform-storage-cached bytes are served
    // instead). Before Task #260's shared-helper extraction, only the fresh-download success site
    // was covered; this test fails if the offline-fallback branch's clearSpecialtyPacksForLang call
    // regresses independently of the fresh-download site.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(getLoadedAddOns()).toContain("it-medical");

    // Force-redownload fails (HTTP error) — falls back to the valid (unmerged) storage-cached
    // base pack. loadedAddOns must still be pruned even though this is the fallback path, not
    // the success path.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }));
    const result = await loadPack("it", fakeAddOnManifest(), { forceRedownload: true });

    expect(result.ok).toBe(true);
    expect(getLoadedAddOns()).not.toContain("it-medical");
  });

  it("#259/#260: force-redownloading a base pack prunes its merged specialty add-on via the network-throw offline-fallback path", async () => {
    // Sibling of the test above — the network-throw offline-fallback branch is a structurally
    // identical but independently-routed path (a separate catch block in loadPack). Fails if
    // this specific branch's clearSpecialtyPacksForLang call regresses even if the !res.ok
    // sibling above still has it.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(getLoadedAddOns()).toContain("it-medical");

    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(async () => { throw new Error("Network error"); }));
    const result = await loadPack("it", fakeAddOnManifest(), { forceRedownload: true });

    expect(result.ok).toBe(true);
    expect(getLoadedAddOns()).not.toContain("it-medical");
  });

  it("rejects a malformed add-on pack, proving specialtyPackLoader.ts's shape check actually rejects bad units (Task #250)", async () => {
    // specialtyPackLoader.ts delegates its shape check to lib/packTypes.ts's hasValidUnitsArray
    // instead of its own inline Array.isArray(...) copy. This test proves the rejection behavior
    // holds today — it does NOT prove delegation specifically, since reverting to the old
    // functionally-identical inline check would still pass this exact assertion set (Task #260
    // note: delegation itself is verified by code review / the import statement, not by this test).
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
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await loadPack("it", manifest);
    const result = await loadPack("it-medical", manifest, { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
    expect(getLoadedAddOns()).not.toContain("it-medical");
    // Shape-validation failures must log, same as download/parse failures do (Task #260 follow-up)
    const logKeys = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL"))).toBe(true);
  });

  it("#400: malformed add-on pack rejection delegates to the shared hasValidUnitsArray helper, not an inline duplicate check", async () => {
    // Task #400 (audit F024): the test above proves the REJECTION BEHAVIOR but not delegation
    // — a reverted inline Array.isArray(...) copy in specialtyPackLoader.ts would pass that
    // test's assertions identically, defeating the single-source-of-truth guarantee the shared
    // packTypes.ts helper is meant to provide. This test spies on the actual exported function
    // (same pattern as tests/entitlement.test.ts's "hasAddOn store action delegates to
    // lib/entitlement.ts hasAddOn" test) and asserts specialtyPackLoader.ts calls it with the
    // parsed malformed add-on object. Reverting to an inline duplicate check would leave this
    // spy uncalled and fail the test, even though the behavioral rejection would still hold.
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
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hasValidUnitsArraySpy = vi.spyOn(packTypesLib, "hasValidUnitsArray");

    await loadPack("it", manifest);
    const result = await loadPack("it-medical", manifest, { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(false);
    expect(hasValidUnitsArraySpy).toHaveBeenCalledWith(
      expect.objectContaining({ units: "not-an-array" })
    );
  });

  it("#405: sha256Hex throwing during fresh add-on download verification surfaces as a typed checksum_mismatch, never a rejection", async () => {
    // Mirrors K2-002's base-pack test for the specialtyPackLoader fresh-download site.
    // Deleting the try/catch around the fresh-download sha256Hex in specialtyPackLoader.ts's
    // _doLoad turns this into a rejected promise — the await below would throw and fail the test.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
    await loadPack("it", fakeAddOnManifest()); // base pack loads fine with the good crypto stub

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => ADD_ON_PACK_JSON }));
    vi.stubGlobal("crypto", { subtle: { digest: () => Promise.reject(new Error("webcrypto unavailable")) } });

    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result).toEqual({ ok: false, error: "checksum_mismatch" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SHA_VERIFY_FAIL-it-medical"), expect.any(Error));
    expect(getLoadedAddOns()).not.toContain("it-medical");
    errorSpy.mockRestore();
  });

  it("#405: sha256Hex throwing during cached-copy re-verification surfaces as a typed checksum_mismatch, never a rejection", async () => {
    // Mirrors the fresh-download test above for the OTHER guarded site: re-verifying a
    // previously-cached add-on's bytes before trusting them. Preset a valid, previously-cached
    // add-on entry whose sha256 matches the manifest (mirrors the "malformed add-on pack" test's
    // localStorage-preset pattern), then reject the digest call that re-verifies it.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorageMock.setItem("pack-data-v1-it-medical", ADD_ON_PACK_JSON);
    localStorageMock.setItem(
      "pack-meta-v1-it-medical",
      JSON.stringify({ version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: 1 })
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
    await loadPack("it", fakeAddOnManifest()); // base pack loads fine with the good crypto stub

    vi.stubGlobal("crypto", { subtle: { digest: () => Promise.reject(new Error("webcrypto unavailable")) } });

    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result).toEqual({ ok: false, error: "checksum_mismatch" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SHA_VERIFY_FAIL-it-medical"), expect.any(Error));
    expect(getLoadedAddOns()).not.toContain("it-medical");
    errorSpy.mockRestore();
  });

  it("#261: returns invalid_lang without fetching when specialty code is not in purchasedAddOns", async () => {
    // Entitlement gate: a registered, ready specialty code with the base pack loaded must be
    // rejected before any network request if purchasedAddOns does not include it.
    // This test fails if the purchasedAddOns.includes(lang) check is removed from loadSpecialtyPack.
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    // Load base pack so the base_pack_not_loaded guard doesn't fire before the entitlement check
    await loadPack("it", fakeAddOnManifest());
    const baseFetchCount = fetchSpy.mock.calls.length;

    // purchasedAddOns is empty — "it-medical" is NOT purchased
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    // No additional fetch for the add-on — gate fires before network
    expect(fetchSpy.mock.calls.length).toBe(baseFetchCount);
    expect(getLoadedAddOns()).not.toContain("it-medical");
  });

  it("#261: purchasedAddOns defaults to [] when options omitted — specialty code is rejected", async () => {
    // Mirrors the explicit-empty test above but exercises the options-omitted code path
    // in loadPack (options?.purchasedAddOns ?? []). Ensures omitting the options arg does not
    // bypass the entitlement gate.
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    const baseFetchCount = fetchSpy.mock.calls.length;

    // No purchasedAddOns option at all
    const result = await loadPack("it-medical", fakeAddOnManifest());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_lang");
    expect(fetchSpy.mock.calls.length).toBe(baseFetchCount);
  });

  it("#265: returns checksum_mismatch and logs ADDON_NO_MANIFEST when the manifest has no entry for the specialty code", async () => {
    // Fail-closed: if the manifest entry for the specialty code is absent, the downloaded
    // content must be rejected without parsing or merging. Before this fix, the sha256 check
    // was skipped entirely and arbitrary content could be merged with zero integrity verification.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Load base pack with a manifest that has no "it-medical" entry
    await loadPack("it", fakeManifest());

    // Attempt to load the add-on — its manifest entry is absent
    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("checksum_mismatch");
    expect(getLoadedAddOns()).not.toContain("it-medical");
    const logMessages = consoleErrorSpy.mock.calls.map(args => args[0] as string);
    expect(logMessages.some(msg => msg.includes("ADDON_NO_MANIFEST"))).toBe(true);
    consoleErrorSpy.mockRestore();
  });
});

describe("specialty pack — same-code concurrent load safety (#264)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
  });

  it("#264 same-code dedup: loadSpecialtyPack returns the exact same Promise reference for concurrent same-code calls", async () => {
    // This test proves the same-code dedup mechanism itself, not just its behavioral outcome.
    // Cross-code serialization alone also produces one fetch and one loadedAddOns entry (by
    // chaining the second call behind the first via the base-lang inFlight key, then
    // early-returning when loadedAddOns.includes re-checks). Fetch-count alone cannot
    // distinguish the two mechanisms — Promise reference equality is the only observable
    // difference: same-code dedup returns the EXACT same inFlight Promise; cross-code alone
    // creates a new p1.then(...) chain. Deleting the same-code check fails this assertion.
    // loadSpecialtyPack is non-async (Barry, Wave 11) so the reference is visible to callers.
    // loadPack is async and wraps every call in a new Promise, hiding this invariant. (#321)
    const { loadSpecialtyPack: lsp } = await import("@/lib/specialtyPackLoader");

    // Minimal PackMemCache with the "it" base pack pre-loaded (mirrors post-loadPack("it") state).
    const base = fakePack();
    const _m = new Map<string, Pack>([[base.lang, base]]);
    const mockMemCache = {
      has:    (k: string)          => _m.has(k),
      get:    (k: string)          => _m.get(k),
      keys:   ()                   => _m.keys(),
      write:  (k: string, v: Pack) => { _m.set(k, v); },
      merge:  (k: string, v: Pack) => { _m.set(k, v); },
      delete: (k: string)          => { _m.delete(k); },
      clear:  ()                   => { _m.clear(); },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, text: async () => ADD_ON_PACK_JSON,
    }));

    const p1 = lsp("it-medical", mockMemCache, fakeAddOnManifest(), ["it-medical"]);
    const p2 = lsp("it-medical", mockMemCache, fakeAddOnManifest(), ["it-medical"]);
    expect(p1).toBe(p2); // same Promise reference — deleting the in-flight check makes p1 !== p2
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("#264 same-code behavioral: two concurrent loadPack calls issue only one add-on fetch and add the code exactly once", async () => {
    // Regression guard: the combined dedup mechanisms keep fetch-count at 1 and loadedAddOns
    // clean for two concurrent same-code loadPack calls.
    let addonFetchCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if ((url as string).includes("it-medical")) addonFetchCount++;
      const body = (url as string).includes("it-medical") ? ADD_ON_PACK_JSON : PACK_JSON;
      return { ok: true, text: async () => body };
    }));

    await loadPack("it", fakeAddOnManifest());
    addonFetchCount = 0; // reset after base pack load

    const [r1, r2] = await Promise.all([
      loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] }),
      loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] }),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(addonFetchCount).toBe(1);
    expect(getLoadedAddOns().filter(c => c === "it-medical")).toHaveLength(1);
  });
});

describe("specialty pack — storage persistence (#269)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
  });

  it("#269: persists specialty pack to storage after successful merge", async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(true);
    // Specialty pack data persisted under its own key — not the base pack key
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(ADD_ON_PACK_JSON);
    const meta = JSON.parse(localStorageMock.getItem("pack-meta-v1-it-medical")!);
    expect(meta.version).toBe("1.0.0");
    expect(meta.sha256).toBe(ADD_ON_SHA);
    // existence-check: cachedAt is Date.now() at write time, non-deterministic
    expect(typeof meta.cachedAt).toBe("number");
  });

  it("#269: serves specialty pack from storage on reload without re-fetching", async () => {
    // First session: load base + specialty pack (2 fetches)
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Simulate reload: clear in-memory state; storage (localStorageMock) persists
    clearCacheForTesting();

    // Second session: no fetches needed — base and specialty both in storage
    const fetchSpy2 = vi.fn();
    vi.stubGlobal("fetch", fetchSpy2);

    await loadPack("it", fakeAddOnManifest());
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(true);
    expect(fetchSpy2).not.toHaveBeenCalled(); // no network call on reload
    if (result.ok) {
      expect(result.pack.unitCount).toBe(fakePack().unitCount + fakeAddOnPack().unitCount);
    }
  });

  it("#269: evicts corrupted specialty cache and re-fetches when sha256 mismatches", async () => {
    // Seed with corrupted bytes — version matches manifest but sha256 of data doesn't
    localStorageMock.setItem("pack-data-v1-it-medical", '{"corrupted":true}');
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: Date.now(),
    }));

    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // add-on was re-fetched
    // Fresh correct bytes now persisted — old corrupted entry overwritten
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(ADD_ON_PACK_JSON);
  });

  it("#269: serves stale specialty cache as offline fallback when download fails (version mismatch)", async () => {
    // Pre-seed with old version — manifest has "1.0.0" → version mismatch → not a cache hit
    const oldPack = { ...fakeAddOnPack(), packVersion: "0.9.0" };
    const oldJson = JSON.stringify(oldPack);
    localStorageMock.setItem("pack-data-v1-it-medical", oldJson);
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "0.9.0", sha256: createHash("sha256").update(oldJson).digest("hex"), cachedAt: Date.now(),
    }));

    // Base loads fine; add-on download fails (offline)
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest()); // manifest says "1.0.0" for it-medical
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    // Stale cache served — better than failing cold when offline
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack.unitCount).toBe(fakePack().unitCount + fakeAddOnPack().unitCount);
    }
    expect(getLoadedAddOns()).toContain("it-medical");
  });

  it("#269: A003 — integrity-failed specialty cache is not served as offline fallback", async () => {
    // Seed cache with data whose sha256 doesn't match the manifest (simulates corruption).
    // After sha256 eviction, cachedData must be nulled so it can't reach the offline fallback.
    // Without A003: cachedData stays non-null → stale-cache fallback serves corrupt bytes → ok:true.
    // With A003: cachedData nulled → offline fallback skips → ok:false download_failed.
    localStorageMock.setItem("pack-data-v1-it-medical", '{"corrupted":true}');
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: Date.now(),
    }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    // Base loads; add-on download fails after sha256 eviction fires
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => PACK_JSON })
      .mockResolvedValueOnce(async () => { throw new Error("Network unavailable"); });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeAddOnManifest());
    const result = await loadPack("it-medical", fakeAddOnManifest(), { purchasedAddOns: ["it-medical"] });

    // Integrity-failed cache must not be served
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("download_failed");
  });
});

describe("specialty pack — cross-code concurrent load safety (#264)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push(
      { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
      { code: "it-business", baseLang: "it", name: "Business Italian", ready: true },
    );
  });

  it("#264 cross-code: concurrent loads for the same base lang both land without clobbering each other", async () => {
    // Without cross-code serialization, both loads read the same unmerged base pack snapshot.
    // Whichever merge resolves last silently discards the other's units when it calls
    // memCache.merge() with a stale base, yet getLoadedAddOns() still reports both as loaded.
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if ((url as string).includes("it-medical")) return { ok: true, text: async () => ADD_ON_PACK_JSON };
      if ((url as string).includes("it-business")) return { ok: true, text: async () => ADD_ON_BUSINESS_PACK_JSON };
      return { ok: true, text: async () => PACK_JSON };
    }));

    await loadPack("it", fakeTwoAddOnManifest());

    await Promise.all([
      loadPack("it-medical", fakeTwoAddOnManifest(), { purchasedAddOns: ["it-medical", "it-business"] }),
      loadPack("it-business", fakeTwoAddOnManifest(), { purchasedAddOns: ["it-medical", "it-business"] }),
    ]);

    // Both codes must be tracked
    expect(getLoadedAddOns()).toContain("it-medical");
    expect(getLoadedAddOns()).toContain("it-business");

    // The merged pack in memCache must contain units from BOTH add-ons.
    // Fetching via the idempotency path returns the current memCache state.
    const merged = await loadPack("it-medical", fakeTwoAddOnManifest(), { purchasedAddOns: ["it-medical", "it-business"] });
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      const expected = fakePack().cardCount + fakeAddOnPack().cardCount + fakeAddOnBusinessPack().cardCount;
      expect(merged.pack.cardCount).toBe(expected);
    }
  });
});

describe("#378 — concurrent loadPack calls for the same base pack share one in-flight load", () => {
  it("two concurrent loadPack calls trigger exactly one fetch and resolve to the same result object", async () => {
    // GIVEN a download we control manually, so both calls are in flight simultaneously.
    // Without dedup, both pass the memCache.has() check (TOCTOU) and both fetch — the loser's
    // write would clobber any specialty units merged into memCache in between (pre-mortem F1).
    let resolveFetch!: (v: { ok: boolean; text: () => Promise<string> }) => void;
    const fetchSpy = vi.fn().mockImplementation(
      () => new Promise<{ ok: boolean; text: () => Promise<string> }>((res) => { resolveFetch = res; })
    );
    vi.stubGlobal("fetch", fetchSpy);

    // WHEN two calls race
    const p1 = loadPack("it", fakeManifest());
    const p2 = loadPack("it", fakeManifest());
    // The fetch fires only after loadPack's async storage reads — wait for it before resolving.
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    resolveFetch({ ok: true, text: async () => PACK_JSON });
    const [r1, r2] = await Promise.all([p1, p2]);

    // THEN one download, one shared settled result (same object — same underlying promise)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.pack.lang).toBe("it");
    expect(r2).toBe(r1);
  });

  it("releases the in-flight slot after completion — a post-eviction call re-fetches", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    await loadPack("it", fakeManifest());
    await evictPack("it");
    const result = await loadPack("it", fakeManifest());

    // A leaked in-flight entry would replay the first (stale) promise with no second fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("forceRedownload bypasses the in-flight dedup — a forced call fetches even while a normal load is pending", async () => {
    let resolveFirst!: (v: { ok: boolean; text: () => Promise<string> }) => void;
    const fetchSpy = vi.fn()
      .mockImplementationOnce(
        () => new Promise<{ ok: boolean; text: () => Promise<string> }>((res) => { resolveFirst = res; })
      )
      .mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    const normal = loadPack("it", fakeManifest());
    const forced = loadPack("it", fakeManifest(), { forceRedownload: true });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    resolveFirst({ ok: true, text: async () => PACK_JSON });
    const [rNormal, rForced] = await Promise.all([normal, forced]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(rNormal.ok).toBe(true);
    expect(rForced.ok).toBe(true);
  });
});

describe("#378 audit remediation — eviction generation, seed behavior, write ordering", () => {
  it("an eviction during an in-flight load prevents the late resolution from re-populating memCache or storage (F001)", async () => {
    let resolveFetch!: (v: { ok: boolean; text: () => Promise<string> }) => void;
    const fetchSpy = vi.fn().mockImplementation(
      () => new Promise<{ ok: boolean; text: () => Promise<string> }>((res) => { resolveFetch = res; })
    );
    vi.stubGlobal("fetch", fetchSpy);

    // GIVEN a load in flight
    const pending = loadPack("it", fakeManifest());
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    // WHEN the pack is evicted mid-flight (clearEntitlement path), THEN the download resolves
    await evictPack("it");
    resolveFetch({ ok: true, text: async () => PACK_JSON });
    const result = await pending;

    // The initiating caller still gets the verified pack for this session...
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.lang).toBe("it");
    // ...but NOTHING is written back — no resurrection in storage or memory.
    expect(localStorageMock.getItem("pack-data-v1-it")).toBe(null);
    expect(localStorageMock.getItem("pack-meta-v1-it")).toBe(null);
    // A fresh load must go to the network again (memCache empty), proving no memory write.
    fetchSpy.mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    await loadPack("it", fakeManifest());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("seedMemCache writes a synthesized pack that loadPack then serves from memory with exact derived fields (F015)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const unit = { id: "it-u01", name: "Greetings", theme: "greetings", emoji: "👋", level: "A1", prerequisiteUnits: [], cards: [{ id: "c1", type: "recognize", prompt: "ciao", tier: 1, accepted: ["hello"], tags: [] }, { id: "c2", type: "produce", prompt: "hello", tier: 1, accepted: ["ciao"], tags: [] }] };

    seedMemCache("it", [unit] as never);

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Exact synthesized fields — deleting memCache.write inside seedMemCache, or breaking
      // the cardCount reduce, fails these (the old test only asserted no console.error).
      expect(result.pack.lang).toBe("it");
      expect(result.pack.packVersion).toBe("static");
      expect(result.pack.unitCount).toBe(1);
      expect(result.pack.cardCount).toBe(2);
      expect(result.pack.units[0]).toBe(unit);
    }
    // Served from memory: the seed made the network unnecessary.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("seedMemCache is idempotent — a second seed never overwrites the existing entry (F015/AC7)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const firstUnits = [{ id: "it-u01", name: "A", theme: "t", emoji: "e", level: "A1", prerequisiteUnits: [], cards: [] }];
    const secondUnits = [{ id: "it-u99", name: "B", theme: "t", emoji: "e", level: "A1", prerequisiteUnits: [], cards: [] }];

    seedMemCache("it", firstUnits as never);
    seedMemCache("it", secondUnits as never);

    const result = await loadPack("it", fakeManifest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.units[0]!.id).toBe("it-u01");
  });

  it("seedMemCache rejects a ready-but-non-free lang — entitlement-blind seeding is restricted to FREE_PACK_CODES (F013)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchSpy);
    mockFreePackCodes.length = 0; // "it" is ready but no longer free

    seedMemCache("it", [] as never);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-SEED-NONFREE-LANG-it"));
    // Nothing seeded: a subsequent load cannot be served from memory. ("it" non-free with no
    // unlockedLangs now hits the #350 entitlement gate — invalid_lang — proving no memory hit.)
    const result = await loadPack("it", fakeManifest());
    expect(result).toEqual({ ok: false, error: "invalid_lang" });
    errorSpy.mockRestore();
  });

  it("fresh download writes cache META before DATA so an interrupt cannot orphan unverified bytes (F025, mirrors #309)", async () => {
    const setItemSpy = vi.spyOn(localStorageMock, "setItem");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));

    await loadPack("it", fakeManifest());

    const packWrites = setItemSpy.mock.calls.map(c => c[0]).filter(k => k === "pack-meta-v1-it" || k === "pack-data-v1-it");
    expect(packWrites).toEqual(["pack-meta-v1-it", "pack-data-v1-it"]);
    setItemSpy.mockRestore();
  });

  it("a non-forced call arriving during a FORCED load shares the forced load's promise — no competing write (F010)", async () => {
    let resolveFetch!: (v: { ok: boolean; text: () => Promise<string> }) => void;
    const fetchSpy = vi.fn().mockImplementation(
      () => new Promise<{ ok: boolean; text: () => Promise<string> }>((res) => { resolveFetch = res; })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const forced = loadPack("it", fakeManifest(), { forceRedownload: true });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const normal = loadPack("it", fakeManifest());
    resolveFetch({ ok: true, text: async () => PACK_JSON });
    const [rForced, rNormal] = await Promise.all([forced, normal]);

    // One fetch: the forced load registered its promise and the normal call piggybacked.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(rNormal).toBe(rForced);
  });
});

describe("#378 cycle-2 remediation — eviction windows, SHA failure, forced-load supersession, stale integrity", () => {
  const goodDigest = async (_algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
    const hash = createHash("sha256").update(Buffer.from(data)).digest();
    return hash.buffer as ArrayBuffer;
  };
  afterEach(() => {
    // Restore the file-level Web Crypto stub — some tests below replace digest.
    vi.stubGlobal("crypto", { subtle: { digest: goodDigest } });
  });

  it("sha256Hex throwing during fresh-download verification surfaces as a typed checksum_mismatch, never a rejection (K2-002)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON }));
    vi.stubGlobal("crypto", { subtle: { digest: () => Promise.reject(new Error("webcrypto unavailable")) } });

    // Deleting the try/catch around the fresh-download sha256Hex turns this into a
    // rejected promise — the await below would throw and fail the test.
    const result = await loadPack("it", fakeManifest());

    expect(result).toEqual({ ok: false, error: "checksum_mismatch" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SHA_VERIFY_FAIL-it"), expect.any(Error));
    // Fail closed: unverifiable bytes are never cached.
    expect(localStorageMock.getItem("pack-data-v1-it")).toBe(null);
    errorSpy.mockRestore();
  });

  it("an eviction during an in-flight CACHE-HIT serve prevents the memCache write (K2-001a)", async () => {
    // GIVEN a valid stored cache whose hash re-verification we control
    localStorageMock.setItem("pack-data-v1-it", PACK_JSON);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: CORRECT_SHA, cachedAt: 1 }));
    let resolveDigest!: (v: ArrayBuffer) => void;
    const digestSpy = vi.fn().mockImplementation(() => new Promise<ArrayBuffer>((res) => { resolveDigest = res; }));
    vi.stubGlobal("crypto", { subtle: { digest: digestSpy } });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    // WHEN eviction fires while the cache-hit hash re-verify is pending
    const pending = loadPack("it", fakeManifest());
    await vi.waitFor(() => expect(digestSpy).toHaveBeenCalled());
    await evictPack("it");
    resolveDigest(createHash("sha256").update(PACK_JSON).digest().buffer as ArrayBuffer);
    const result = await pending;

    // THEN the initiating caller is served, but memCache was NOT repopulated: a fresh
    // load must go to the network (storage was cleared by the eviction). Deleting the
    // generation guard on the cache-hit path lets validateAndCache write memCache and the
    // second load below becomes a memory hit with zero fetches.
    expect(result.ok).toBe(true);
    vi.stubGlobal("crypto", { subtle: { digest: goodDigest } });
    await loadPack("it", fakeManifest());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("an eviction during an in-flight OFFLINE STALE-FALLBACK serve prevents the memCache write (K2-001b)", async () => {
    // GIVEN a version-stale but integrity-intact cache, and a download we control
    localStorageMock.setItem("pack-data-v1-it", PACK_JSON);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.9", sha256: CORRECT_SHA, cachedAt: 1 }));
    let resolveFetch!: (v: { ok: boolean; status: number }) => void;
    const fetchSpy = vi.fn().mockImplementation(() => new Promise<{ ok: boolean; status: number }>((res) => { resolveFetch = res; }));
    vi.stubGlobal("fetch", fetchSpy);

    // WHEN eviction fires while the (failing) download is pending, forcing the stale path
    const pending = loadPack("it", fakeManifest());
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await evictPack("it");
    resolveFetch({ ok: false, status: 503 });
    const result = await pending;

    // THEN stale bytes are served to the initiating caller without any cache write —
    // deleting the guard on the fallback path re-caches them and the load below becomes
    // a zero-fetch memory hit instead of a second network attempt.
    expect(result.ok).toBe(true);
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => PACK_JSON } as never);
    await loadPack("it", fakeManifest());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("a forced re-download supersedes a pending normal load's right to cache (N3) — the stale normal bytes cannot clobber the forced fresh bytes", async () => {
    // Manifest-less load: meta.version comes from pack.packVersion, letting the two loads'
    // bytes be distinguished by version. Normal load's fetch is held open; forced fetch
    // resolves immediately with NEWER content.
    const v1Json = JSON.stringify({ ...fakePack(), packVersion: "1.0.0" });
    const v2Json = JSON.stringify({ ...fakePack(), packVersion: "2.0.0" });
    let resolveNormal!: (v: { ok: boolean; text: () => Promise<string> }) => void;
    const fetchSpy = vi.fn()
      .mockImplementationOnce(() => new Promise<{ ok: boolean; text: () => Promise<string> }>((res) => { resolveNormal = res; }))
      .mockResolvedValue({ ok: true, text: async () => v2Json });
    vi.stubGlobal("fetch", fetchSpy);

    const normal = loadPack("it", null);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const forced = loadPack("it", null, { forceRedownload: true });
    const rForced = await forced;
    expect(rForced.ok).toBe(true);

    // Stale normal load settles LAST — without the forced-start generation bump its write
    // would land last and clobber the forced bytes.
    resolveNormal({ ok: true, text: async () => v1Json });
    const rNormal = await normal;
    expect(rNormal.ok).toBe(true);

    // THEN storage and memory hold the forced (v2) bytes, not the stale normal (v1) bytes.
    const meta = JSON.parse(localStorageMock.getItem("pack-meta-v1-it")!);
    expect(meta.version).toBe("2.0.0");
    const memoryHit = await loadPack("it", null);
    expect(memoryHit.ok).toBe(true);
    if (memoryHit.ok) expect(memoryHit.pack.packVersion).toBe("2.0.0");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("refuses to serve stale offline bytes that no longer match their recorded sha256 (stale-integrity check)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // GIVEN a version-stale cache whose DATA was tampered after the meta recorded a hash —
    // valid shape, wrong bytes. Before the stale-integrity check this was served silently.
    const tamperedJson = JSON.stringify({ ...fakePack(), name: "Tampered Italian" });
    localStorageMock.setItem("pack-data-v1-it", tamperedJson);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.9", sha256: CORRECT_SHA, cachedAt: 1 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await loadPack("it", fakeManifest());

    expect(result).toEqual({ ok: false, error: "download_failed" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("STALE_HASH_MISMATCH"));
    errorSpy.mockRestore();
  });

  it("a cache-hit parse failure followed by a failed download reports download_failed, not parse_error (truthful-error null-out)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // GIVEN cached bytes that hash-match their manifest entry but are not valid JSON
    const invalidJson = "not-json{{{";
    const invalidSha = createHash("sha256").update(invalidJson).digest("hex");
    localStorageMock.setItem("pack-data-v1-it", invalidJson);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: invalidSha, cachedAt: 1 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await loadPack("it", fakeManifest(invalidSha));

    // Deleting the post-parse-failure `cachedData = null` re-feeds the known-bad bytes to
    // the offline fallback, which reports parse_error — masking the real network cause.
    expect(result).toEqual({ ok: false, error: "download_failed" });
    errorSpy.mockRestore();
  });
});

describe("#378 WorldClass remediation — manifest dedup and module boundaries", () => {
  it("concurrent fetchManifest calls share one network request (V2 — multi-mount dedup)", async () => {
    let resolveFetch!: (v: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchSpy = vi.fn().mockImplementation(
      () => new Promise<{ ok: boolean; json: () => Promise<unknown> }>((res) => { resolveFetch = res; })
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Multiple useLangPack instances mount concurrently in production (global
    // InterruptHandler + page components) — each calls fetchManifest on mount.
    const p1 = fetchManifest();
    const p2 = fetchManifest();
    resolveFetch({ ok: true, json: async () => fakeManifest() });
    const [m1, m2] = await Promise.all([p1, p2]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(m2).toBe(m1); // shared promise → identical resolved object

    // Slot released after settle: a later call fetches fresh.
    fetchSpy.mockResolvedValue({ ok: true, json: async () => fakeManifest() });
    await fetchManifest();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("lib/basePackLoader.ts is imported ONLY by lib/packLoader.ts (comment contract, mechanically enforced)", () => {
    // The basePackLoader header declares packLoader the sole legal importer — a direct
    // import anywhere else bypasses loadPack's allowlist/entitlement/dedup gates. This
    // test is the poka-yoke for that contract (an eslint no-restricted-imports rule is
    // tracked as debt; the config file is outside this stream's ownership).
    const root = join(__dirname, "..");
    const importers: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(join(root, dir))) {
        const rel = join(dir, entry);
        const abs = join(root, rel);
        if (statSync(abs).isDirectory()) { scan(rel); continue; }
        if (!/\.(ts|tsx)$/.test(entry) || /\.test\./.test(entry)) continue;
        if (readFileSync(abs, "utf8").includes("@/lib/basePackLoader")) importers.push(rel);
      }
    };
    for (const dir of ["app", "components", "hooks", "lib", "store"]) scan(dir);

    // packResolver imports the LoadPackOptions TYPE only (erased at compile time — it
    // cannot bypass any runtime gate), so it is an allowed importer alongside packLoader.
    expect(importers.sort()).toEqual(["lib/packLoader.ts", "lib/packResolver.ts"]);
  });
});

describe("#378 WorldClass c3 — post-eviction serve helpers' failure branches", () => {
  it("a shape-invalid pack served on the post-eviction cache-hit path is refused with parse_error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // GIVEN cached bytes that hash-match the manifest but fail shape validation (units is
    // not an array), and a controllable digest so eviction can land mid-verification.
    const badShapeJson = JSON.stringify({ ...fakePack(), units: "not-an-array" });
    const badShapeSha = createHash("sha256").update(badShapeJson).digest("hex");
    localStorageMock.setItem("pack-data-v1-it", badShapeJson);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "1.0.0", sha256: badShapeSha, cachedAt: 1 }));
    let resolveDigest!: (v: ArrayBuffer) => void;
    const digestSpy = vi.fn().mockImplementation(() => new Promise<ArrayBuffer>((res) => { resolveDigest = res; }));
    vi.stubGlobal("crypto", { subtle: { digest: digestSpy } });
    vi.stubGlobal("fetch", vi.fn());

    const pending = loadPack("it", fakeManifest(badShapeSha));
    await vi.waitFor(() => expect(digestSpy).toHaveBeenCalled());
    await evictPack("it");
    resolveDigest(createHash("sha256").update(badShapeJson).digest().buffer as ArrayBuffer);
    const result = await pending;

    // validateWithoutCaching's shape-check branch: deleting the hasValidUnitsArray guard
    // there serves the malformed pack as ok:true and this fails.
    expect(result).toEqual({ ok: false, error: "parse_error" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SHAPE_INVALID_FAIL-stale"));
    errorSpy.mockRestore();
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async (_a: string, data: ArrayBuffer): Promise<ArrayBuffer> =>
          createHash("sha256").update(Buffer.from(data)).digest().buffer as ArrayBuffer,
      },
    });
  });

  it("unparseable stale bytes on the post-eviction offline-fallback path are refused with parse_error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // GIVEN version-stale cached bytes whose recorded hash matches (so the stale-integrity
    // check passes) but which are not valid JSON, and a download we control so eviction can
    // land mid-flight, forcing the post-eviction parseValidateWithoutCaching path.
    const invalidJson = "not-json{{{";
    const invalidSha = createHash("sha256").update(invalidJson).digest("hex");
    localStorageMock.setItem("pack-data-v1-it", invalidJson);
    localStorageMock.setItem("pack-meta-v1-it", JSON.stringify({ version: "0.9.9", sha256: invalidSha, cachedAt: 1 }));
    let resolveFetch!: (v: { ok: boolean; status: number }) => void;
    const fetchSpy = vi.fn().mockImplementation(() => new Promise<{ ok: boolean; status: number }>((res) => { resolveFetch = res; }));
    vi.stubGlobal("fetch", fetchSpy);

    const pending = loadPack("it", fakeManifest());
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await evictPack("it");
    resolveFetch({ ok: false, status: 503 });
    const result = await pending;

    // parseValidateWithoutCaching's catch branch: deleting its try/catch turns this into a
    // rejection; the typed result below fails either way without the branch.
    expect(result).toEqual({ ok: false, error: "parse_error" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("STALE_PARSE_FAIL"), expect.any(Error));
    errorSpy.mockRestore();
  });
});
