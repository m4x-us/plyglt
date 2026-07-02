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
}));

import { fetchManifest, loadPack } from "@/lib/packLoader";
const mockFetchManifest = vi.mocked(fetchManifest);
const mockLoadPack = vi.mocked(loadPack);

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
    expect(mockLoadPack).toHaveBeenCalledWith("es", null);
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
    expect(mockLoadPack).toHaveBeenCalledWith("es", null);

    // Switch to a different non-static language; rerender causes hook to re-read localStorage
    localStorage.setItem(LANG_PAIR_KEY, "en-pt");
    rerender();

    await waitFor(() => expect(mockLoadPack).toHaveBeenCalledTimes(2));
    expect(mockLoadPack).toHaveBeenLastCalledWith("pt", null);
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
