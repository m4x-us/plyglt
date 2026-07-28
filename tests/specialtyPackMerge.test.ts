// === tests/specialtyPackMerge.test.ts ===
// Task #461: dedicated unit tests for lib/specialtyPackMerge.ts's own logic — parse, shape
// validation, both deactivation-guard isStale re-checks, merge arithmetic, and the
// meta-before-data write ordering. tests/specialtyPackLoader.test.ts already covers this
// module end-to-end through the real loadSpecialtyPack → packLoader stack with real storage
// and real crypto; this file instead calls mergeSpecialtyPackFromJson directly with a
// hand-built in-memory memCache and mocked lib/packCache writes, so these invariants are
// proven by tests scoped to the unit doing the risky work, not only incidentally by whatever
// the caller's integration tests happen to construct.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeSpecialtyPackFromJson } from "@/lib/specialtyPackMerge";
import { createGenerationGuard } from "@/lib/generationGuard";
import type { Pack, PackMemCache, PackMeta } from "@/lib/packTypes";

const { mockWriteCacheMeta, mockWriteCacheData, mockMarkAddOnLoaded } = vi.hoisted(() => ({
  mockWriteCacheMeta: vi.fn().mockResolvedValue(undefined),
  mockWriteCacheData: vi.fn().mockResolvedValue(undefined),
  mockMarkAddOnLoaded: vi.fn(),
}));

vi.mock("@/lib/packCache", () => ({
  writeCacheMeta: mockWriteCacheMeta,
  writeCacheData: mockWriteCacheData,
  markAddOnLoaded: mockMarkAddOnLoaded,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUnit(id: string, cardCount: number) {
  return {
    id, name: id, level: "A1" as const, theme: "medical", emoji: "🩺",
    prerequisiteUnits: [],
    cards: Array.from({ length: cardCount }, (_, c) => ({
      id: `${id}-c${c}`, type: "produce" as const, prompt: "prompt",
      accepted: ["risposta"], tags: [], tier: 1 as const,
    })),
  };
}

function fakeBasePack(): Pack {
  return {
    _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
    name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
    unitCount: 1, cardCount: 2,
    units: [makeUnit("base-u0", 2)],
  };
}

function fakeAddOnPack(): Pack {
  return {
    _version: 1, lang: "it-medical", packVersion: "1.0.0", canonicalSource: "en",
    name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹",
    unitCount: 1, cardCount: 3,
    units: [makeUnit("addon-u0", 3)],
  };
}

const ADD_ON_JSON = JSON.stringify(fakeAddOnPack());

function fakeManifestEntry(): PackMeta {
  return { version: "1.0.0", size: 100, sha256: "fake-sha", name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹" };
}

/** Minimal in-memory PackMemCache — only `get`/`merge` are exercised by the module under test. */
function makeMemCache(seed: Record<string, Pack> = {}): PackMemCache & { mergeCalls: Array<[string, Pack]> } {
  const store = new Map<string, Pack>(Object.entries(seed));
  const mergeCalls: Array<[string, Pack]> = [];
  return {
    has: (lang) => store.has(lang),
    get: (lang) => store.get(lang),
    keys: () => store.keys(),
    write: (lang, pack) => { store.set(lang, pack); },
    merge: (lang, pack) => { mergeCalls.push([lang, pack]); store.set(lang, pack); },
    delete: (lang) => { store.delete(lang); },
    clear: () => { store.clear(); },
    mergeCalls,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteCacheMeta.mockResolvedValue(undefined);
  mockWriteCacheData.mockResolvedValue(undefined);
});

// ── Merge arithmetic + fresh-download persistence ────────────────────────────

describe("mergeSpecialtyPackFromJson — successful merge (fresh download, manifestEntry present)", () => {
  it("merges add-on units into the base pack additively and sums unitCount/cardCount", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack.units.map(u => u.id)).toEqual(["base-u0", "addon-u0"]);
    expect(result.pack.unitCount).toBe(2); // 1 base + 1 add-on
    expect(result.pack.cardCount).toBe(5); // 2 base + 3 add-on
  });

  it("writes cache meta strictly before cache data (crash-safety ordering, #309)", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();

    await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(mockWriteCacheMeta).toHaveBeenCalledTimes(1);
    expect(mockWriteCacheData).toHaveBeenCalledTimes(1);
    expect(mockWriteCacheMeta.mock.invocationCallOrder[0]!).toBeLessThan(
      mockWriteCacheData.mock.invocationCallOrder[0]!
    );
    expect(mockWriteCacheMeta).toHaveBeenCalledWith("it-medical", expect.objectContaining({
      version: "1.0.0", sha256: "fake-sha",
    }));
    expect(mockWriteCacheData).toHaveBeenCalledWith("it-medical", ADD_ON_JSON);
  });

  it("marks the add-on as loaded and merges into memCache exactly once", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();

    await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(mockMarkAddOnLoaded).toHaveBeenCalledExactlyOnceWith("it-medical");
    expect(memCache.mergeCalls).toHaveLength(1);
    expect(memCache.mergeCalls[0]![0]).toBe("it");
  });
});

describe("mergeSpecialtyPackFromJson — manifestEntry: null (already-persisted or stale-cache-serve path)", () => {
  it("merges without writing to cache storage at all", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, null, guard.snapshot(), guard
    );

    expect(result.ok).toBe(true);
    expect(mockWriteCacheMeta).not.toHaveBeenCalled();
    expect(mockWriteCacheData).not.toHaveBeenCalled();
    expect(mockMarkAddOnLoaded).toHaveBeenCalledExactlyOnceWith("it-medical");
  });
});

// ── Parse / shape validation ──────────────────────────────────────────────────

describe("mergeSpecialtyPackFromJson — malformed input", () => {
  it("returns parse_error for invalid JSON and never touches memCache or storage", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, "{not valid json", fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(result).toEqual({ ok: false, error: "parse_error" });
    expect(memCache.mergeCalls).toHaveLength(0);
    expect(mockWriteCacheMeta).not.toHaveBeenCalled();
    expect(mockMarkAddOnLoaded).not.toHaveBeenCalled();
  });

  it("returns parse_error for a shape-invalid add-on pack (unitCount doesn't match units.length)", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();
    const badPack = { ...fakeAddOnPack(), unitCount: 99 };

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, JSON.stringify(badPack), fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(result).toEqual({ ok: false, error: "parse_error" });
    expect(memCache.mergeCalls).toHaveLength(0);
  });
});

// ── base_pack_not_loaded ───────────────────────────────────────────────────────

describe("mergeSpecialtyPackFromJson — base pack precondition (#310)", () => {
  it("returns base_pack_not_loaded when the base language is absent from memCache", async () => {
    const memCache = makeMemCache(); // empty — no "it" entry
    const guard = createGenerationGuard();

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(result).toEqual({ ok: false, error: "base_pack_not_loaded" });
    expect(memCache.mergeCalls).toHaveLength(0);
  });
});

// ── deactivation-guard isStale — both re-check points (#394, #409) ───────────

describe("mergeSpecialtyPackFromJson — deactivation guard, FIRST re-check (before storage writes)", () => {
  it("aborts with invalid_lang when the guard is already stale at entry, writing nothing", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();
    const entryGeneration = guard.snapshot();
    guard.bump(); // deactivation completed before the merge call even started

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), entryGeneration, guard
    );

    expect(result).toEqual({ ok: false, error: "invalid_lang" });
    expect(mockWriteCacheMeta).not.toHaveBeenCalled();
    expect(mockWriteCacheData).not.toHaveBeenCalled();
    expect(memCache.mergeCalls).toHaveLength(0);
    expect(mockMarkAddOnLoaded).not.toHaveBeenCalled();
  });
});

describe("mergeSpecialtyPackFromJson — deactivation guard, SECOND re-check (bracketing storage writes)", () => {
  it("aborts with invalid_lang when deactivation lands during the storage write — merge and markAddOnLoaded never run", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();
    const entryGeneration = guard.snapshot();

    // Simulate a deactivation landing DURING the awaited storage write — the exact window
    // the second isStale check exists to catch (Task #409's doc comment on the module).
    mockWriteCacheData.mockImplementationOnce(async () => { guard.bump(); });

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), entryGeneration, guard
    );

    expect(result).toEqual({ ok: false, error: "invalid_lang" });
    // The writes themselves already happened (this is the documented trade-off: storage
    // ends up clean either way because evictPack's removal is ordered after these writes
    // in packCache's per-code chain) — what must NOT have happened is granting access.
    expect(mockWriteCacheMeta).toHaveBeenCalledTimes(1);
    expect(mockWriteCacheData).toHaveBeenCalledTimes(1);
    expect(memCache.mergeCalls).toHaveLength(0);
    expect(mockMarkAddOnLoaded).not.toHaveBeenCalled();
  });

  it("does NOT abort when the guard is still fresh at the second check — merge proceeds normally", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();
    const entryGeneration = guard.snapshot();

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), entryGeneration, guard
    );

    expect(result.ok).toBe(true);
    expect(memCache.mergeCalls).toHaveLength(1);
    expect(mockMarkAddOnLoaded).toHaveBeenCalledExactlyOnceWith("it-medical");
  });
});

// ── Storage write failure resilience ──────────────────────────────────────────

describe("mergeSpecialtyPackFromJson — storage write failure", () => {
  it("still merges and returns ok:true when writeCacheData rejects — session-only degradation, not a hard failure", async () => {
    const memCache = makeMemCache({ it: fakeBasePack() });
    const guard = createGenerationGuard();
    mockWriteCacheData.mockRejectedValueOnce(new Error("disk full"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await mergeSpecialtyPackFromJson(
      "it-medical", "it", memCache, ADD_ON_JSON, fakeManifestEntry(), guard.snapshot(), guard
    );

    expect(result.ok).toBe(true);
    expect(memCache.mergeCalls).toHaveLength(1);
    expect(mockMarkAddOnLoaded).toHaveBeenCalledExactlyOnceWith("it-medical");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("ADDON_CACHE_WRITE_FAIL"),
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
