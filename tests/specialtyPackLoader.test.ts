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

const fakeAddOnPack = (): Pack => ({
  _version: 1, lang: "it-medical", packVersion: "1.0.0", canonicalSource: "en",
  name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹",
  unitCount: 5, cardCount: 50, units: [],
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
});
