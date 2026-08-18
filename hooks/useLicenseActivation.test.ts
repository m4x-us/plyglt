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

import { useLicenseActivation, LICENSE_KEY_MAX_LENGTH } from "./useLicenseActivation";

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

    const before = Date.now();
    await act(async () => {
      await result.current.handleActivate();
    });
    const after = Date.now();

    expect(result.current.licenseStatus.type).toBe("success");
    // Task #430: lastValidated must be a fresh Date.now() stamp — this call follows a real
    // activateLicense() server round-trip, so it earns a full validation grace period
    // (unlike an unsigned backup restore, which passes lastValidated:0 — see useExportImport.test.ts).
    // Task #453: expect.any(Number) would also pass a wrong implementation that passed the
    // literal 0 (the value the unrelated backup-restore path uses) — bound lastValidated to
    // the [before, after] window around this call instead, like useExportImport.test.ts's
    // sibling assertion pins its own exact literal.
    expect(mockSetEntitlement).toHaveBeenCalledTimes(1);
    const callArg = mockSetEntitlement.mock.calls[0]![0];
    expect(callArg).toMatchObject({
      licenseKey: "test-key-123",
      instanceId: "test-instance-456",
      licenseType: "subscription",
      unlockedPacks: ["it"],
      validUntil: null,
    });
    expect(callArg.lastValidated).toBeGreaterThanOrEqual(before);
    expect(callArg.lastValidated).toBeLessThanOrEqual(after);
  });

  // #098 — local validation before IPC
  it("rejects keys longer than 200 characters without calling activateLicense", async () => {
    const { result } = renderHook(() => useLicenseActivation());
    act(() => { result.current.setLicenseInput("A".repeat(300)); });
    await act(async () => { await result.current.handleActivate(); });

    expect(mockActivateLicense).not.toHaveBeenCalled();
    expect(result.current.licenseStatus).toMatchObject({
      type: "error",
      message: expect.stringContaining("format"),
    });
  });

  // Task #423: pins the named constant's exact boundary, not just "some large number".
  it("accepts a key exactly at LICENSE_KEY_MAX_LENGTH characters", async () => {
    mockActivateLicense.mockResolvedValueOnce({ ok: false, error: "Activation failed." });
    const { result } = renderHook(() => useLicenseActivation());
    const key = "A".repeat(LICENSE_KEY_MAX_LENGTH);
    act(() => { result.current.setLicenseInput(key); });
    await act(async () => { await result.current.handleActivate(); });

    expect(mockActivateLicense).toHaveBeenCalledWith(key);
  });

  it("rejects a key one character past LICENSE_KEY_MAX_LENGTH", async () => {
    const { result } = renderHook(() => useLicenseActivation());
    act(() => { result.current.setLicenseInput("A".repeat(LICENSE_KEY_MAX_LENGTH + 1)); });
    await act(async () => { await result.current.handleActivate(); });

    expect(mockActivateLicense).not.toHaveBeenCalled();
    expect(result.current.licenseStatus).toMatchObject({
      type: "error",
      message: expect.stringContaining("format"),
    });
  });

  it("rejects keys with invalid characters (spaces, symbols) without calling activateLicense", async () => {
    const { result } = renderHook(() => useLicenseActivation());
    act(() => { result.current.setLicenseInput("XXXX YYYY ZZZZ"); });
    await act(async () => { await result.current.handleActivate(); });

    expect(mockActivateLicense).not.toHaveBeenCalled();
    expect(result.current.licenseStatus.type).toBe("error");
  });

  // Round-15 audit finding (Red Agent R): the Activate button's `disabled` attribute only
  // guards a second mouse click — the license-key input's onKeyDown handler
  // (app/settings/page.tsx) calls handleActivate() on every Enter keypress unconditionally,
  // so two ordinary taps before the round-trip resolves fired two concurrent
  // activateLicense() calls, each potentially consuming a real activation seat. Deletion
  // Test: removing the `if (licenseStatus.type === "loading") return;` guard makes this
  // test fail — mockActivateLicense would be called twice instead of once.
  it("ignores a second handleActivate call while the first is still in flight (re-entrancy guard)", async () => {
    let resolveActivate!: (value: unknown) => void;
    mockActivateLicense.mockImplementation(
      () => new Promise((resolve) => { resolveActivate = resolve; }),
    );

    const { result } = renderHook(() => useLicenseActivation());
    act(() => { result.current.setLicenseInput("TEST-LICENSE-KEY"); });

    let firstCallPromise!: Promise<void>;
    act(() => {
      firstCallPromise = result.current.handleActivate();
    });
    expect(result.current.licenseStatus.type).toBe("loading");

    // Second "Enter" tap, simulated before the first round-trip resolves.
    await act(async () => {
      await result.current.handleActivate();
    });

    expect(mockActivateLicense).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveActivate({
        ok: true,
        licenseKey: "test-key-123",
        instanceId: "test-instance-456",
        licenseType: "subscription",
        unlockedPacks: ["it"],
        validUntil: null,
      });
      await firstCallPromise;
    });

    expect(result.current.licenseStatus.type).toBe("success");
    expect(mockSetEntitlement).toHaveBeenCalledTimes(1); // not double-applied
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
