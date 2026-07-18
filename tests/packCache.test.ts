// === tests/packCache.test.ts ===
// Tests for lib/packCache.ts — per-code storage mutation serialization (#396) and
// lang-bearing error ref IDs (#387).
// Depends on: lib/packCache; mocks @/lib/storage (controllable async delays) and
// @/lib/langRegistry (registered it-medical specialty pack).

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SpecialtyPack } from "@/lib/langRegistry";
import type { Pack } from "@/lib/packTypes";
import {
  memCache,
  markAddOnLoaded,
  isAddOnLoaded,
  readCacheMeta,
  writeCacheMeta,
  readCacheData,
  writeCacheData,
  parseValidateAndCache,
  clearPackCacheState,
  type CachedPackMeta,
} from "@/lib/packCache";

// ── Controllable async storage mock ──────────────────────────────────────────
// removeItemDelayMs simulates a slow platform-storage delete (Tauri file I/O) so the
// #396 race is reproducible deterministically: with the fix deleted, slow removals
// initiated BEFORE fresh writes would complete AFTER them and destroy the new keys.

const store = new Map<string, string>();
let removeItemDelayMs = 0;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const mockStorage = {
  getItem: vi.fn(async (key: string): Promise<string | null> => store.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  }),
  removeItem: vi.fn(async (key: string): Promise<void> => {
    if (removeItemDelayMs > 0) await sleep(removeItemDelayMs);
    store.delete(key);
  }),
};

vi.mock("@/lib/storage", () => ({
  createPlatformStorage: () => mockStorage,
}));

const mockSpecialtyPacks = vi.hoisted<SpecialtyPack[]>(() => [
  { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
]);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return { ...actual, SPECIALTY_PACKS: mockSpecialtyPacks };
});

const fakePack = (overrides: Partial<Pack> = {}): Pack => ({
  _version: 1,
  lang: "it",
  packVersion: "1.0.0",
  canonicalSource: "en",
  name: "Italian",
  nativeName: "Italiano",
  flag: "🇮🇹",
  unitCount: 0,
  cardCount: 0,
  units: [],
  ...overrides,
});

const META_KEY = "pack-meta-v1-it-medical";
const DATA_KEY = "pack-data-v1-it-medical";

beforeEach(() => {
  clearPackCacheState();
  store.clear();
  removeItemDelayMs = 0;
  vi.clearAllMocks();
});

// ── #396 — write()'s fire-and-forget cleanup vs a concurrent re-merge's writes ──

describe("storage mutation serialization (Task #396)", () => {
  it("a slow cleanup fired by write() cannot delete a re-merge's just-written keys", async () => {
    // Session state: it-medical was merged and persisted earlier.
    memCache.write("it", fakePack());
    markAddOnLoaded("it-medical");
    await writeCacheMeta("it-medical", { version: "1.0.0", sha256: "aaa", cachedAt: 1 });
    await writeCacheData("it-medical", '{"old":true}');

    // Base pack replaced → prunes it-medical and fires its storage cleanup, which is SLOW.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    removeItemDelayMs = 20;
    memCache.write("it", fakePack({ packVersion: "2.0.0" }));
    expect(isAddOnLoaded("it-medical")).toBe(false);

    // Concurrent re-merge persists fresh keys for the same code immediately afterwards.
    removeItemDelayMs = 0;
    const freshMeta: CachedPackMeta = { version: "2.0.0", sha256: "bbb", cachedAt: 2 };
    await Promise.all([
      writeCacheMeta("it-medical", freshMeta),
      writeCacheData("it-medical", '{"fresh":true}'),
    ]);

    // Give the (slow, fire-and-forget) cleanup time to land wherever the chain puts it.
    await sleep(60);

    // Without per-code serialization the trailing cleanup deletes the fresh keys and both
    // reads return undefined. With it, the cleanup ran BEFORE the writes; fresh keys survive.
    expect(store.get(DATA_KEY)).toBe('{"fresh":true}');
    expect(JSON.parse(store.get(META_KEY) ?? "null")).toEqual(freshMeta);
    errorSpy.mockRestore();
  });

  it("cleanup initiated AFTER the last write still deletes the keys (ordering, not suppression)", async () => {
    memCache.write("it", fakePack());
    markAddOnLoaded("it-medical");
    await writeCacheMeta("it-medical", { version: "1.0.0", sha256: "aaa", cachedAt: 1 });
    await writeCacheData("it-medical", '{"old":true}');

    // No concurrent writes after this prune — the cleanup must win here.
    memCache.write("it", fakePack({ packVersion: "2.0.0" }));
    await sleep(20);

    expect(store.get(META_KEY) ?? null).toBe(null);
    expect(store.get(DATA_KEY) ?? null).toBe(null);
  });

  it("a rejected removal does not poison the chain for subsequent writes on the same code", async () => {
    memCache.write("it", fakePack());
    markAddOnLoaded("it-medical");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage.removeItem
      .mockRejectedValueOnce(new Error("disk full"))
      .mockRejectedValueOnce(new Error("disk full"));
    memCache.write("it", fakePack({ packVersion: "2.0.0" })); // both removals reject
    await sleep(10);

    // The rejection was logged (#346 — nothing silently swallowed)…
    const logged = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(logged.some((m) => m.includes("ERR-CACHE-WRITE-SPECIALTY-META-it-medical"))).toBe(true);

    // …and the chain still executes later mutations for the same code.
    await writeCacheData("it-medical", '{"after-failure":true}');
    expect(store.get(DATA_KEY)).toBe('{"after-failure":true}');
    errorSpy.mockRestore();
  });
});

// ── #387 — error ref IDs carry lang ──────────────────────────────────────────

describe("cache-read error ref IDs include lang (Task #387)", () => {
  it("readCacheMeta logs [ERR-CACHE-META-<lang>-…] on storage failure", async () => {
    mockStorage.getItem.mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await readCacheMeta("es");
    expect(result).toBe(null);
    expect(String(errorSpy.mock.calls[0]?.[0])).toMatch(/^\[ERR-CACHE-META-es-\d+\]$/);
    errorSpy.mockRestore();
  });

  it("readCacheData logs [ERR-CACHE-DATA-<lang>-…] on storage failure", async () => {
    mockStorage.getItem.mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await readCacheData("es");
    expect(result).toBe(null);
    expect(String(errorSpy.mock.calls[0]?.[0])).toMatch(/^\[ERR-CACHE-DATA-es-\d+\]$/);
    errorSpy.mockRestore();
  });

  it("parseValidateAndCache logs [CACHE_PARSE_FAIL-<lang>-…] on corrupt cached JSON", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await parseValidateAndCache("es", "{not json");
    expect(result).toEqual({ ok: false, error: "parse_error" });
    const logged = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(logged.some((m) => /^\[CACHE_PARSE_FAIL-es-\d+\]$/.test(m))).toBe(true);
    errorSpy.mockRestore();
  });
});
