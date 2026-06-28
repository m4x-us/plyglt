// @vitest-environment jsdom
// ============================================================
// hooks/useLicenseActivation.test.ts — behavioral tests for useLicenseActivation hook
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockActivateLicense, mockValidateLicense, mockDeactivateLicense } = vi.hoisted(() => ({
  mockActivateLicense: vi.fn(),
  mockValidateLicense: vi.fn(),
  mockDeactivateLicense: vi.fn(),
}));

const { mockSetEntitlement, mockMarkValidated, mockClearEntitlement } = vi.hoisted(() => ({
  mockSetEntitlement: vi.fn(),
  mockMarkValidated: vi.fn(),
  mockClearEntitlement: vi.fn(),
}));

vi.mock("@/lib/entitlement", () => ({
  activateLicense: mockActivateLicense,
  validateLicense: mockValidateLicense,
  deactivateLicense: mockDeactivateLicense,
}));

vi.mock("@/store/entitlementStore", () => ({
  useEntitlementStore: {
    getState: () => ({
      licenseKey: "test-key-123",
      instanceId: "test-instance-456",
      licenseType: "free",
      unlockedPacks: [],
      setEntitlement: mockSetEntitlement,
      markValidated: mockMarkValidated,
      clearEntitlement: mockClearEntitlement,
    }),
  },
}));

import { useLicenseActivation } from "./useLicenseActivation";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useLicenseActivation — handleActivate", () => {
  it("ok path: transitions idle→loading→success and updates entitlement store with correct fields", async () => {
    mockActivateLicense.mockResolvedValue({
      ok: true,
      licenseKey: "test-key-123",
      instanceId: "test-instance-456",
      licenseType: "subscription",
      unlockedPacks: ["it"],
      validUntil: null,
    });

    const { result } = renderHook(() => useLicenseActivation());

    act(() => {
      result.current.setLicenseInput("TEST-LICENSE-KEY");
    });

    await act(async () => {
      await result.current.handleActivate();
    });

    expect(result.current.licenseStatus.type).toBe("success");
    expect(mockSetEntitlement).toHaveBeenCalledWith({
      licenseKey: "test-key-123",
      instanceId: "test-instance-456",
      licenseType: "subscription",
      unlockedPacks: ["it"],
      validUntil: null,
    });
  });

  it("error path: transitions to error with server message when activation returns ok:false", async () => {
    mockActivateLicense.mockResolvedValue({
      ok: false,
      error: "License key not found.",
    });

    const { result } = renderHook(() => useLicenseActivation());

    act(() => {
      result.current.setLicenseInput("INVALID-KEY");
    });

    await act(async () => {
      await result.current.handleActivate();
    });

    expect(result.current.licenseStatus.type).toBe("error");
    expect((result.current.licenseStatus as { type: "error"; message: string }).message).toBe(
      "License key not found.",
    );
    expect(mockSetEntitlement).not.toHaveBeenCalled();
  });
});

describe("useLicenseActivation — handleValidate", () => {
  it("valid license: transitions to success and calls markValidated with server validUntil", async () => {
    mockValidateLicense.mockResolvedValue({ ok: true, validUntil: null });

    const { result } = renderHook(() => useLicenseActivation());

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(result.current.licenseStatus.type).toBe("success");
    expect(mockMarkValidated).toHaveBeenCalledWith(null);
  });
});

describe("useLicenseActivation — handleDeactivate", () => {
  it("ok path: calls clearEntitlement and transitions to idle", async () => {
    mockDeactivateLicense.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useLicenseActivation());

    await act(async () => {
      await result.current.handleDeactivate();
    });

    expect(mockClearEntitlement).toHaveBeenCalledTimes(1);
    expect(result.current.licenseStatus.type).toBe("idle");
  });
});
