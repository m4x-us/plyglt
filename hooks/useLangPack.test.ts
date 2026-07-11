// ============================================================
// hooks/useLangPack.test.ts — Behavioral tests for the useLangPack hook body
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { LANG_PAIR_KEY } from "@/lib/constants";
import { useLangPack } from "@/hooks/useLangPack";

// Mock packLoader — controls the async dynamic-load path (lines 62–84 of hook)
vi.mock("@/lib/packLoader", () => ({
  fetchManifest: vi.fn(),
  loadPack: vi.fn(),
  seedMemCache: vi.fn(), // #296: hook calls this in the static-pack useState initializer
}));

import { fetchManifest, loadPack, seedMemCache } from "@/lib/packLoader";
const mockFetchManifest = vi.mocked(fetchManifest);
const mockLoadPack = vi.mocked(loadPack);
const mockSeedMemCache = vi.mocked(seedMemCache);

// Mock langRegistry — override isReadySpecialtyPackCode so #324 behaviour can be tested
// without registering real specialty packs (SPECIALTY_PACKS is empty in the base registry).
// isValidPackCode is also extended to accept "pt" — pt was removed from LANGUAGE_REGISTRY
// (2026-06-27) but the existing language-switch test uses it as a second non-static language;
// without this, the #323 repair fires on "pt" and redirects to the Italian static path,
// preventing the test from observing the intended dynamic-load behaviour.
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    isValidPackCode: (s: string) => actual.isValidPackCode(s) || s === "pt",
    isReadySpecialtyPackCode: vi.fn().mockReturnValue(false),
  };
});

import { isReadySpecialtyPackCode } from "@/lib/langRegistry";
const mockIsReadySpecialtyPackCode = vi.mocked(isReadySpecialtyPackCode);

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
    // #261: hook now threads purchasedAddOns from the entitlement store into loadPack options
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, { purchasedAddOns: [] });
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
    expect(mockLoadPack).toHaveBeenCalledWith("es", null, { purchasedAddOns: [] });

    // Switch to a different non-static language; rerender causes hook to re-read localStorage
    localStorage.setItem(LANG_PAIR_KEY, "en-pt");
    rerender();

    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(2));
    expect(mockLoadPack).toHaveBeenLastCalledWith("pt", null, { purchasedAddOns: [] });
  });

  it("loaded units match mock data — not undefined", async () => {
    const { result } = renderHook(() => useLangPack());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.units).toBeDefined();
    expect(result.current.units[0]).toBeDefined();
    expect(result.current.units[0]!.id).toBe("es-u01");
  });

  it("Italian static pack returns immediately with loading: false — no network call", () => {
    // "it" is bundled in STATIC_PACKS — exercises the static branch in useState initializer
    // and the early-return guard in useEffect (line 63 of hook)
    localStorage.setItem(LANG_PAIR_KEY, "en-it");

    const { result } = renderHook(() => useLangPack());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.units.length).toBeGreaterThan(0);
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

  it("does not update state when component unmounts before loadPack resolves (cancelled guard)", async () => {
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

    // Unmount: triggers useEffect cleanup → sets cancelled = true
    unmount();

    // Resolve loadPack now — `if (cancelled) return` fires; setState is NOT called
    // (no React warning about state update on unmounted component)
    resolveLoad(MOCK_PACK_RESULT);
    await new Promise((r) => setTimeout(r, 0));

    // The test passes if no "Can't perform state update on unmounted component" error occurs.
    expect(mockLoadPack).toHaveBeenCalledTimes(1);
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
    // seedMemCache must have been called exactly once in the useState initializer
    expect(mockSeedMemCache).toHaveBeenCalledTimes(1);
    // Called with "it" and a non-empty units array (the bundled Italian content)
    expect(mockSeedMemCache).toHaveBeenCalledWith("it", expect.any(Array));
    const callArg = mockSeedMemCache.mock.calls[0]![1] as unknown[];
    // existence-check: Italian unit count changes as curriculum grows — any non-zero count proves the array was passed
    expect(callArg.length).toBeGreaterThan(0);
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
    mockIsReadySpecialtyPackCode.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows 'Pack not available.' for invalid_lang on a non-specialty code", async () => {
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "invalid_lang" as const });
    mockIsReadySpecialtyPackCode.mockReturnValue(false);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Pack not available.");
  });

  it("shows 'Add-on not purchased.' for invalid_lang when targetLang is a ready specialty pack code", async () => {
    // Simulate a user who has "es" as their lang (non-static path) and the code is a ready specialty
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "invalid_lang" as const });
    // isReadySpecialtyPackCode returns true → user has a purchasable add-on, not an unknown code
    mockIsReadySpecialtyPackCode.mockReturnValue(true);

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Add-on not purchased.");
  });

  it("non-invalid_lang errors are not affected by the specialty check", async () => {
    mockLoadPack.mockResolvedValue({ ok: false as const, error: "download_failed" as const });
    mockIsReadySpecialtyPackCode.mockReturnValue(true); // should not affect download_failed

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Couldn't load pack. Try again.");
  });
});
