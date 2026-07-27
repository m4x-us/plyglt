// ============================================================
// hooks/useLangPack.test.ts — Behavioral tests for the useLangPack hook body
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { LANG_PAIR_KEY } from "@/lib/constants";
import { useLangPack } from "@/hooks/useLangPack";
// #377: real store, deliberately NOT mocked — Rule 20a requires these tests to drive the
// actual production selector path (store defaults + setEntitlement), not injected mocks.
import { useEntitlementStore } from "@/store/entitlementStore";
import { FREE_PACK_CODES } from "@/lib/langRegistry";
import { HYDRATION_GRACE_MS } from "@/hooks/useLangPack";
// #378: same module instance the hook's STATIC_PACKS.it.units is built from — used to assert
// reference identity of the seeded units array (structural equality would accept a copy).
import { ALL_UNITS } from "@/content/index";

// Mock packLoader — controls the async dynamic-load path
vi.mock("@/lib/packLoader", () => ({
  fetchManifest: vi.fn(),
  loadPack: vi.fn(),
  seedMemCache: vi.fn(), // #296: hook seeds static-pack langs in its load effect
  // #378 cycle-2 F-C2-5: clearEntitlement (the real eviction-generation mutator) calls
  // these packLoader exports — they must exist on the mock so eviction tests can drive
  // the REAL store action instead of injecting _cacheEvictionGeneration via setState.
  evictPack: vi.fn().mockResolvedValue({ evicted: true }), // honest EvictPackResult (#398)
  getLoadedAddOns: vi.fn(() => []),
}));

// Mutable ready-list backing the langRegistry mock (vi.hoisted so the mock factory can
// reference it). Default: real ready codes plus test-only "es"/"pt". Reset in afterEach.
const mockReadyPackCodes = vi.hoisted(() => ["it", "es", "pt"]);

// #378 cycle-2 K2-003: partial-mock the storage module so tests can hold the hydration
// gate closed. Everything else (createPlatformStorage — used by the real stores) stays real.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, useIsHydrated: vi.fn(() => true) };
});

import { fetchManifest, loadPack, seedMemCache } from "@/lib/packLoader";
import { useIsHydrated } from "@/lib/storage";
const mockFetchManifest = vi.mocked(fetchManifest);
const mockLoadPack = vi.mocked(loadPack);
const mockSeedMemCache = vi.mocked(seedMemCache);
const mockUseIsHydrated = vi.mocked(useIsHydrated);

// Mock langRegistry — override isSpecialtyPackCode so #324 behaviour can be tested
// without registering real specialty packs (SPECIALTY_PACKS holds one entry in the base
// registry — it-medical, ready:false — the ready gate, not emptiness, keeps it dormant).
// isValidPackCode is also extended to accept "pt" — pt was removed from LANGUAGE_REGISTRY
// (2026-06-27) but the existing language-switch test uses it as a second non-static language;
// without this, the #323 repair fires on "pt" and redirects to the Italian static path,
// preventing the test from observing the intended dynamic-load behaviour.
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    // WorldClass V1: the hook's isKnownCode gates on READY_PACK_CODES (ready base packs
    // only). "es" (registered, unready) and "pt" (unregistered) are marked ready here so
    // tests can exercise the dynamic-load path; the unready-BASE repair test below mutates
    // this array to restore "es" to its real unready state.
    READY_PACK_CODES: mockReadyPackCodes,
    // isReadyBasePackCode closes over the module-scope READY_PACK_CODES binding, not the
    // exported one — override it to read the mutable mock list (same technique the
    // packLoader test file documents for isSpecialtyPackCode).
    isReadyBasePackCode: (s: string) => mockReadyPackCodes.includes(s),
    // Registry-driven default matching the mocked SPECIALTY_PACKS ready entries below —
    // the hook routes BOTH isKnownCode and the #324 message branch through this canonical
    // predicate, so its default must reflect the mocked registry, not a blanket false.
    // Individual tests still override per-scenario (vi.fn allows mockReturnValue).
    isSpecialtyPackCode: vi.fn((s: string) => ["it-legal", "es-business"].includes(s)),
    // #378: test-only specialty entries exercising both branches of the base-pack resolution
    // logic — "it-legal" (static base, seeded) and "es-business" (network base, loaded via
    // loadPack). Real registry entries (it-medical, ready:false) stay available via the spread.
    SPECIALTY_PACKS: [
      ...actual.SPECIALTY_PACKS,
      { code: "it-legal", baseLang: "it", name: "Legal Italian", ready: true },
      { code: "es-business", baseLang: "es", name: "Business Spanish", ready: true },
    ],
  };
});

import { isSpecialtyPackCode } from "@/lib/langRegistry";
const mockIsSpecialtyPackCode = vi.mocked(isSpecialtyPackCode);

// #377: the real entitlement store is a shared module singleton across every describe block
// in this file. Any test that mutates it (setState or setEntitlement) would otherwise leak
// state into later blocks — reset ALL mutated fields to the store's documented defaults
// after every test, file-wide, so describe-order changes can never cause phantom failures.
afterEach(() => {
  // RTL auto-cleanup is INERT in this repo (vitest globals are disabled and tests/setup.ts
  // registers no cleanup), so every renderHook tree stays mounted and store-subscribed after
  // its test ends. Unmount them BEFORE resetting the store — otherwise the setState below
  // re-renders every zombie component and their effects re-fire loadPack, corrupting the
  // next test's mock call counts (observed: 16 phantom calls in one test).
  cleanup();
  // getInitialState() derives the reset from the store's own initializer — no hand-copied
  // field list to drift when the store gains fields (parallel-list ban, AGENTS.md).
  useEntitlementStore.setState(useEntitlementStore.getInitialState());
  // vi.clearAllMocks clears call history but NOT mockReturnValue overrides — restore the
  // hydration gate's default so a test holding it closed can't leak into later tests.
  mockUseIsHydrated.mockImplementation(() => true);
  // Restore the mutable ready-list a test may have narrowed (unready-base repair test)
  // and the specialty predicate a test may have overridden with mockReturnValue.
  mockReadyPackCodes.length = 0;
  mockReadyPackCodes.push("it", "es", "pt");
  mockIsSpecialtyPackCode.mockImplementation((s: string) => ["it-legal", "es-business"].includes(s));
});

// Minimal unit shape: hook only reads unit.id when building unitMap
const MOCK_UNIT = { id: "es-u01", name: "Greetings", emoji: "👋", cards: [], prerequisiteUnits: [] };
// Minimal pack shape: hook only reads pack.units
const MOCK_PACK_RESULT = { ok: true as const, pack: { units: [MOCK_UNIT] } as never };

describe("useLangPack — hook body behavioral tests", () => {
  beforeEach(() => {
    // "es" is not in STATIC_PACKS → exercises the useEffect dynamic-load path
    localStorage.setItem(LANG_PAIR_KEY, "en-es");
    mockFetchManifest.mockResolvedValue(null);
    mockLoadPack.mockResolvedValue(MOCK_PACK_RESULT);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("transitions from loading to loaded state when loadPack resolves successfully", async () => {
    const { result } = renderHook(() => useLangPack());

    // Initial state is loading because "es" is not a static pack
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.units).toHaveLength(1);
    // #261: hook threads purchasedAddOns from the entitlement store into loadPack options.
    // #377: unlockedLangs (from the store's unlockedPacks, default FREE_PACK_CODES) joined it.
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, { purchasedAddOns: [], unlockedLangs: [...FREE_PACK_CODES] });
  });

  it("transitions to error state when loadPack returns ok: false", async () => {
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "download_failed" as const });

    const { result } = renderHook(() => useLangPack());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Couldn't load pack. Try again.");
    expect(result.current.units).toHaveLength(0);
  });

  it("calls loadPack again when the target language changes between renders", async () => {
    const { rerender } = renderHook(() => useLangPack());

    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, { purchasedAddOns: [], unlockedLangs: [...FREE_PACK_CODES] });

    // Switch to a different non-static language; rerender causes hook to re-read localStorage
    localStorage.setItem(LANG_PAIR_KEY, "en-pt");
    rerender();

    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(2));
    expect(mockLoadPack).toHaveBeenLastCalledWith("pt", null, { purchasedAddOns: [], unlockedLangs: [...FREE_PACK_CODES] });
  });

  it("loaded units match mock data — not undefined", async () => {
    const { result } = renderHook(() => useLangPack());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.units).toHaveLength(1);
    expect(result.current.units[0]!.id).toBe("es-u01");
  });

  it("Italian static pack returns immediately with loading: false — no network call", () => {
    // "it" is bundled in STATIC_PACKS — exercises the static branch in useState initializer
    // and the early-return guard in useEffect (line 63 of hook)
    localStorage.setItem(LANG_PAIR_KEY, "en-it");

    const { result } = renderHook(() => useLangPack());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    // #378 audit F023: reference identity to the bundled content — a truncated, wrong, or
    // copied array fails this; a length check passed for any non-empty array.
    expect(result.current.units).toBe(ALL_UNITS);
    expect(mockLoadPack).not.toHaveBeenCalled();
    expect(mockFetchManifest).not.toHaveBeenCalled();
  });

  it("sets error state when fetchManifest rejects (network failure in .catch handler)", async () => {
    mockFetchManifest.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useLangPack());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Couldn't load pack. Try again.");
    expect(result.current.units).toHaveLength(0);
  });

  it("continues the load chain after unmount without crashing (cache-warming pin; the cancelled guard itself is proven by the stale-language test below)", async () => {
    // Hold loadPack open so we can unmount before it settles
    let resolveLoad!: (v: typeof MOCK_PACK_RESULT) => void;
    mockFetchManifest.mockResolvedValue(null);
    mockLoadPack.mockImplementation(
      () => new Promise<typeof MOCK_PACK_RESULT>((res) => { resolveLoad = res; })
    );

    const { result, unmount } = renderHook(() => useLangPack());
    // fetchManifest resolved; loadPack is now pending
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);

    // Unmount, then let the chain settle. React 18 makes post-unmount setState an
    // unobservable no-op, so this test can only pin that the chain completes without
    // throwing and no extra load is issued — NOT the cancelled guard (see the
    // stale-language-switch test for the guard's falsifiable proof).
    unmount();
    resolveLoad(MOCK_PACK_RESULT);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockLoadPack).toHaveBeenCalledTimes(1);
  });

  it("discards a stale load result when the target language changes mid-flight (cancelled guard)", async () => {
    // GIVEN "es" load held open
    localStorage.setItem(LANG_PAIR_KEY, "en-es");
    let resolveEs!: (v: unknown) => void;
    const PT_RESULT = { ok: true as const, pack: { units: [{ id: "pt-u01" }] } as never };
    const ES_RESULT = { ok: true as const, pack: { units: [{ id: "es-u01" }] } as never };
    mockFetchManifest.mockResolvedValue(null);
    mockLoadPack.mockImplementation((lang: string) =>
      lang === "es"
        ? (new Promise((res) => { resolveEs = res; }) as never)
        : (Promise.resolve(PT_RESULT) as never)
    );

    const { result, rerender } = renderHook(() => useLangPack());
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));

    // WHEN the language changes to "pt" (cleanup sets cancelled=true on the es effect)
    // and pt's load completes first
    localStorage.setItem(LANG_PAIR_KEY, "en-pt");
    rerender();
    await waitFor(() => expect(result.current.units).toHaveLength(1));
    expect(result.current.units[0]!.id).toBe("pt-u01");

    // AND the stale es load resolves afterwards
    act(() => { resolveEs(ES_RESULT); });
    await new Promise((r) => setTimeout(r, 0));

    // THEN the cancelled guard discards it — deleting `if (cancelled) return` lets the
    // stale es pack overwrite pt's state and this exact-id assertion fails.
    expect(result.current.units[0]!.id).toBe("pt-u01");
  });
});

describe("#296 — seedMemCache called for Italian static pack", () => {
  beforeEach(() => {
    mockSeedMemCache.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls seedMemCache with 'it' and the static units when serving the Italian pack", () => {
    localStorage.setItem(LANG_PAIR_KEY, "en-it");

    const { result } = renderHook(() => useLangPack());

    // Static pack path: loading is synchronously false
    expect(result.current.loading).toBe(false);
    // seedMemCache must have been called exactly once — from the load effect (the seed
    // moved out of the useState initializer in #378 cycle 2: render bodies stay pure)
    expect(mockSeedMemCache).toHaveBeenCalledTimes(1);
    // #378 audit F024: exact args with reference identity on the units array — any other
    // non-empty array (the old expect.any(Array) + length>0 pair) no longer passes.
    expect(mockSeedMemCache.mock.calls[0]![0]).toBe("it");
    expect(mockSeedMemCache.mock.calls[0]![1]).toBe(ALL_UNITS);
  });

  it("does not call seedMemCache for non-static languages (dynamic load path)", async () => {
    localStorage.setItem(LANG_PAIR_KEY, "en-es");
    mockLoadPack.mockResolvedValue(MOCK_PACK_RESULT);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockSeedMemCache).not.toHaveBeenCalled();
  });
});

describe("#323 — corrupted targetLang is repaired before getLanguageConfig", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("falls back to Italian and logs once when targetLang is unrecognised", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // "xyz" is not a registered base or specialty pack code
    localStorage.setItem(LANG_PAIR_KEY, "en-xyz");

    const { result } = renderHook(() => useLangPack());

    // Italian static pack is served immediately (loading: false)
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    // Exactly one ERR-LANGPACK-CORRUPT log — not per-render spam
    const corruptLogs = errorSpy.mock.calls.filter(
      args => typeof args[0] === "string" && (args[0] as string).includes("ERR-LANGPACK-CORRUPT")
    );
    expect(corruptLogs).toHaveLength(1);
    expect(corruptLogs[0]![0]).toMatch(/"xyz"/);
  });

  it("repairs localStorage to 'en-it' so subsequent renders use the repaired value", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(LANG_PAIR_KEY, "en-bad");

    renderHook(() => useLangPack());

    expect(localStorage.getItem(LANG_PAIR_KEY)).toBe("en-it");
  });

  it("does not log ERR-LANGPACK-CORRUPT when targetLang is a valid registered code", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(LANG_PAIR_KEY, "en-it");

    renderHook(() => useLangPack());

    const corruptLogs = errorSpy.mock.calls.filter(
      args => typeof args[0] === "string" && (args[0] as string).includes("ERR-LANGPACK-CORRUPT")
    );
    expect(corruptLogs).toHaveLength(0);
  });
});

describe("#324 — invalid_lang distinguishes unpurchased specialty packs from unknown codes", () => {
  beforeEach(() => {
    // "es" exercises the dynamic-load path
    localStorage.setItem(LANG_PAIR_KEY, "en-es");
    mockFetchManifest.mockResolvedValue(null);
    mockIsSpecialtyPackCode.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows 'Pack not available.' for invalid_lang on a non-specialty code", async () => {
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "invalid_lang" as const });
    mockIsSpecialtyPackCode.mockReturnValue(false);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Pack not available.");
  });

  it("shows 'Add-on not purchased.' for invalid_lang when targetLang is a ready specialty pack code", async () => {
    // Simulate a user who has "es" as their lang (non-static path) and the code is a ready specialty
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "invalid_lang" as const });
    // isSpecialtyPackCode returns true → user has a purchasable add-on, not an unknown code
    mockIsSpecialtyPackCode.mockReturnValue(true);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Add-on not purchased.");
  });

  it("non-invalid_lang errors are not affected by the specialty check", async () => {
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "download_failed" as const });
    mockIsSpecialtyPackCode.mockReturnValue(true); // should not affect download_failed

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Couldn't load pack. Try again.");
  });
});

describe("#377 — unlockedPacks threaded from entitlement store into loadPack as unlockedLangs", () => {
  beforeEach(() => {
    // "es" is not in STATIC_PACKS — routes the hook into the dynamic-load path that
    // actually calls loadPack. Without this, targetLang defaults to "it" (static pack)
    // and every toHaveBeenCalledWith below would fail for the wrong reason.
    localStorage.setItem(LANG_PAIR_KEY, "en-es");
    mockFetchManifest.mockResolvedValue(null);
    mockLoadPack.mockResolvedValue(MOCK_PACK_RESULT);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Store reset is handled by the file-level afterEach above.
  });

  it("passes the store's default unlockedPacks as options.unlockedLangs", async () => {
    // GIVEN the entitlement store at its true default (unlockedPacks = FREE_PACK_CODES)
    renderHook(() => useLangPack());
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));

    // THEN the exact default array reaches loadPack — catches wiring unlockedLangs to the
    // wrong store field (purchasedAddOns also defaults to [], but unlockedPacks is ["it"]).
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, {
      purchasedAddOns: [],
      unlockedLangs: [...FREE_PACK_CODES],
    });
  });

  it("passes a mutated unlockedPacks value set before mount", async () => {
    // GIVEN a store whose unlockedPacks differs from the module-level default — catches a
    // hardcoded `unlockedLangs: [...FREE_PACK_CODES]` at the call site (the exact class of
    // never-reads-real-state bug Task #377 exists to prevent).
    useEntitlementStore.setState({ unlockedPacks: ["it", "es"] });

    renderHook(() => useLangPack());
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));

    expect(mockLoadPack).toHaveBeenCalledWith("es", null, {
      purchasedAddOns: [],
      unlockedLangs: ["it", "es"],
    });
  });

  it("re-runs the effect and calls loadPack again when unlockedPacks changes after mount", async () => {
    // GIVEN the hook mounted and called loadPack once with the default
    renderHook(() => useLangPack());
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));
    expect(mockLoadPack).toHaveBeenNthCalledWith(1, "es", null, {
      purchasedAddOns: [],
      unlockedLangs: [...FREE_PACK_CODES],
    });

    // WHEN unlockedPacks changes (new array reference → effect dep fires)
    act(() => {
      useEntitlementStore.setState({ unlockedPacks: ["it", "es"] });
    });

    // THEN the effect re-runs — deleting unlockedPacks from the dep array leaves the call
    // count at 1 and this waitFor times out.
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(2));
    expect(mockLoadPack).toHaveBeenLastCalledWith("es", null, {
      purchasedAddOns: [],
      unlockedLangs: ["it", "es"],
    });
  });

  it("re-calls loadPack with updated unlockedLangs when setEntitlement — the production mutator — updates unlockedPacks", async () => {
    // GIVEN the hook mounted against default state
    renderHook(() => useLangPack());
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));

    // WHEN entitlement arrives via the REAL production write path (license activation calls
    // setEntitlement, not raw setState) — Rule 20a: trace the real mutator, so a future
    // in-place mutation of unlockedPacks inside setEntitlement breaks this test even though
    // the raw-setState test above would keep passing.
    act(() => {
      useEntitlementStore.getState().setEntitlement({
        licenseKey: "TEST-KEY",
        instanceId: "TEST-INSTANCE",
        licenseType: "subscription",
        unlockedPacks: ["it", "es"],
        validUntil: null,
      });
    });

    // THEN the hook re-fires loadPack with the newly-unlocked list
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(2));
    expect(mockLoadPack).toHaveBeenLastCalledWith("es", null, {
      purchasedAddOns: [],
      unlockedLangs: ["it", "es"],
    });
  });
});

describe("#378 — specialty pack target seeds/loads its base pack before requesting the specialty code", () => {
  const DEFAULT_OPTS = { purchasedAddOns: [], unlockedLangs: [...FREE_PACK_CODES] };

  beforeEach(() => {
    mockFetchManifest.mockResolvedValue(null);
    mockLoadPack.mockResolvedValue(MOCK_PACK_RESULT);
    // seedMemCache's boolean return is load-bearing in the resolver (a refused seed maps
    // to base_pack_not_loaded) — the mock must succeed by default like the real function.
    mockSeedMemCache.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("seeds the static base pack via seedMemCache BEFORE calling loadPack for a static-base specialty code", async () => {
    // GIVEN targetLang "it-legal" whose baseLang "it" IS statically bundled
    localStorage.setItem(LANG_PAIR_KEY, "en-it-legal");

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // THEN the seed received the real bundled units array — reference identity, so a copy
    // ([...units]) or a wrong array fails; toHaveBeenCalledWith would accept a copy.
    expect(mockSeedMemCache).toHaveBeenCalledTimes(1);
    expect(mockSeedMemCache.mock.calls[0]![0]).toBe("it");
    expect(mockSeedMemCache.mock.calls[0]![1]).toBe(ALL_UNITS);
    // AND loadPack fired exactly once — for the specialty code only; the static base is
    // seeded, never routed through loadPack.
    expect(mockLoadPack).toHaveBeenCalledTimes(1);
    expect(mockLoadPack).toHaveBeenCalledWith("it-legal", null, DEFAULT_OPTS);
    // AND the seed happened strictly before the specialty load (AC2)
    expect(mockSeedMemCache.mock.invocationCallOrder[0]!).toBeLessThan(
      mockLoadPack.mock.invocationCallOrder[0]!
    );
  });

  it("withholds the specialty loadPack call until the network base pack load has resolved ok", async () => {
    // GIVEN targetLang "es-business" whose baseLang "es" is NOT statically bundled, and a
    // base load we control manually — proves temporal gating, not just call order (a
    // Promise.all implementation would pass a mere order assertion).
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    let resolveBase!: (v: typeof MOCK_PACK_RESULT) => void;
    let resolveSpecialty!: (v: typeof MOCK_PACK_RESULT) => void;
    mockLoadPack.mockImplementation((lang: string) =>
      lang === "es"
        ? new Promise<typeof MOCK_PACK_RESULT>((res) => { resolveBase = res; })
        : new Promise<typeof MOCK_PACK_RESULT>((res) => { resolveSpecialty = res; })
    );

    const { result } = renderHook(() => useLangPack());

    // WHEN the base load is still pending: only the base call has fired, loading is true
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));
    expect(mockLoadPack).toHaveBeenNthCalledWith(1, "es", null, DEFAULT_OPTS);
    expect(result.current.loading).toBe(true);

    // AND WHEN the base load resolves ok but the specialty load is STILL pending:
    // loading stays true — no partial base-only render mid-chain (EDGE-c: the state
    // update is atomic, fired only once both steps settle)
    act(() => { resolveBase(MOCK_PACK_RESULT); });
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(2));
    expect(mockLoadPack).toHaveBeenNthCalledWith(2, "es-business", null, DEFAULT_OPTS);
    expect(result.current.loading).toBe(true);
    expect(result.current.units).toHaveLength(0);

    // THEN once the specialty load settles, the final state is the specialty result
    act(() => { resolveSpecialty(MOCK_PACK_RESULT); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.units).toHaveLength(1);
    expect(result.current.units[0]!.id).toBe("es-u01");
    expect(result.current.error).toBeNull();
  });

  it("propagates the base pack's failure and never calls loadPack for the specialty code", async () => {
    // GIVEN the network base load fails
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "download_failed" as const });

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // THEN exactly one loadPack call — the base; the specialty code is never requested (AC3)
    expect(mockLoadPack).toHaveBeenCalledTimes(1);
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, DEFAULT_OPTS);
    // AND the base error's own mapped message is surfaced
    expect(result.current.error).toBe("Couldn't load pack. Try again.");
    expect(result.current.units).toHaveLength(0);
  });

  it("surfaces the BASE pack's own message ('Pack not available.') when the base fails with invalid_lang — never the add-on purchase prompt (#378 F007)", async () => {
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "invalid_lang" as const });
    mockIsSpecialtyPackCode.mockReturnValue(true);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The single call must be the BASE code — this is what distinguishes the fixed hook from
    // the unmodified one (which would call "es-business" directly).
    expect(mockLoadPack).toHaveBeenCalledTimes(1);
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, DEFAULT_OPTS);
    // The failure is the base pack's invalid_lang: baseFailed=true suppresses the #324
    // add-on branch, so the user is told the base pack is unavailable — not to buy an
    // add-on they may already own.
    expect(result.current.error).toBe("Pack not available.");
  });

  it("surfaces 'Add-on not purchased.' only when the SPECIALTY pack itself is refused after the base loaded ok (#324 semantics preserved)", async () => {
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    mockLoadPack.mockImplementation((lang: string) =>
      lang === "es"
        ? Promise.resolve(MOCK_PACK_RESULT)
        : Promise.resolve({ ok: false as const, error: "invalid_lang" as const })
    );
    mockIsSpecialtyPackCode.mockReturnValue(true);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Base loaded ok (call 1), specialty refused (call 2) → purchase prompt is accurate here.
    expect(mockLoadPack).toHaveBeenCalledTimes(2);
    expect(mockLoadPack).toHaveBeenNthCalledWith(2, "es-business", null, DEFAULT_OPTS);
    expect(result.current.error).toBe("Add-on not purchased.");
  });

  it("does not repair LANG_PAIR_KEY for a READY-but-unentitled specialty code (stranded-code pin, see stream debt)", async () => {
    // GIVEN a persisted ready specialty code the user is not entitled to. The repair only
    // fires for unknown/unready codes; a ready code stays put and the user sees an error.
    // The missing escape route (learn page's back link not clearing LANG_PAIR_KEY) is out
    // of this task's file scope — logged as debt.
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "invalid_lang" as const });
    mockIsSpecialtyPackCode.mockReturnValue(true);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // #378-discriminating assertion (audit F017): the fixed hook resolves the BASE code
    // first — the pre-#378 hook called "es-business" directly and would fail this line.
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, DEFAULT_OPTS);
    expect(localStorage.getItem(LANG_PAIR_KEY)).toBe("en-es-business");
    expect(result.current.error).toBe("Pack not available.");
  });

  it("repairs a registered-but-UNREADY specialty code to Italian instead of stranding it (#378 F011)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // "it-medical" is the real registry entry (ready:false, preserved by the mock's spread).
    // Unready codes are unloadable everywhere downstream — treating them as known would
    // strand the user, so isKnownCode's ready filter routes them through the #339 repair.
    localStorage.setItem(LANG_PAIR_KEY, "en-it-medical");

    const { result } = renderHook(() => useLangPack());

    // Repaired to the Italian static pack: served synchronously, no loadPack, storage fixed.
    expect(result.current.loading).toBe(false);
    expect(result.current.units).toBe(ALL_UNITS);
    expect(mockLoadPack).not.toHaveBeenCalled();
    expect(localStorage.getItem(LANG_PAIR_KEY)).toBe("en-it");
    errorSpy.mockRestore();
  });

  it("re-loads a NETWORK-base specialty pack after clearEntitlement bumps the eviction generation (#378 F012)", async () => {
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockLoadPack).toHaveBeenCalledTimes(2); // base + specialty

    // Real production mutator, same Rule 20a rationale as the static-base sibling test.
    await act(async () => { await useEntitlementStore.getState().clearEntitlement(); });

    // Effect re-runs twice (entitlement-field reset render + generation-bump render, see
    // the static-base sibling test) — 2 initial + 2×2 = 6 calls; the FINAL pair must be
    // base-then-specialty, proving the evicted network base is re-resolved in order.
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(6));
    expect(mockLoadPack).toHaveBeenNthCalledWith(5, "es", null, DEFAULT_OPTS);
    expect(mockLoadPack).toHaveBeenNthCalledWith(6, "es-business", null, DEFAULT_OPTS);
  });

  it("continues the two-step chain after unmount as cache-warming (guard proven by the stale-language test in the first describe)", async () => {
    // GIVEN a controllable base load
    localStorage.setItem(LANG_PAIR_KEY, "en-es-business");
    let resolveBase!: (v: typeof MOCK_PACK_RESULT) => void;
    mockLoadPack.mockImplementation((lang: string) =>
      lang === "es"
        ? new Promise<typeof MOCK_PACK_RESULT>((res) => { resolveBase = res; })
        : Promise.resolve(MOCK_PACK_RESULT)
    );

    const { result, unmount } = renderHook(() => useLangPack());
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);

    // WHEN the hook unmounts while the base load is pending, then the base resolves
    unmount();
    resolveBase(MOCK_PACK_RESULT);
    await new Promise((r) => setTimeout(r, 0));

    // THEN the chain continues as cache-warming (specialty call fires — same pre-existing
    // behavior as the single-call chain). The cancelled guard itself is proven by the
    // stale-language-switch test in the first describe; post-unmount state is frozen by
    // RTL regardless of the guard, so asserting it here would prove nothing (cycle-2 N).
    expect(mockLoadPack).toHaveBeenCalledTimes(2);
  });

  it("holds the dynamic load until entitlement hydration completes, then fires with hydrated state (F014 gate)", async () => {
    // GIVEN the entitlement store has not hydrated
    localStorage.setItem(LANG_PAIR_KEY, "en-es");
    mockUseIsHydrated.mockReturnValue(false);

    const { result, rerender } = renderHook(() => useLangPack());
    await new Promise((r) => setTimeout(r, 20));

    // THEN no load fires while the gate is closed — deleting the gate makes this call fire
    expect(mockLoadPack).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);

    // WHEN hydration completes
    mockUseIsHydrated.mockReturnValue(true);
    rerender();

    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(1));
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, DEFAULT_OPTS);
  });

  it("proceeds with store defaults after the hydration grace period so a failed hydration can never hang the hook forever (F-C2-2)", async () => {
    vi.useFakeTimers();
    try {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // GIVEN hydration that NEVER completes (zustand's persist never finishes hydration
      // when storage.getItem rejects — this simulates that terminal state)
      localStorage.setItem(LANG_PAIR_KEY, "en-es");
      mockUseIsHydrated.mockReturnValue(false);

      renderHook(() => useLangPack());
      expect(mockLoadPack).not.toHaveBeenCalled();

      // WHEN the grace period expires (the hook's real exported constant — no magic copy)
      await act(async () => { await vi.advanceTimersByTimeAsync(HYDRATION_GRACE_MS); });

      // THEN the load proceeds with defaults (pre-#378 behavior as the degraded path) and
      // the fallback is logged (Rule 8) — deleting the grace fallback leaves loadPack
      // uncalled forever and this assertion fails.
      expect(mockLoadPack).toHaveBeenCalledWith("es", null, DEFAULT_OPTS);
      const graceLogs = errorSpy.mock.calls.filter(
        args => typeof args[0] === "string" && (args[0] as string).includes("ERR-ENTITLEMENT-HYDRATION-TIMEOUT")
      );
      expect(graceLogs).toHaveLength(1);
      errorSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("self-heals after a late hydration: grace-expired load with defaults is re-run with hydrated entitlement (WorldClass A4/V3)", async () => {
    vi.useFakeTimers();
    try {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // GIVEN hydration still pending when the grace period expires — the load proceeds
      // with store defaults
      localStorage.setItem(LANG_PAIR_KEY, "en-es");
      mockUseIsHydrated.mockReturnValue(false);
      const { rerender } = renderHook(() => useLangPack());
      await act(async () => { await vi.advanceTimersByTimeAsync(HYDRATION_GRACE_MS); });
      expect(mockLoadPack).toHaveBeenCalledTimes(1);

      // WHEN hydration completes LATE, after the grace fallback already fired
      mockUseIsHydrated.mockReturnValue(true);
      rerender();

      // THEN the effect re-fires with hydrated entitlement — the documented recovery, not
      // just the degraded fallback. Deleting entitlementHydrated from the dep array leaves
      // the count at 1 and this fails.
      await act(async () => { await vi.runOnlyPendingTimersAsync(); });
      expect(mockLoadPack).toHaveBeenCalledTimes(2);
      expect(mockLoadPack).toHaveBeenLastCalledWith("es", null, DEFAULT_OPTS);
      errorSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the hydration grace timer silent for a static-pack target — no misleading timeout error (WorldClass c3)", async () => {
    vi.useFakeTimers();
    try {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // GIVEN the static Italian target with hydration never completing — the static branch
      // never consults entitlement, so the timer must not arm and must not log.
      localStorage.setItem(LANG_PAIR_KEY, "en-it");
      mockUseIsHydrated.mockReturnValue(false);

      const { result } = renderHook(() => useLangPack());
      expect(result.current.loading).toBe(false); // static content served immediately

      await act(async () => { await vi.advanceTimersByTimeAsync(HYDRATION_GRACE_MS * 2); });

      const timeoutLogs = errorSpy.mock.calls.filter(
        args => typeof args[0] === "string" && (args[0] as string).includes("ERR-ENTITLEMENT-HYDRATION-TIMEOUT")
      );
      expect(timeoutLogs).toHaveLength(0);
      errorSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("repairs a registered-but-UNREADY BASE code to Italian instead of stranding it (WorldClass V1)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // GIVEN the real registry state: "es" registered but ready:false. The mock's ready
    // list is narrowed to reflect it. A stale persisted "en-es" (old build, corrupted
    // storage) must repair to "it" — before V1, isKnownCode used ALL_PACK_CODES membership,
    // so "es" was "known", skipped the repair, and stranded the user on the permanent
    // "Pack not available." screen with no self-heal.
    mockReadyPackCodes.length = 0;
    mockReadyPackCodes.push("it");
    localStorage.setItem(LANG_PAIR_KEY, "en-es");

    const { result } = renderHook(() => useLangPack());

    expect(result.current.loading).toBe(false);
    expect(result.current.units).toBe(ALL_UNITS);
    expect(mockLoadPack).not.toHaveBeenCalled();
    expect(localStorage.getItem(LANG_PAIR_KEY)).toBe("en-it");
    errorSpy.mockRestore();
  });

  it("re-seeds and re-loads a static-base specialty pack after clearEntitlement bumps the eviction generation", async () => {
    // GIVEN a loaded static-base specialty pack
    localStorage.setItem(LANG_PAIR_KEY, "en-it-legal");
    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSeedMemCache).toHaveBeenCalledTimes(1);
    expect(mockLoadPack).toHaveBeenCalledTimes(1);

    // WHEN entitlement is cleared via the REAL production mutator — clearEntitlement is
    // the only production incrementer of _cacheEvictionGeneration (Rule 20a; raw setState
    // injection would keep passing even if clearEntitlement stopped bumping the counter)
    await act(async () => { await useEntitlementStore.getState().clearEntitlement(); });

    // THEN the effect re-runs: clearEntitlement triggers TWO re-renders (the synchronous
    // entitlement-field reset replaces purchasedAddOns/unlockedPacks with fresh arrays,
    // then the post-eviction generation bump lands) — 1 initial + 2 re-runs = 3 each.
    // The evicted base cannot leave loadSpecialtyPack's precondition permanently broken.
    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(3));
    expect(mockSeedMemCache).toHaveBeenCalledTimes(3);
    expect(mockSeedMemCache.mock.calls[2]![0]).toBe("it");
    expect(mockLoadPack).toHaveBeenLastCalledWith("it-legal", null, DEFAULT_OPTS);
  });
});
