// === tests/specialtyPackLoader.test.ts ===
// Focused tests for lib/specialtyPackLoader.ts that are not in packLoader.test.ts scope.
// Coverage: write-order safety (#309), clearSpecialtyPacksForLang return value (#319).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SpecialtyPack } from "@/lib/langRegistry";
import { loadPack, seedMemCache, clearCacheForTesting, evictPack } from "@/lib/packLoader";
import type { Pack, Manifest } from "@/lib/packLoader";
import { markAddOnLoaded, memCache } from "@/lib/packCache";
import { resetSpecialtyLoadState, getLoadedAddOns } from "@/lib/specialtyPackLoader";

// ── localStorage stub (mirrors packLoader.test.ts) ───────────────────────────

const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem:    (key)        => store[key] ?? null,
  setItem:    (key, value) => { store[key] = value; },
  removeItem: (key)        => { delete store[key]; },
  clear:      ()           => { for (const k in store) delete store[k]; },
  key:        (i)          => Object.keys(store)[i] ?? null,
  get length()             { return Object.keys(store).length; },
};
vi.stubGlobal("window", { localStorage: localStorageMock });

// ── Web Crypto stub — real SHA256 via Node.js crypto ─────────────────────────

vi.stubGlobal("crypto", {
  subtle: {
    digest: async (_algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
      const hash = createHash("sha256").update(Buffer.from(data)).digest();
      return hash.buffer as ArrayBuffer;
    },
  },
});

// ── Specialty pack mock ───────────────────────────────────────────────────────

const mockSpecialtyPacks = vi.hoisted<SpecialtyPack[]>(() => []);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS:          mockSpecialtyPacks,
    // Task #380: key renamed with the alias deletion — packLoader now imports the canonical name.
    isSpecialtyPackCode: (s: string) => mockSpecialtyPacks.some(sp => sp.code === s && sp.ready),
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeBasePack = (): Pack => ({
  _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
  name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
  unitCount: 0, cardCount: 0, units: [],
});

// Task #418 (lib/packTypes.ts): hasValidUnitsArray now cross-checks unitCount/cardCount
// against the real units/cards array lengths — units: [] with unitCount: 5 no longer
// passes shape validation. 5 units of 10 cards each keeps unitCount:5/cardCount:50
// (relied on by several merge-arithmetic assertions below) genuinely accurate.
const fakeAddOnPack = (): Pack => ({
  _version: 1, lang: "it-medical", packVersion: "1.0.0", canonicalSource: "en",
  name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹",
  unitCount: 5, cardCount: 50,
  units: Array.from({ length: 5 }, (_, u) => ({
    id: `it-medical-u${u}`, name: `Medical Unit ${u}`, level: "A1", theme: "medical",
    emoji: "🩺", prerequisiteUnits: [],
    cards: Array.from({ length: 10 }, (_, c) => ({
      id: `it-medical-u${u}-c${c}`, type: "produce", prompt: "prompt",
      accepted: ["risposta"], tags: [], tier: 1,
    })),
  })),
});

const ADD_ON_PACK_JSON = JSON.stringify(fakeAddOnPack());
const ADD_ON_SHA = createHash("sha256").update(ADD_ON_PACK_JSON).digest("hex");

const fakeManifest = (): Manifest => ({
  _version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  packs: {
    "it-medical": { name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹",
                    version: "1.0.0", size: 50, sha256: ADD_ON_SHA },
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearCacheForTesting();
  localStorageMock.clear();
  mockSpecialtyPacks.length = 0;
  vi.restoreAllMocks();
});

// ── #309 — meta-first write ordering ─────────────────────────────────────────

describe("specialty pack — meta-first persistence ordering (#309)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    // Seed the base pack so the specialty-pack precondition is met (Italian is served
    // from static content in the real app, bypassing loadPack — seedMemCache replicates that).
    seedMemCache("it", []);
  });

  it("#309: writes meta key before data key when persisting a freshly-downloaded specialty pack", async () => {
    // Spy on localStorage.setItem to capture the order in which storage keys are written.
    // writeCacheMeta calls setItem("pack-meta-v1-it-medical", ...).
    // writeCacheData calls setItem("pack-data-v1-it-medical", ...).
    // The new meta-first ordering means the meta key must appear in the write log before the data key.
    const writeOrder: string[] = [];
    const origSetItem = localStorageMock.setItem.bind(localStorageMock);
    vi.spyOn(localStorageMock, "setItem").mockImplementation((key, value) => {
      if (key === "pack-meta-v1-it-medical") writeOrder.push("meta");
      if (key === "pack-data-v1-it-medical") writeOrder.push("data");
      origSetItem(key, value);
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => ADD_ON_PACK_JSON,
    }));

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(true);
    // Both must be written — and meta must precede data.
    // If meta came second (old order), writeOrder would be ["data", "meta"].
    expect(writeOrder).toEqual(["meta", "data"]);
  });

  it("#309: meta-without-data orphan (safe crash state in new write order) triggers re-download, not a silent failure", async () => {
    // After a crash between writeCacheMeta and writeCacheData (new meta-first order),
    // storage has meta but no data. On next load: readCacheData returns null →
    // cacheVersionMatches = false → triggers a fresh download.
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: Date.now(),
    }));
    // Intentionally no pack-data-v1-it-medical entry — simulates crash after meta write.

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => ADD_ON_PACK_JSON });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    // Re-download succeeds — orphaned meta alone does not block the pack.
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    // Data is now correctly persisted after the re-download.
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(ADD_ON_PACK_JSON);
  });
});

// ── #319 — clearPackCache evicts specialty storage keys ───────────────────────

describe("clearPackCache — specialty storage-key eviction (#319)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    seedMemCache("it", []);
  });

  it("#319: evicting the base pack also clears the specialty pack's persisted storage keys", async () => {
    // Seed specialty pack storage keys (as _mergeFromJson would write them after a successful load).
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: Date.now(),
    }));
    localStorageMock.setItem("pack-data-v1-it-medical", ADD_ON_PACK_JSON);

    // Load the specialty pack so loadedAddOns tracks "it-medical".
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => ADD_ON_PACK_JSON }));
    await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    // Evict the base pack — must also remove specialty storage keys.
    await evictPack("it");

    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).toBe(null);
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(null);
  });

  it("#319: evicting the base pack when specialty pack was never loaded leaves storage unchanged for that key", async () => {
    // Specialty pack was never loaded (not in loadedAddOns), but its storage keys exist
    // from a prior session. The specialty keys should NOT be cleared when baseLang is evicted
    // in this case — clearSpecialtyPacksForLang only prunes codes in loadedAddOns.
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: Date.now(),
    }));
    localStorageMock.setItem("pack-data-v1-it-medical", ADD_ON_PACK_JSON);

    // Do NOT load the specialty pack — loadedAddOns stays empty.

    await evictPack("it");

    // Keys survive because clearSpecialtyPacksForLang returns [] (nothing in loadedAddOns to prune).
    // The next session will re-verify these bytes against the manifest sha256 before serving them.
    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).not.toBe(null);
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).not.toBe(null);
  });
});

// ── #346 — write() clears superseded specialty storage keys ──────────────────

describe("PackMemCacheImpl.write() — specialty storage-key cleanup (#346)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    seedMemCache("it", []);
  });

  it("#346: replacing a base pack via write() clears the specialty pack's persisted storage keys", async () => {
    // Seed specialty storage keys as _mergeFromJson would write them after a successful load.
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({
      version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: Date.now(),
    }));
    localStorageMock.setItem("pack-data-v1-it-medical", ADD_ON_PACK_JSON);

    // Mark "it-medical" as loaded so clearSpecialtyPacksForLang will prune it on write().
    markAddOnLoaded("it-medical");

    // Replace the base pack — this is the write() path (also what cacheAndReturn calls).
    memCache.write("it", fakeBasePack());

    // write() fires storage cleanup asynchronously. Let pending microtasks drain.
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).toBe(null);
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(null);
  });

  it("#346: replacing a base pack when no specialty was loaded does not disturb other storage keys", async () => {
    // Seed a key that should be left alone (not a specialty pack key for this base lang).
    localStorageMock.setItem("pack-meta-v1-es", "spanish-meta");

    // No specialty pack loaded for "it" — loadedAddOns is empty.
    memCache.write("it", fakeBasePack());

    await new Promise<void>(resolve => setTimeout(resolve, 0));

    // Unrelated key survives.
    expect(localStorageMock.getItem("pack-meta-v1-es")).toBe("spanish-meta");
  });
});

// ── #394 — deactivation during an in-flight specialty load ───────────────────

describe("loadSpecialtyPack — deactivation generation guard (#394)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    seedMemCache("it", []);
  });

  it("#394: a load in flight when resetSpecialtyLoadState runs aborts instead of merging stale entitlement", async () => {
    // Sequence under test: the load passes its purchasedAddOns gate (one-time snapshot),
    // then a deactivation (clearEntitlement → eviction → resetSpecialtyLoadState → useLangPack
    // #362 re-seed) completes BEFORE the download resolves. Without the generation
    // re-check inside _mergeFromJson, the stale merge lands on the re-seeded base pack —
    // post-deactivation access to paid content.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let resolveFetch!: (v: { ok: boolean; text: () => Promise<string> }) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(res => { resolveFetch = res; })));

    const loadPromise = loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    // Deactivation completes mid-flight, then the base pack is re-seeded (what
    // useLangPack's _cacheEvictionGeneration effect does after eviction). Ordering
    // mirrors clearEntitlement: evictions settle first, then resetSpecialtyLoadState.
    await evictPack("it");
    resetSpecialtyLoadState();
    seedMemCache("it", []);

    resolveFetch({ ok: true, text: async () => ADD_ON_PACK_JSON });
    const result = await loadPromise;

    expect(result).toEqual({ ok: false, error: "invalid_lang" });
    expect(warnSpy.mock.calls.some(args => String(args[0]).includes("ADDON_STALE_ENTITLEMENT"))).toBe(true);
    // The re-seeded base pack was NOT mutated by the stale merge (add-on has unitCount 5).
    expect(memCache.get("it")!.unitCount).toBe(0);
    // Bookkeeping was not re-marked and the stale bytes were not re-persisted post-eviction.
    expect(getLoadedAddOns()).toEqual([]);
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(null);
    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).toBe(null);
    warnSpy.mockRestore();
  });

  it("#394: a load with no intervening deactivation still merges normally (generation guard is not overzealous)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => ADD_ON_PACK_JSON }));

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(true);
    expect(memCache.get("it")!.unitCount).toBe(5);
    expect(getLoadedAddOns()).toEqual(["it-medical"]);
  });

  it("#409: a deactivation landing during the post-download storage writes aborts the merge (second generation check)", async () => {
    // Sibling of the #394 test above, but the deactivation lands LATER — inside the awaited
    // writeCacheMeta/writeCacheData block, after the FIRST generation check (before
    // memCache.merge used to sit; now before the storage-persist block) already passed.
    // Before #409, memCache.merge ran unconditionally ahead of the storage writes, so this
    // exact timing window was unguarded — a stale merge would land in memCache even though
    // the entitlement snapshot went stale mid-write.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const origSetItem = localStorageMock.setItem.bind(localStorageMock);
    vi.spyOn(localStorageMock, "setItem").mockImplementation((key, value) => {
      if (key === "pack-meta-v1-it-medical") {
        // Deactivation completes exactly between the meta write and the data write.
        resetSpecialtyLoadState();
        seedMemCache("it", []);
      }
      origSetItem(key, value);
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => ADD_ON_PACK_JSON }));

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result).toEqual({ ok: false, error: "invalid_lang" });
    expect(warnSpy.mock.calls.some(args => String(args[0]).includes("ADDON_STALE_ENTITLEMENT"))).toBe(true);
    // Storage writes still completed — the per-code mutation chain makes them self-healing
    // regardless of the guard; deleting the second check would ALSO make memCache.merge run,
    // which this test's next assertions catch.
    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).not.toBe(null);
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).not.toBe(null);
    // But the re-seeded base pack was NOT mutated by the stale merge.
    expect(memCache.get("it")!.unitCount).toBe(0);
    expect(getLoadedAddOns()).toEqual([]);
    warnSpy.mockRestore();
  });
});

// ── #410 — offline/no-manifest fallback re-verifies against the recorded cache hash ──

describe("specialty pack — offline-serve integrity re-verification (#410)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    seedMemCache("it", []);
  });

  it("#410: refuses to serve stale offline add-on bytes that no longer match their recorded sha256 (manifest present, download fails)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // GIVEN a version-stale cache whose DATA was tampered after the meta recorded a hash —
    // valid shape, wrong bytes. Before #410 this was served silently through the
    // fetch-!res.ok offline fallback with zero verification.
    const tamperedJson = JSON.stringify({ ...fakeAddOnPack(), name: "Tampered Medical Italian" });
    localStorageMock.setItem("pack-data-v1-it-medical", tamperedJson);
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({ version: "0.9.9", sha256: ADD_ON_SHA, cachedAt: 1 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result).toEqual({ ok: false, error: "download_failed" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("STALE_HASH_MISMATCH-it-medical"));
    errorSpy.mockRestore();
  });

  it("#410: serves stale offline add-on bytes when they still match their recorded sha256 (not overly strict)", async () => {
    // Sibling of the refusal test above — version-stale but byte-intact cache must still
    // serve successfully through the same offline path.
    localStorageMock.setItem("pack-data-v1-it-medical", ADD_ON_PACK_JSON);
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({ version: "0.9.9", sha256: ADD_ON_SHA, cachedAt: 1 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result.ok).toBe(true);
    expect(getLoadedAddOns()).toEqual(["it-medical"]);
  });

  it("#410: refuses to serve stale offline add-on bytes via the no-manifest-at-all cache-hit and download-needed paths", async () => {
    // manifest=null → addOnManifestEntry is undefined for the whole call, exercising the
    // OTHER two offline call sites (the cache-hit "else" branch and the "!addOnManifestEntry"
    // fail-closed branch) rather than the fetch-failure branch above.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const tamperedJson = JSON.stringify({ ...fakeAddOnPack(), name: "Tampered Medical Italian" });
    localStorageMock.setItem("pack-data-v1-it-medical", tamperedJson);
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({ version: "1.0.0", sha256: ADD_ON_SHA, cachedAt: 1 }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it-medical", null, { purchasedAddOns: ["it-medical"] });

    expect(result).toEqual({ ok: false, error: "checksum_mismatch" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("STALE_HASH_MISMATCH-it-medical"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ADDON_NO_MANIFEST-it-medical"));
    // Fail-closed before any network attempt — a missing manifest with tampered cache must
    // never fall back to a fresh download of unverifiable content.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── #413 — _doLoad direct coverage (F010) ──────────────────────────────────────
// F010 flagged _doLoad:272 (the fresh-download sha256 mismatch branch) as untested —
// distinct from the #410 tests above, which exercise the offline/no-manifest fail-closed
// paths, never a genuine "manifest present, fetch succeeds, bytes don't match" download.

describe("specialty pack — fresh-download and cache-hit integrity branches (#413)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    seedMemCache("it", []);
  });

  it("#413: a freshly-downloaded add-on whose bytes don't match the manifest sha256 is rejected as checksum_mismatch", async () => {
    // No cache present — this is a genuine first-time download, unlike the #410 tests
    // above (which all start from a tampered or version-stale cache entry).
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "not the real add-on bytes" });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });

    expect(result).toEqual({ ok: false, error: "checksum_mismatch" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(getLoadedAddOns()).toEqual([]);
    // Tampered/corrupted bytes must never be written to storage.
    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).toBeNull();
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBeNull();
  });

  it("#413: a cached copy that passes sha256 verification but fails shape validation is evicted and falls through to a fresh download", () => {
    // Simulates a genuinely malformed pack published under a correct hash (a build/publish
    // bug, not tampering) — the cache-hit sha256 check at _doLoad's cacheVersionMatches
    // branch passes, but hasValidUnitsArray inside _mergeFromJson rejects the shape. This
    // is the "if (result.ok) return result" false branch (F010's other cited line, 257),
    // distinct from every #410 test above (which all fail the sha256 check itself, never
    // reach shape validation).
    const invalidShapeJson = JSON.stringify({ ...fakeAddOnPack(), units: "not-an-array" });
    const invalidShapeSha = createHash("sha256").update(invalidShapeJson).digest("hex");
    const manifest: Manifest = {
      _version: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      packs: {
        "it-medical": {
          name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹",
          version: "1.0.0", size: 50, sha256: invalidShapeSha,
        },
      },
    };
    localStorageMock.setItem("pack-data-v1-it-medical", invalidShapeJson);
    localStorageMock.setItem("pack-meta-v1-it-medical", JSON.stringify({ version: "1.0.0", sha256: invalidShapeSha, cachedAt: 1 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Redownload serves the same malformed bytes — mirrors a genuinely broken published pack.
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => invalidShapeJson });
    vi.stubGlobal("fetch", fetchSpy);

    return loadPack("it-medical", manifest, { purchasedAddOns: ["it-medical"] }).then((result) => {
      // Falling through to a fresh download proves the cache was evicted rather than served.
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: false, error: "parse_error" });
      expect(getLoadedAddOns()).toEqual([]);
      const logKeys = errorSpy.mock.calls.map(args => args[0] as string);
      expect(logKeys.some(msg => msg.includes("SHAPE_INVALID_FAIL-it-medical"))).toBe(true);
      errorSpy.mockRestore();
    });
  });
});

describe("specialty pack — fetch timeout (#445)", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", ready: true, name: "Medical Italian" });
    seedMemCache("it", []);
  });

  it("#445: a hung specialty-pack fetch is timed out — the inFlight entry is released and a subsequent call succeeds normally", async () => {
    // Before #445, no fetch call in lib/specialtyPackLoader.ts's _doLoad had a timeout — a
    // single hung TCP connection left loadSpecialtyPack's inFlight entry permanently
    // pending, so every concurrent AND future caller for "it-medical" piggybacked on the
    // dead promise forever.
    vi.useFakeTimers();
    try {
      const hangingFetch = vi.fn().mockImplementation(
        (_url: string, opts?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      );
      vi.stubGlobal("fetch", hangingFetch);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const pending = loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });
      await vi.advanceTimersByTimeAsync(20_000);
      const result = await pending;

      expect(result).toEqual({ ok: false, error: "download_failed" });
      expect(getLoadedAddOns()).toEqual([]);

      // The inFlight entry was released (not left hanging) — a fresh call goes to the
      // network again and succeeds.
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => ADD_ON_PACK_JSON }));
      const result2 = await loadPack("it-medical", fakeManifest(), { purchasedAddOns: ["it-medical"] });
      expect(result2.ok).toBe(true);
      expect(getLoadedAddOns()).toEqual(["it-medical"]);
      errorSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
