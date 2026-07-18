// ============================================================
// purchaseAddOnGuards.test.ts — Guards for purchaseAddOn input validation
// ============================================================
// Task #336: tests/entitlement.test.ts is off-limits for modification; this
// supplementary file covers the input-validation guards added in W12A–W13A.
// Task #349: receiptToken length/charset validation mirrors useLicenseActivation.ts.
// Task #388: the store-level Pro gate is now IMPLEMENTED (isProEnabled, before the
// receipt guards) — the beforeEach below sets licenseType:"subscription" so these
// tests reach the guards behind it. Gate coverage lives in tests/entitlement.test.ts.
//
// Mocking rationale:
//   - SPECIALTY_PACKS is Object.freeze([]) in production (deliberate W12A deferral #295).
//     Tests mock "it-medical" as a valid code so guards AFTER the code check can be reached.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useEntitlementStore,
  ERR_ADDON_RECEIPT_INVALID,
  ERR_ADDON_INVALID_CODE,
} from "@/store/entitlementStore";

// Register "it-medical" so the code guard passes in tests that target later guards.
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    isSpecialtyPackCode: (code: string) => code === "it-medical",
    SPECIALTY_PACKS: Object.freeze([
      { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: false },
    ]),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function store() {
  return useEntitlementStore.getState();
}

beforeEach(() => {
  vi.clearAllMocks(); // reset spy call history accumulated by previous tests in this file
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  useEntitlementStore.setState({ licenseType: "subscription", purchasedAddOns: [] });
});

// ── #336: empty-token guard ───────────────────────────────────────────────────

describe("purchaseAddOn — receiptToken empty guard (#336)", () => {
  it("rejects an empty receiptToken with receipt_invalid", async () => {
    const result = await store().purchaseAddOn("it-medical", "");
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("receiptToken is empty")
    );
  });

  it("rejects a whitespace-only receiptToken with receipt_invalid", async () => {
    const result = await store().purchaseAddOn("it-medical", "   ");
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("receiptToken is empty")
    );
  });

  it("rejects a tab-only receiptToken with receipt_invalid", async () => {
    const result = await store().purchaseAddOn("it-medical", "\t");
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("receiptToken is empty")
    );
  });
});

// ── #349: receiptToken length + charset validation ────────────────────────────

describe("purchaseAddOn — receiptToken format validation (#349)", () => {
  it("rejects a token exceeding 200 characters", async () => {
    const longToken = "A".repeat(201);
    const result = await store().purchaseAddOn("it-medical", longToken);
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("failed format validation")
    );
  });

  it("accepts a token of exactly 200 characters — passes format guard (reaches IPC boundary)", async () => {
    // In test env invoke() returns null (web mode — no Tauri runtime) → receipt verification
    // returns receipt_invalid, but from the verified=null path, NOT the format guard path.
    const borderToken = "A".repeat(200);
    const result = await store().purchaseAddOn("it-medical", borderToken);
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    // Format guard did NOT fire (message would be "failed format validation")
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("failed format validation")
    );
    // The IPC null-return path fired instead
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("receipt verification rejected")
    );
  });

  it("rejects a token containing spaces", async () => {
    const result = await store().purchaseAddOn("it-medical", "valid token here");
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("failed format validation")
    );
  });

  it("rejects a token containing @ symbol", async () => {
    const result = await store().purchaseAddOn("it-medical", "token@domain");
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("failed format validation")
    );
  });

  it("accepts a valid alphanumeric-hyphen-underscore token (reaches IPC boundary)", async () => {
    const validToken = "LS_ORDER-12345_abc";
    const result = await store().purchaseAddOn("it-medical", validToken);
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    // Confirm format guard did not fire
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("failed format validation")
    );
  });
});

// ── Code guard (baseline) ─────────────────────────────────────────────────────

describe("purchaseAddOn — unregistered code guard", () => {
  it("rejects an unregistered specialty pack code with invalid_code", async () => {
    const result = await store().purchaseAddOn("it-nonexistent", "RECEIPT-123");
    expect(result).toStrictEqual({ ok: false, error: ERR_ADDON_INVALID_CODE });
  });
});

// ── #357/#388: Pro subscription gate — IMPLEMENTED at the store level ─────────
// purchaseAddOn rejects non-subscription purchasers with ERR_ADDON_NOT_PRO via
// isProEnabled(getFeatureFlags().specialtyPacks, licenseType), placed after the
// code-validity guard and before the receipt guards. Gate regression tests live in
// tests/entitlement.test.ts ("#388" cases).
