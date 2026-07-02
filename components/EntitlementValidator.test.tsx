// ===========================================
// ENTITLEMENT VALIDATOR COMPONENT TESTS
// ===========================================
// Co-located tests for EntitlementValidator.tsx.
// Tests runEntitlementValidation() — the extracted effect logic — directly,
// without needing a DOM environment. The component itself is a thin wrapper
// that calls runEntitlementValidation(useEntitlementStore.getState) on mount.
// ===========================================
// DEPENDS ON: vitest, @/lib/entitlement, @/store/entitlementStore,
//             @/components/EntitlementValidator (runEntitlementValidation)
// USED BY: CI / npm test
// ===========================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEntitlementStore, SUBSCRIPTION_GRACE_PERIOD_MS } from "@/store/entitlementStore";
import { FREE_PACK_CODES } from "@/lib/langRegistry";

// useEffect runs synchronously in the node test environment so render() can
// exercise the component without a DOM. This replaces useEffect with immediate
// invocation — the only behavior change is timing (no browser paint cycle).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useEffect: (fn: () => void) => { fn(); } };
});

import { runEntitlementValidation, EntitlementValidator } from "./EntitlementValidator";

// Mock validateLicense — we control what it resolves/rejects to
vi.mock("@/lib/entitlement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/entitlement")>();
  return { ...actual, validateLicense: vi.fn() };
});

// UpdateChecker is an invisible sibling mounted by EntitlementValidator.
// Stub it out so these tests stay focused on validation logic only.
vi.mock("@/components/UpdateChecker", () => ({
  UpdateChecker: () => null,
}));
import { validateLicense } from "@/lib/entitlement";
const mockValidateLicense = vi.mocked(validateLicense);

function resetStore(overrides: Partial<ReturnType<typeof useEntitlementStore.getState>> = {}) {
  useEntitlementStore.setState({
    licenseKey: null,
    instanceId: null,
    licenseType: "free",
    unlockedPacks: [...FREE_PACK_CODES],
    lastValidated: 0,
    validUntil: null,
    ...overrides,
  });
}

beforeEach(() => {
  resetStore();
  mockValidateLicense.mockReset();
});

describe("EntitlementValidator", () => {
  // Test 1: half-initialized state (licenseKey present but instanceId null) skips validation
  it("does not call validateLicense when licenseKey is present but instanceId is null", async () => {
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: null, // half-initialized — e.g., store restored from backup without instanceId
      lastValidated: 0,
    });

    await runEntitlementValidation(useEntitlementStore.getState);

    expect(mockValidateLicense).not.toHaveBeenCalled();
  });

  // Test 2: calls validateLicense when needsValidation() is true and keys are present
  it("calls validateLicense when needsValidation() returns true and licenseKey/instanceId are present", async () => {
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-123",
      lastValidated: 0, // triggers needsValidation()
      validUntil: null,
    });
    mockValidateLicense.mockResolvedValue({ ok: true, validUntil: null });

    await runEntitlementValidation(useEntitlementStore.getState);

    expect(mockValidateLicense).toHaveBeenCalledWith("KEY-ABC", "inst-123");
  });

  // Test 3: does NOT call validateLicense when needsValidation() returns false
  it("does not call validateLicense when needsValidation() returns false", async () => {
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-123",
      lastValidated: Date.now(), // validated just now
      validUntil: null,
    });

    await runEntitlementValidation(useEntitlementStore.getState);

    expect(mockValidateLicense).not.toHaveBeenCalled();
  });

  // Test 4: does NOT call validateLicense for free license type
  it("does not call validateLicense when licenseType is free", async () => {
    resetStore({ licenseType: "free" });

    await runEntitlementValidation(useEntitlementStore.getState);

    expect(mockValidateLicense).not.toHaveBeenCalled();
  });

  // Test 5: handles validateLicense rejection without crashing, and still resets TTL
  it("handles validateLicense rejection without crashing and updates lastValidated", async () => {
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-123",
      lastValidated: 0,
      validUntil: null,
    });
    mockValidateLicense.mockRejectedValue(new Error("Network error"));

    await expect(runEntitlementValidation(useEntitlementStore.getState)).resolves.not.toThrow();
    expect(mockValidateLicense).toHaveBeenCalledTimes(1);
    // touchValidated() must fire in the catch path — prevents hammering on every mount
    expect(useEntitlementStore.getState().lastValidated).toBeGreaterThan(0);
  });

  // Test 6: calls markValidated with validUntil on successful validation
  it("calls markValidated with validUntil from validateLicense response", async () => {
    const expiry = Date.now() + SUBSCRIPTION_GRACE_PERIOD_MS;
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-123",
      lastValidated: 0,
    });
    mockValidateLicense.mockResolvedValue({ ok: true, validUntil: expiry });

    await runEntitlementValidation(useEntitlementStore.getState);

    expect(useEntitlementStore.getState().validUntil).toBe(expiry);
  });

  // Test 7: on ok:false, touchValidated is called so needsValidation() returns false
  // until the next TTL window — prevents hammering the LS API on every mount during
  // a network outage.
  it("updates lastValidated (via touchValidated) on validation failure — prevents repeated calls", async () => {
    const originalValidUntil = Date.now() + SUBSCRIPTION_GRACE_PERIOD_MS;
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-123",
      lastValidated: 0,
      validUntil: originalValidUntil,
    });
    mockValidateLicense.mockResolvedValue({ ok: false, error: "License revoked." });

    await runEntitlementValidation(useEntitlementStore.getState);

    const state = useEntitlementStore.getState();
    expect(state.lastValidated).toBeGreaterThan(0);   // TTL reset — no hammering
    expect(state.validUntil).toBe(originalValidUntil); // expiry preserved — not wiped on failure
  });

  // Task #054 — render-based mount test: verify that rendering <EntitlementValidator/>
  // (not calling runEntitlementValidation directly) triggers validation through the store.
  // useEffect is mocked to run synchronously (see vi.mock("react") above).
  describe("render-based mount wiring (Task #054)", () => {
    afterEach(() => vi.restoreAllMocks());

    it("render(<EntitlementValidator/>) mounts UpdateChecker as its invisible child (no DOM output)", () => {
      const result = EntitlementValidator();
      // EntitlementValidator now renders <UpdateChecker /> (stubbed to null in this file).
      // The returned element is non-null but produces no visible DOM output.
      expect(result).not.toBeNull();
    });

    it("render(<EntitlementValidator/>) with subscription license triggers validateLicense via store getter", async () => {
      resetStore({
        licenseType: "subscription",
        licenseKey: "RENDER-KEY",
        instanceId: "render-inst",
        lastValidated: 0,
      });
      mockValidateLicense.mockResolvedValue({ ok: true, validUntil: null });

      // Calling the component (useEffect runs synchronously via vi.mock) is the render().
      EntitlementValidator();
      await Promise.resolve(); // settle the async chain inside runEntitlementValidation

      // If the component correctly passes useEntitlementStore.getState to runEntitlementValidation,
      // it will read licenseKey/instanceId from the store and call validateLicense.
      expect(mockValidateLicense).toHaveBeenCalledExactlyOnceWith("RENDER-KEY", "render-inst");
    });

    it("render(<EntitlementValidator/>) with free license does NOT trigger validateLicense", () => {
      resetStore({ licenseType: "free", licenseKey: null, instanceId: null });

      EntitlementValidator();

      expect(mockValidateLicense).not.toHaveBeenCalled();
    });
  });

  it("logs a warning when validateLicense returns ok:false", async () => {
    resetStore({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-123",
      lastValidated: 0,
    });
    mockValidateLicense.mockResolvedValueOnce({ ok: false, error: "Subscription expired." });

    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await runEntitlementValidation(useEntitlementStore.getState);
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/ENTITLEMENT_VALIDATOR_VALIDATE_FAIL/),
        "Subscription expired."
      );
    } finally {
      spy.mockRestore();
    }
  });
});
