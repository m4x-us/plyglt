// ============================================================
// useExportImport.test.ts — Tests for useExportImport backup hook
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExportImport } from "./useExportImport";

// Mock stores and dependencies that useExportImport relies on
vi.mock("@/store/srsStore", () => ({
  useSRSStore: {
    getState: () => ({ cards: {}, streak: 0, lastStudiedDate: null }),
    setState: vi.fn(),
  },
}));

vi.mock("@/store/entitlementStore", () => ({
  useEntitlementStore: {
    getState: () => ({
      licenseKey: null,
      instanceId: null,
      licenseType: "free",
      unlockedPacks: [],
      validUntil: null,
      setEntitlement: vi.fn(),
    }),
  },
}));

vi.mock("@/lib/exportBackup", () => ({
  exportBackup: vi.fn(() => '{"_version":2,"langPair":"en-it","srs":{"cards":{},"streak":0,"lastStudiedDate":null},"entitlement":{"licenseKey":null,"instanceId":null,"licenseType":"free","unlockedPacks":[],"validUntil":null}}'),
}));

vi.mock("@/lib/importBackup", () => ({
  parseBackup: vi.fn((data) => ({
    ok: true,
    srs: { cards: {}, streak: 0, lastStudiedDate: null },
    entitlement: { licenseKey: null, instanceId: null, licenseType: "free", unlockedPacks: [], validUntil: null },
    langPair: "en-it",
    validCardCount: 0,
    skippedCardCount: 0,
  })),
}));

vi.mock("@/lib/constants", () => ({
  LANG_PAIR_KEY: "plyglt_lang_pair",
}));

describe("useExportImport — handleExport", () => {
  let createdElement: HTMLAnchorElement | undefined;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        createdElement = el as HTMLAnchorElement;
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {});
      }
      return el;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    Object.defineProperty(window, "localStorage", {
      value: { getItem: () => "en-it", setItem: () => {}, removeItem: () => {} },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handleExport creates a download link and clicks it", () => {
    const { result } = renderHook(() => useExportImport());
    act(() => { result.current.handleExport(); });
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const objectUrl = vi.mocked(URL.createObjectURL).mock.results[0]!.value;
    expect(createdElement!.getAttribute("href")).toBe(objectUrl);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("handleExport sets dataStatus to success", () => {
    const { result } = renderHook(() => useExportImport());
    act(() => { result.current.handleExport(); });
    expect(result.current.dataStatus.type).toBe("success");
  });
});

describe("useExportImport — handleImportFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handleImportFile calls parseBackup on file content", async () => {
    const { parseBackup } = await import("@/lib/importBackup");
    const { result } = renderHook(() => useExportImport());

    const fileContent = JSON.stringify({ _version: 2, langPair: "en-it", srs: { cards: {} }, entitlement: {} });
    const file = new File([fileContent], "backup.json", { type: "application/json" });

    await act(async () => {
      await result.current.readFile(file);
    });

    expect(parseBackup).toHaveBeenCalled();
  });

  it("sets dataStatus to error when parseBackup returns ok:false", async () => {
    const { parseBackup } = await import("@/lib/importBackup");
    vi.mocked(parseBackup).mockReturnValueOnce({ ok: false, error: "Invalid backup format." });

    const { result } = renderHook(() => useExportImport());

    const fileContent = JSON.stringify({ _version: 2 });
    const file = new File([fileContent], "backup.json", { type: "application/json" });

    await act(async () => {
      await result.current.readFile(file);
    });

    expect(result.current.dataStatus.type).toBe("error");
    expect((result.current.dataStatus as { type: "error"; message: string }).message).toBe(
      "Invalid backup format.",
    );
  });
});
