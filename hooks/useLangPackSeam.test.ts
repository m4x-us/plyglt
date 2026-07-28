// ============================================================
// hooks/useLangPackSeam.test.ts — Rule 13 seam test: useLangPack → REAL packLoader →
// REAL specialtyPackLoader → REAL packCache (no @/lib/packLoader mock).
// ============================================================
// #378 audit F004: the hook's post-reload base-pack seeding exists solely to satisfy
// loadSpecialtyPack's memCache.has(baseLang) precondition. The unit suites prove each side
// against mocks; this file traces the real cross-module handoff. The discriminating signal:
// with the pre-#378 hook, a specialty target fails with base_pack_not_loaded ("Load the
// base language pack first.") because nothing seeded the base; with the fix, the flow gets
// PAST that precondition and fails later, at the no-manifest integrity refusal
// ("Pack data corrupted. Try again."), which is only reachable when memCache.has("it") held.
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

// Only the registry is mocked — a ready specialty entry must exist to exercise the path at
// all (the sole real entry, it-medical, is ready:false). Everything below the hook is real.
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: [
      ...actual.SPECIALTY_PACKS,
      { code: "it-legal", baseLang: "it", name: "Legal Italian", ready: true },
    ],
    isSpecialtyPackCode: (s: string) => s === "it-legal",
  };
});

import { useLangPack } from "@/hooks/useLangPack";
import { clearCacheForTesting } from "@/lib/packLoader";
import { useEntitlementStore } from "@/store/entitlementStore";
import { LANG_PAIR_KEY } from "@/lib/constants";

describe("#378 seam — hook's base seed satisfies loadSpecialtyPack's precondition through the real loader stack", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCacheForTesting();
    // Manifest fetch fails (offline) and no pack bytes are ever served — the flow must
    // reach specialtyPackLoader's own no-manifest refusal WITHOUT any network content.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    vi.spyOn(console, "warn").mockImplementation(() => {}); // getLanguageConfig specialty-fallback warn
  });

  afterEach(() => {
    cleanup();
    useEntitlementStore.setState(useEntitlementStore.getInitialState());
    clearCacheForTesting();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("a purchased static-base specialty target gets PAST base_pack_not_loaded (fails later at integrity, not at the precondition)", async () => {
    useEntitlementStore.setState({ purchasedAddOns: ["it-legal"] });
    localStorage.setItem(LANG_PAIR_KEY, "en-it-legal");

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The pre-#378 hook produces "Load the base language pack first." here (precondition
    // failure — nothing seeded memCache["it"]). The fixed hook's real seedMemCache satisfies
    // the precondition, so the REAL loadSpecialtyPack proceeds to its no-manifest integrity
    // refusal instead. This single assertion pair is the whole seam contract.
    expect(result.current.error).not.toBe("Load the base language pack first.");
    expect(result.current.error).toBe("Pack data corrupted. Try again.");
  });

  it("an unpurchased specialty target is redirected to its base language before the REAL purchase gate is ever reached (#419)", async () => {
    // purchasedAddOns stays [] — Task #419's render-body redirect now catches this locally
    // (isSpecialtyPackCode + !hasAddOn) and falls back to "it-legal"'s own baseLang BEFORE
    // ever attempting the specialty load, so the real loadSpecialtyPack's entitlement gate
    // is never even reached for this target. This replaces the pre-#419 behavior (permanent
    // "Add-on not purchased." dead end) with a working base-language pack and a self-healed
    // LANG_PAIR_KEY.
    localStorage.setItem(LANG_PAIR_KEY, "en-it-legal");

    const { result } = renderHook(() => useLangPack());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(localStorage.getItem(LANG_PAIR_KEY)).toBe("en-it");
  });
});
