// ============================================================
// useExportImport.test.ts — Tests for useExportImport backup hook
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExportImport, excludePurchasedAddOns } from "./useExportImport";
import type { BackupEntitlement } from "@/lib/importBackup";

// Mock stores and dependencies that useExportImport relies on
vi.mock("@/store/srsStore", () => ({
  useSRSStore: {
    getState: () => ({ cards: {}, streak: 0, lastStudiedDate: null }),
    setState: vi.fn(),
  },
}));

// Stable mock reference (not recreated per getState() call) so tests can assert on it.
const mockSetEntitlement = vi.fn();
vi.mock("@/store/entitlementStore", () => ({
  useEntitlementStore: {
    getState: () => ({
      licenseKey: null,
      instanceId: null,
      licenseType: "free",
      unlockedPacks: [],
      validUntil: null,
      setEntitlement: mockSetEntitlement,
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
  getLangPair: vi.fn().mockReturnValue("en-it"),
  getTargetLangCode: vi.fn().mockReturnValue("it"),
  setTargetLangCode: vi.fn(),
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
    mockSetEntitlement.mockClear();
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

  // ── Task #430: a restored backup must not grant a free validation grace period ──
  it("#430: restoring a backup's license calls setEntitlement with lastValidated:0 (unverified) rather than Date.now()", async () => {
    // Before #430, setEntitlement stamped lastValidated:Date.now() internally regardless
    // of caller — an unsigned, hand-crafted backup with an arbitrary licenseKey/instanceId
    // got a full VALIDATION_POLL_INTERVAL_MS grace period before the app ever contacted the
    // real license server. lastValidated:0 makes needsValidation() true immediately, so
    // components/EntitlementValidator.tsx re-validates on the very next app foreground.
    const { parseBackup } = await import("@/lib/importBackup");
    vi.mocked(parseBackup).mockReturnValueOnce({
      ok: true,
      srs: { cards: {}, streak: 0, lastStudiedDate: null },
      entitlement: {
        licenseKey: "FORGED-KEY",
        instanceId: "forged-instance",
        licenseType: "subscription",
        unlockedPacks: ["it", "es"],
        validUntil: null,
        purchasedAddOns: [],
      },
      langPair: "en-it",
      validCardCount: 0,
      skippedCardCount: 0,
    });

    const { result } = renderHook(() => useExportImport());
    const fileContent = JSON.stringify({ _version: 2, langPair: "en-it", srs: { cards: {} }, entitlement: {} });
    const file = new File([fileContent], "backup.json", { type: "application/json" });

    await act(async () => {
      await result.current.readFile(file);
    });

    expect(mockSetEntitlement).toHaveBeenCalledWith({
      licenseKey: "FORGED-KEY",
      instanceId: "forged-instance",
      licenseType: "subscription",
      unlockedPacks: ["it", "es"],
      validUntil: null,
      lastValidated: 0,
    });
  });

  // ── Task #440: purchasedAddOns exclusion enforced structurally, not by call-site convention ──
  it("#440: restoring a backup with a non-empty purchasedAddOns never passes it to setEntitlement", async () => {
    const { parseBackup } = await import("@/lib/importBackup");
    vi.mocked(parseBackup).mockReturnValueOnce({
      ok: true,
      srs: { cards: {}, streak: 0, lastStudiedDate: null },
      entitlement: {
        licenseKey: "FORGED-KEY",
        instanceId: "forged-instance",
        licenseType: "subscription",
        unlockedPacks: ["it"],
        validUntil: null,
        purchasedAddOns: ["it-medical"],
      },
      langPair: "en-it",
      validCardCount: 0,
      skippedCardCount: 0,
    });

    const { result } = renderHook(() => useExportImport());
    const fileContent = JSON.stringify({ _version: 2, langPair: "en-it", srs: { cards: {} }, entitlement: {} });
    const file = new File([fileContent], "backup.json", { type: "application/json" });

    await act(async () => {
      await result.current.readFile(file);
    });

    expect(mockSetEntitlement).toHaveBeenCalledTimes(1);
    const calledWith = mockSetEntitlement.mock.calls[0]![0] as Record<string, unknown>;
    expect(calledWith).not.toHaveProperty("purchasedAddOns");
    expect(Object.keys(calledWith).sort()).toEqual(
      ["instanceId", "lastValidated", "licenseKey", "licenseType", "unlockedPacks", "validUntil"].sort()
    );
  });
});

describe("excludePurchasedAddOns (#440)", () => {
  const fullEntitlement: BackupEntitlement = {
    licenseKey: "KEY",
    instanceId: "INSTANCE",
    licenseType: "subscription",
    unlockedPacks: ["it"],
    validUntil: 12345,
    purchasedAddOns: ["it-medical"],
  };

  it("strips purchasedAddOns from the returned object entirely — not just sets it to []", () => {
    const restorable = excludePurchasedAddOns(fullEntitlement);
    expect(restorable).not.toHaveProperty("purchasedAddOns");
    expect(Object.keys(restorable).sort()).toEqual(
      ["instanceId", "licenseKey", "licenseType", "unlockedPacks", "validUntil"].sort()
    );
  });

  it("preserves every other field unchanged", () => {
    const restorable = excludePurchasedAddOns(fullEntitlement);
    expect(restorable).toEqual({
      licenseKey: "KEY",
      instanceId: "INSTANCE",
      licenseType: "subscription",
      unlockedPacks: ["it"],
      validUntil: 12345,
    });
  });

  it("a naive full-spread of the return value can never reintroduce purchasedAddOns — the field is structurally absent, not just unlisted", () => {
    // Simulates the exact regression the audit found in an abandoned worktree: a call
    // site spreading the entitlement object directly into setEntitlement instead of
    // naming fields. Because excludePurchasedAddOns already stripped the key, even a
    // careless full-spread call site cannot resurrect it.
    const restorable = excludePurchasedAddOns(fullEntitlement);
    const spreadIntoCallSite = { ...restorable, licenseKey: "OVERRIDDEN", lastValidated: 0 };
    expect(spreadIntoCallSite).not.toHaveProperty("purchasedAddOns");
  });
});
