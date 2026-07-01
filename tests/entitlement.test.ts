// ===========================================
// ENTITLEMENT TESTS
// ===========================================
// Tests for lib/entitlement.ts (activateLicense, validateLicense,
// deactivateLicense, resolveVariantEntitlement) and store/entitlementStore.ts
// (isPackUnlocked, needsValidation, setEntitlement, markValidated,
// clearEntitlement). Covers BRAND.md compliance (subscription-only model).
// ===========================================
// DEPENDS ON: @/lib/entitlement, @/store/entitlementStore,
//             @/lib/langRegistry, @/lib/tauri (mocked)
// USED BY: CI / npm test
// ===========================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEntitlementStore, SUBSCRIPTION_GRACE_PERIOD_MS, isPackUnlocked, needsValidation } from "@/store/entitlementStore";
import { resolveVariantEntitlement, hasAddOn, CHECKOUT_URLS, PRICING, ERR_ACTIVATE_NETWORK, ERR_DEACTIVATE_NETWORK, ERR_ACTIVATION_FAILED, ERR_ACTIVATE_NO_INSTANCE, ERR_ACTIVATE_NO_VARIANT, ERR_ACTIVATE_NO_KEY, ERR_LICENSE_NOT_ACTIVE, ERR_VALIDATE_NETWORK, ERR_VALIDATE_NULL, ERR_VALIDATE_INACTIVE } from "@/lib/entitlement";
import { ALL_PACK_CODES, FREE_PACK_CODES } from "@/lib/langRegistry";

vi.mock("@/lib/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tauri")>();
  return { ...actual, invoke: vi.fn() };
});
import { invoke } from "@/lib/tauri";
import { activateLicense, validateLicense, deactivateLicense } from "@/lib/entitlement";
const mockInvoke = vi.mocked(invoke);

const store = () => useEntitlementStore.getState();

// STATE ONLY — action methods are excluded to prevent silent store corruption. See Task #055.
type EntitlementStateOnly = Pick<
  ReturnType<typeof useEntitlementStore.getState>,
  "licenseKey" | "instanceId" | "licenseType" | "unlockedPacks" | "purchasedAddOns" | "validUntil" | "lastValidated"
>;

function reset(overrides: Partial<EntitlementStateOnly> = {}) {
  useEntitlementStore.setState({
    licenseKey:    null,
    instanceId:    null,
    licenseType:   "free",
    unlockedPacks: [...FREE_PACK_CODES],
    purchasedAddOns: [],
    lastValidated: 0,
    validUntil:    null,
    ...overrides,
  });
}

beforeEach(() => reset());

// ── BRAND.md compliance — subscription-only model ─────────────────────────────
// These tests enforce BRAND.md: subscriptions are recurring-only; no permanent access purchases.

describe("BRAND.md compliance — subscription-only model", () => {
  it("CHECKOUT_URLS contains only an annual key (annual-only pricing)", () => {
    expect(Object.keys(CHECKOUT_URLS)).toEqual(["annual"]);
  });

  it("PRICING contains only an annual key (annual-only pricing)", () => {
    expect(Object.keys(PRICING)).toEqual(["annual"]);
  });

  it("resolveVariantEntitlement always returns subscription licenseType regardless of variant name", () => {
    const variantNames = ["Italian Lifetime", "All Languages Lifetime", "Monthly", "Annual", "Unknown Variant"];
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const name of variantNames) {
        expect(resolveVariantEntitlement(name, null).licenseType).toBe("subscription");
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("resolveVariantEntitlement('annual subscription', null) returns subscription licenseType", () => {
    const r = resolveVariantEntitlement("annual subscription", null);
    expect(r.licenseType).toBe("subscription");
  });
});

// ── isPackUnlocked ────────────────────────────────────────────────────────────

describe("isPackUnlocked()", () => {
  it("Italian always unlocked regardless of license tier", () => {
    expect(store().isPackUnlocked(FREE_PACK_CODES[0]!)).toBe(true);
  });

  it("paid pack locked for free user", () => {
    expect(store().isPackUnlocked(ALL_PACK_CODES.find(c => !FREE_PACK_CODES.includes(c)) ?? "es")).toBe(false);
  });

  it("subscription unlocks packs listed in unlockedPacks", () => {
    // ALL_PACK_CODES = ["it", "es"] after #077 removed fr/de/pt stubs — only check valid indices.
    reset({ licenseType: "subscription", unlockedPacks: [...ALL_PACK_CODES], validUntil: null });
    expect(store().isPackUnlocked(ALL_PACK_CODES[0]!)).toBe(true); // "it" — free, always unlocked
    expect(store().isPackUnlocked(ALL_PACK_CODES[1]!)).toBe(true); // "es" — unlocked via subscription
  });

  it("subscription does not unlock packs absent from unlockedPacks", () => {
    reset({ licenseType: "subscription", unlockedPacks: ALL_PACK_CODES.slice(0, 2), validUntil: null });
    expect(store().isPackUnlocked("de")).toBe(false);
  });

  it("active subscription (not expired) unlocks packs", () => {
    reset({
      licenseType:   "subscription",
      unlockedPacks: [...ALL_PACK_CODES],
      validUntil:    Date.now() + SUBSCRIPTION_GRACE_PERIOD_MS,
    });
    expect(store().isPackUnlocked(ALL_PACK_CODES[1]!)).toBe(true);
  });

  it("subscription 1 ms past expiry is still within 7-day grace", () => {
    reset({
      licenseType:   "subscription",
      unlockedPacks: ALL_PACK_CODES.slice(0, 2),
      validUntil:    Date.now() - 1,
    });
    expect(store().isPackUnlocked(ALL_PACK_CODES[1]!)).toBe(true);
  });

  it("subscription exactly at the edge of 7-day grace is still unlocked", () => {
    reset({
      licenseType:   "subscription",
      unlockedPacks: ALL_PACK_CODES.slice(0, 2),
      validUntil:    Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS + 1000,
    });
    expect(store().isPackUnlocked(ALL_PACK_CODES[1]!)).toBe(true);
  });

  it("subscription expired beyond 7-day grace locks packs", () => {
    reset({
      licenseType:   "subscription",
      unlockedPacks: ALL_PACK_CODES.slice(0, 2),
      validUntil:    Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1000,
    });
    expect(store().isPackUnlocked(ALL_PACK_CODES[1]!)).toBe(false);
  });

  it("subscription with null validUntil never expires", () => {
    reset({
      licenseType:   "subscription",
      unlockedPacks: ALL_PACK_CODES.slice(0, 2),
      validUntil:    null,
    });
    expect(store().isPackUnlocked(ALL_PACK_CODES[1]!)).toBe(true);
  });
});

// ── needsValidation ───────────────────────────────────────────────────────────

describe("needsValidation()", () => {
  it("free license never needs validation", () => {
    expect(store().needsValidation()).toBe(false);
  });

  it("subscription validated just now does not need validation", () => {
    reset({ licenseType: "subscription", lastValidated: Date.now() });
    expect(store().needsValidation()).toBe(false);
  });

  it("subscription validated 6 days ago does not need validation", () => {
    reset({ licenseType: "subscription", lastValidated: Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS + 60_000 });
    expect(store().needsValidation()).toBe(false);
  });

  it("subscription validated over 7 days ago needs validation", () => {
    reset({ licenseType: "subscription", lastValidated: Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1000 });
    expect(store().needsValidation()).toBe(true);
  });

  it("subscription never validated (lastValidated=0) needs validation", () => {
    reset({ licenseType: "subscription", lastValidated: 0 });
    expect(store().needsValidation()).toBe(true);
  });
});

// ── setEntitlement ────────────────────────────────────────────────────────────

describe("setEntitlement()", () => {
  it("sets all fields and records lastValidated as roughly now", () => {
    const before = Date.now();
    store().setEntitlement({
      licenseKey:    "ABCD-1234",
      instanceId:    "inst-abc",
      licenseType:   "subscription",
      unlockedPacks: ["it", "es"],
      validUntil:    null,
    });
    const s = store();
    expect(s.licenseKey).toBe("ABCD-1234");
    expect(s.instanceId).toBe("inst-abc");
    expect(s.licenseType).toBe("subscription");
    expect(s.unlockedPacks).toEqual(["it", "es"]);
    expect(s.validUntil).toBeNull();
    expect(s.lastValidated).toBeGreaterThanOrEqual(before);
  });
});

// ── markValidated ─────────────────────────────────────────────────────────────

describe("markValidated()", () => {
  it("updates lastValidated to roughly now", () => {
    const before = Date.now();
    store().markValidated(null);
    expect(store().lastValidated).toBeGreaterThanOrEqual(before);
  });

  it("updates validUntil", () => {
    const expiry = Date.now() + SUBSCRIPTION_GRACE_PERIOD_MS;
    store().markValidated(expiry);
    expect(store().validUntil).toBe(expiry);
  });
});

// ── touchValidated ────────────────────────────────────────────────────────────

describe("touchValidated()", () => {
  it("resets lastValidated without changing validUntil", () => {
    const originalValidUntil = Date.now() + 86400000;
    reset({ licenseType: "subscription", lastValidated: 0, validUntil: originalValidUntil });
    store().touchValidated();
    const s = store();
    expect(s.lastValidated).toBeGreaterThan(0);
    expect(s.validUntil).toBe(originalValidUntil);
  });
});

// ── clearEntitlement ──────────────────────────────────────────────────────────

describe("clearEntitlement()", () => {
  it("resets everything to free defaults", () => {
    reset({ licenseKey: "ABC", instanceId: "i1", licenseType: "subscription", unlockedPacks: ["it", "es"] });
    store().clearEntitlement();
    const s = store();
    expect(s.licenseKey).toBeNull();
    expect(s.instanceId).toBeNull();
    expect(s.licenseType).toBe("free");
    expect(s.unlockedPacks).toEqual([...FREE_PACK_CODES]);
    expect(s.lastValidated).toBe(0);
    expect(s.validUntil).toBeNull();
  });
});

// ── activateLicense — null safety ─────────────────────────────────────────────

describe("activateLicense — null safety", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("returns error when license_key is absent from API response", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true, error: null,
      instance: { id: "i1" }, meta: { variant_name: "Italian Lifetime" },
      // license_key intentionally absent — simulates LS error response shape
    });
    const r = await activateLicense("KEY");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_LICENSE_NOT_ACTIVE);
  });

  it("returns error when license_key.status is 'inactive'", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true, error: null,
      instance: { id: "i1" }, meta: { variant_name: "Italian Lifetime" },
      license_key: { status: "inactive", key: "K", expires_at: null },
    });
    const r = await activateLicense("INACTIVE");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_LICENSE_NOT_ACTIVE);
  });

  it("returns ERR_ACTIVATE_NETWORK when invoke returns null", async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const r = await activateLicense("KEY");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_ACTIVATE_NETWORK);
  });

  it("returns ok:false when invoke throws (network/IPC failure)", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC error"));
    const r = await activateLicense("KEY");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_ACTIVATE_NETWORK);
  });

  it("returns ok:false with fallback message when activated is false and res.error is null", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: false, error: null,
      license_key: { status: "inactive", key: "KEY-ABC", expires_at: null },
      instance: null, meta: null,
    });
    const r = await activateLicense("KEY-ABC");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_ACTIVATION_FAILED);
  });

  it("does not propagate raw LS error — returns ERR_ACTIVATION_FAILED instead (Task #089)", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: false, error: "internal LS API error with request details",
      license_key: null, instance: null, meta: null,
    });
    const r = await activateLicense("KEY-ABC");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).not.toContain("internal LS API error with request details");
    expect(r.error).toBe(ERR_ACTIVATION_FAILED);
  });

  it("returns ok:false when activation succeeds but instance is missing", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true, error: null,
      license_key: { status: "active", key: "KEY-ABC", expires_at: null },
      instance: null,
      meta: { variant_name: "Monthly Plan" },
    });
    const r = await activateLicense("KEY-ABC");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_ACTIVATE_NO_INSTANCE);
  });

  // S001: activateLicense ok:true path
  it("returns ok:true with all fields when activation succeeds", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true,
      error: null,
      instance: { id: "inst-123" },
      license_key: { status: "active", key: "KEY-ABC", expires_at: "2027-01-01T00:00:00Z" },
      meta: { variant_name: "Monthly Plan" },
    });
    const result = await activateLicense("KEY-ABC");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok:true");
    expect(result.licenseKey).toBe("KEY-ABC");
    expect(result.instanceId).toBe("inst-123");
    expect(result.licenseType).toBe("subscription");
    // Monthly Plan unlocks all packs — verify exact equality, not just containment
    expect(result.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    // V2: assert validUntil is a future timestamp, not just any Number
    expect(result.validUntil).toEqual(expect.any(Number));
    expect(result.validUntil!).toBeGreaterThan(Date.now());
  });

  // S014: activateLicense returns error when meta.variant_name is missing
  it("returns error when meta.variant_name is absent from activation response", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true,
      error: null,
      instance: { id: "inst-123" },
      license_key: { status: "active", key: "KEY-ABC", expires_at: null },
      meta: {}, // variant_name missing
    });
    const result = await activateLicense("KEY-ABC");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    expect(result.error).toBe(ERR_ACTIVATE_NO_VARIANT);
  });

  it("returns error when license_key.key is empty — prevents persisting an unusable key", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true,
      error: null,
      instance: { id: "inst-123" },
      meta: { variant_name: "Monthly Plan" },
      license_key: { status: "active", key: "", expires_at: null },
    });
    const result = await activateLicense("KEY-ABC");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    expect(result.error).toBe(ERR_ACTIVATE_NO_KEY);
  });
});

// ── validateLicense — null safety ─────────────────────────────────────────────

describe("validateLicense — null safety", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("returns ERR_LICENSE_NOT_ACTIVE when license_key is absent from validate response", async () => {
    mockInvoke.mockResolvedValueOnce({ valid: true, error: null }); // no license_key
    const r = await validateLicense("KEY", "INST");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_LICENSE_NOT_ACTIVE);
  });

  it("does not propagate raw LS error — returns ERR_VALIDATE_INACTIVE instead (Task #089)", async () => {
    mockInvoke.mockResolvedValueOnce({
      valid: false, error: "internal LS API error with request details",
      license_key: { status: "inactive", key: "K", expires_at: null },
    });
    const r = await validateLicense("KEY", "INST");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).not.toContain("internal LS API error with request details");
    expect(r.error).toBe(ERR_VALIDATE_INACTIVE);
  });

  it("returns ERR_VALIDATE_INACTIVE when LS returns valid:false with no error string", async () => {
    mockInvoke.mockResolvedValueOnce({
      valid: false, error: null,
      license_key: { status: "inactive", key: "K", expires_at: null },
    });
    const r = await validateLicense("KEY", "INST");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_VALIDATE_INACTIVE);
  });

  it("returns error when invoke returns null — regression guard for existing null check", async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const r = await validateLicense("KEY", "INST");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_VALIDATE_NULL);
  });

  it("returns ok:false when LS returns valid:true but license_key.status is not 'active'", async () => {
    mockInvoke.mockResolvedValueOnce({
      valid: true,
      error: null,
      license_key: { status: "expired", key: "KEY-ABC", expires_at: null },
    });
    const r = await validateLicense("KEY-ABC", "inst-1");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_LICENSE_NOT_ACTIVE);
  });

  it("returns ok:false when invoke throws (network/IPC failure)", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC error"));
    const r = await validateLicense("KEY", "INST");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_VALIDATE_NETWORK);
  });

  // S002: validateLicense ok:true path
  it("returns ok:true with validUntil in future when validation succeeds", async () => {
    mockInvoke.mockResolvedValueOnce({
      valid: true,
      error: null,
      license_key: { status: "active", key: "KEY-ABC", expires_at: "2027-01-01T00:00:00Z" },
    });
    const result = await validateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok:true");
    expect(result.validUntil).toEqual(expect.any(Number));
    expect(result.validUntil).not.toBeNull();
    expect(result.validUntil! > Date.now()).toBe(true);
  });

  it("returns ok:true with validUntil:null when expires_at is null", async () => {
    mockInvoke.mockResolvedValueOnce({
      valid: true,
      error: null,
      license_key: { status: "active", key: "KEY-ABC", expires_at: null },
    });
    const r = await validateLicense("KEY-ABC", "inst-1");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("Expected ok:true");
    expect(r.validUntil).toBeNull();
  });
});

// ── deactivateLicense ─────────────────────────────────────────────────────────

// S003: deactivateLicense tests
describe("deactivateLicense()", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("returns ok:false with a user-facing message when invoke throws", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC error"));
    const result = await deactivateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    // deactivateLicense returns a generic message — never the raw IPC error —
    // to prevent Tauri internals from reaching the UI. The IPC error is not
    // logged either (it may embed the license key via request params).
    expect(result.error).toBe(ERR_DEACTIVATE_NETWORK);
  });

  it("returns ok:false when invoke resolves to null (empty body guard)", async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const result = await deactivateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    expect(result.error).toBe(ERR_DEACTIVATE_NETWORK);
  });

  it("returns safe fallback — never leaks raw LS error containing key or instance info (Task #074)", async () => {
    // After Task #095: the Rust command returns Ok(true)/Err(msg) — no body is
    // parsed. A non-true invoke response (incl. objects with LS error text) hits
    // the raw !== true guard and returns a generic constant, never LS content.
    mockInvoke.mockResolvedValueOnce({ deactivated: false, error: "Instance not found for key XXXX-SECRET-KEY" });
    const result = await deactivateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    expect(result.error).not.toContain("XXXX");
    expect(result.error).toBe(ERR_DEACTIVATE_NETWORK);
  });

  it("returns ok:false with generic message for any non-boolean-true invoke response", async () => {
    mockInvoke.mockResolvedValueOnce({ deactivated: false, error: "License not found" });
    const result = await deactivateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    expect(result.error).toBe(ERR_DEACTIVATE_NETWORK);
  });

  it("returns ok:false for false-y non-null invoke response", async () => {
    mockInvoke.mockResolvedValueOnce({ deactivated: false, error: null });
    const r = await deactivateLicense("KEY-ABC", "inst-1");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_DEACTIVATE_NETWORK);
  });

  // Write-first test (Task #095): mocking boolean true simulates Tauri's serialisation of
  // Ok(true). Before the fix, true was cast to LsDeactivateBody where .deactivated is
  // undefined — returning ok:false. After the fix, raw !== true is false → ok:true.
  it("returns ok:true when invoke resolves to boolean true (Tauri Ok(true) serialisation)", async () => {
    mockInvoke.mockResolvedValueOnce(true);
    const result = await deactivateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when invoke resolves to boolean false — raw !== true guard covers this", async () => {
    // Tauri Err(msg) serialises as boolean false. This is distinct from null (empty body)
    // and from objects, but the raw !== true guard catches all three.
    mockInvoke.mockResolvedValueOnce(false);
    const result = await deactivateLicense("KEY-ABC", "inst-123");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected ok:false");
    expect(result.error).toBe(ERR_DEACTIVATE_NETWORK);
  });
});

// ── isPackUnlocked (pure function — W008) ────────────────────────────────────

describe("isPackUnlocked() — pure function", () => {
  it("free pack ('it') is always unlocked regardless of licenseType", () => {
    expect(isPackUnlocked({ licenseType: "free", unlockedPacks: [], validUntil: null }, "it")).toBe(true);
  });

  it("non-free pack ('es') is locked for free licenseType even if listed in unlockedPacks", () => {
    expect(isPackUnlocked({ licenseType: "free", unlockedPacks: ["es"], validUntil: null }, "es")).toBe(false);
  });

  it("subscription with null validUntil (no expiry) unlocks listed packs", () => {
    expect(isPackUnlocked({ licenseType: "subscription", unlockedPacks: ["es"], validUntil: null }, "es")).toBe(true);
  });

  it("subscription expired beyond 7-day grace locks packs", () => {
    expect(
      isPackUnlocked(
        { licenseType: "subscription", unlockedPacks: ["es"], validUntil: Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1 },
        "es"
      )
    ).toBe(false);
  });
});

// ── needsValidation (pure function — W008) ────────────────────────────────────

describe("needsValidation() — pure function", () => {
  it("free licenseType never needs validation", () => {
    expect(needsValidation({ licenseType: "free", lastValidated: 0 })).toBe(false);
  });

  it("subscription validated just now does not need validation", () => {
    expect(needsValidation({ licenseType: "subscription", lastValidated: Date.now() })).toBe(false);
  });

  it("subscription with lastValidated older than TTL needs validation", () => {
    expect(needsValidation({ licenseType: "subscription", lastValidated: Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1 })).toBe(true);
  });
});

// ── resolveVariantEntitlement ──────────────────────────────────────────────────────────────

describe("resolveVariantEntitlement — maps Lemon Squeezy variant names to entitlements", () => {
  // Legacy variant names — these were valid in a prior app version that supported one-time purchases.
  // These tests verify that legacy variant names are correctly coerced to "subscription" licenseType.
  // Lifetime variants are NOT a supported product configuration in the current app.
  it("'Italian Lifetime' variant → subscription licenseType, Italian pack only", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = resolveVariantEntitlement("Italian Lifetime", null);
      expect(r.licenseType).toBe("subscription");
      expect(r.unlockedPacks).toEqual([...FREE_PACK_CODES]);
      expect(r.validUntil).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("'All Languages Lifetime' variant → subscription licenseType, all packs", () => {
    const r = resolveVariantEntitlement("All Languages Lifetime", null);
    expect(r.licenseType).toBe("subscription");
    // S012: exact assertion on unlockedPacks for all-language variants
    expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    expect(r.validUntil).toBeNull();
  });

  it("'Monthly' → subscription license, all packs", () => {
    const r = resolveVariantEntitlement("Monthly", "2027-01-01T00:00:00.000Z");
    expect(r.licenseType).toBe("subscription");
    // S012: exact assertion — Monthly unlocks all packs
    expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    expect(r.validUntil).toBe(new Date("2027-01-01T00:00:00.000Z").getTime());
  });

  it("'Annual' → subscription license, all packs", () => {
    const r = resolveVariantEntitlement("Annual", "2027-01-01T00:00:00.000Z");
    expect(r.licenseType).toBe("subscription");
    // S012: exact assertion — Annual unlocks all packs
    expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  it("unknown variant name → subscription licenseType, free packs only", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = resolveVariantEntitlement("Something Unexpected", null);
      expect(r.licenseType).toBe("subscription");
      // S006: unknown variants fall back to free packs
      expect(r.unlockedPacks).toEqual([...FREE_PACK_CODES]);
    } finally {
      spy.mockRestore();
    }
  });

  it("variant name matching is case-insensitive", () => {
    expect(resolveVariantEntitlement("MONTHLY", null).licenseType).toBe("subscription");
    // S012: exact assertion for case-insensitive all-language match
    expect(resolveVariantEntitlement("all languages annual", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  // S006: resolveVariantEntitlement contract tests
  it("'Monthly' unlocks all packs (unlockedPacks equals ALL_PACK_CODES)", () => {
    expect(resolveVariantEntitlement("Monthly", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  it("'Annual' unlocks all packs (unlockedPacks equals ALL_PACK_CODES)", () => {
    expect(resolveVariantEntitlement("Annual", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  // S006: semiannual edge case — "semiannual".includes("annual") === true, so it matches annual rule.
  // This is intentional: semiannual is a paid plan and should unlock all packs.
  it("'semiannual' contains 'annual' as substring and therefore unlocks all packs", () => {
    expect(resolveVariantEntitlement("semiannual", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  // S005: NaN date handling
  it("resolveVariantEntitlement returns validUntil:null for a non-date string (not NaN)", () => {
    const r = resolveVariantEntitlement("Monthly Plan", "not-a-date");
    expect(r.validUntil).toBeNull();
  });

  it("resolveVariantEntitlement returns validUntil:null when expiresAt is null", () => {
    const r = resolveVariantEntitlement("Monthly Plan", null);
    expect(r.validUntil).toBeNull();
  });

  // W001: pin the exact LS variant name strings the constants capture.
  // If a constant is renamed without updating the LS variant, these fail.
  it("'Monthly Plan' (exact LS variant name) unlocks all packs", () => {
    expect(resolveVariantEntitlement("Monthly Plan", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  it("'Annual Subscription' (exact LS variant name) unlocks all packs", () => {
    expect(resolveVariantEntitlement("Annual Subscription", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  it("'All Languages Pack' (exact LS variant name) unlocks all packs", () => {
    expect(resolveVariantEntitlement("All Languages Pack", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  it("emits a warning log when variant name is not recognized", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      resolveVariantEntitlement("Something Unexpected", null);
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/ENTITLEMENT_VARIANT_UNKNOWN/),
        expect.objectContaining({ variantName: "Something Unexpected" })
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("does not emit a warning log for recognized variant names", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      resolveVariantEntitlement("Monthly Plan", null);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("variant names containing recognized substrings unlock all packs — substring matching is intentional for LS variant naming", () => {
    // "semiannual" contains "annual", "premonthly" contains "monthly" — both are valid paid plans
    // that may be created in Lemon Squeezy. LS variant names are developer-controlled.
    expect(resolveVariantEntitlement("Semiannual Plan", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    expect(resolveVariantEntitlement("Premonthly Trial", null).unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });
});

// ── Seam test: activateLicense → setEntitlement → isPackUnlocked ─────────────
// Rule 13: data crossing the lib/entitlement → store boundary must have an
// integration test that exercises the full call chain end-to-end.

describe("seam: activateLicense → setEntitlement → isPackUnlocked", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    reset();
  });

  it("activating a Monthly Plan and storing the result unlocks all packs via isPackUnlocked", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true,
      error: null,
      instance: { id: "inst-seam" },
      license_key: { status: "active", key: "KEY-SEAM", expires_at: null },
      meta: { variant_name: "Monthly Plan" },
    });

    const result = await activateLicense("KEY-SEAM");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok:true in seam test setup");

    store().setEntitlement({
      licenseKey:    result.licenseKey,
      instanceId:   result.instanceId,
      licenseType:  result.licenseType,
      unlockedPacks: result.unlockedPacks,
      validUntil:   result.validUntil,
    });

    // Every pack that activateLicense returned must now be unlocked in the store
    for (const packCode of result.unlockedPacks) {
      expect(store().isPackUnlocked(packCode)).toBe(true);
    }

    // Verify the chain produced ALL packs (Monthly Plan is all-access)
    expect(result.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
  });

  it("clearing entitlement after activation locks paid packs again", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true,
      error: null,
      instance: { id: "inst-seam2" },
      license_key: { status: "active", key: "KEY-SEAM2", expires_at: null },
      meta: { variant_name: "Annual" },
    });

    const result = await activateLicense("KEY-SEAM2");
    if (!result.ok) throw new Error("Expected ok:true in seam test setup");
    store().setEntitlement({
      licenseKey:    result.licenseKey,
      instanceId:   result.instanceId,
      licenseType:  result.licenseType,
      unlockedPacks: result.unlockedPacks,
      validUntil:   result.validUntil,
    });

    // Paid pack should be unlocked now
    const paidPack = ALL_PACK_CODES.find((c) => !FREE_PACK_CODES.includes(c));
    if (!paidPack) throw new Error("Test setup: no paid pack found in ALL_PACK_CODES");
    expect(store().isPackUnlocked(paidPack)).toBe(true);

    // After clearEntitlement the paid pack should be locked again
    store().clearEntitlement();
    expect(store().isPackUnlocked(paidPack)).toBe(false);
  });
});

// ── Seam test: deactivateLicense ok:true → clearEntitlement → pack locked ─────

describe("seam: deactivateLicense ok:true → clearEntitlement → pack locked", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    reset();
  });

  it("pack is locked after deactivateLicense ok:true and caller invokes clearEntitlement", async () => {
    // Step 1: activate to put store into subscription state with a paid pack unlocked
    const paidPack = ALL_PACK_CODES.find((c) => !FREE_PACK_CODES.includes(c));
    if (!paidPack) throw new Error("Test setup: no paid pack found in ALL_PACK_CODES");

    mockInvoke.mockResolvedValueOnce({
      activated: true,
      error: null,
      license_key: { status: "active", key: "SEAM-DEACT-KEY", expires_at: null },
      instance: { id: "seam-deact-inst" },
      meta: { variant_name: "Monthly Subscription" },
    });
    const activateResult = await activateLicense("SEAM-DEACT-KEY");
    if (!activateResult.ok) throw new Error("Expected ok:true in seam test setup");
    store().setEntitlement({
      licenseKey: activateResult.licenseKey,
      instanceId: activateResult.instanceId,
      licenseType: activateResult.licenseType,
      unlockedPacks: activateResult.unlockedPacks,
      validUntil: activateResult.validUntil,
    });
    expect(store().isPackUnlocked(paidPack)).toBe(true);

    // Step 2: deactivate returns ok:true (Tauri serialises Rust Ok(true) as boolean true)
    mockInvoke.mockResolvedValueOnce(true);
    const deactivateResult = await deactivateLicense("SEAM-DEACT-KEY", "seam-deact-inst");
    expect(deactivateResult.ok).toBe(true);

    // Step 3: caller (settings page) invokes clearEntitlement after ok:true
    store().clearEntitlement();

    // Step 4: paid pack must now be locked — the deactivation chain is complete
    expect(store().isPackUnlocked(paidPack)).toBe(false);
    expect(store().licenseType).toBe("free");
  });
});

// ── Seam test: validateLicense → markValidated → isPackUnlocked ──────────────
// Validates that the renewal path (validateLicense returning a new validUntil,
// markValidated storing it) correctly reflects in isPackUnlocked access decisions.

describe("seam: validateLicense → markValidated → isPackUnlocked", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    reset();
  });

  it("marks a pack locked after expiry, then unlocked again after successful validation", async () => {
    // Start: subscription with validUntil in the past (beyond grace period)
    const pastExpiry = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago — beyond grace period
    reset({
      licenseType: "subscription",
      licenseKey: "KEY-ABC",
      instanceId: "inst-1",
      unlockedPacks: [...ALL_PACK_CODES],
      validUntil: pastExpiry,
      lastValidated: 0,
    });

    // Pack should be locked — expired beyond grace period
    expect(store().isPackUnlocked("es")).toBe(false);

    // validateLicense returns a new validUntil in the future
    const futureExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    mockInvoke.mockResolvedValueOnce({
      valid: true,
      error: null,
      license_key: { status: "active", key: "KEY-ABC", expires_at: new Date(futureExpiry).toISOString() },
    });

    const r = await validateLicense("KEY-ABC", "inst-1");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("Expected ok:true");

    // Apply the new validUntil to the store (what EntitlementValidator does on ok:true)
    store().markValidated(r.validUntil);

    // Pack should now be unlocked
    expect(store().isPackUnlocked("es")).toBe(true);
  });
});

// ── purchasedAddOns / hasAddOn / purchaseAddOn ────────────────────────────────

describe("purchasedAddOns — add-on entitlement (Task #148)", () => {
  beforeEach(() => reset());

  it("purchasedAddOns defaults to []", () => {
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("hasAddOn store method returns false when code is not in purchasedAddOns", () => {
    expect(store().hasAddOn("it-medical")).toBe(false);
  });

  it("purchaseAddOn adds code to purchasedAddOns", () => {
    store().purchaseAddOn("it-medical");
    expect(store().purchasedAddOns).toContain("it-medical");
    expect(store().purchasedAddOns).toHaveLength(1);
  });

  it("hasAddOn store method returns true after purchaseAddOn", () => {
    store().purchaseAddOn("it-medical");
    expect(store().hasAddOn("it-medical")).toBe(true);
  });

  it("hasAddOn returns false for a different code after purchaseAddOn", () => {
    store().purchaseAddOn("it-medical");
    expect(store().hasAddOn("it-business")).toBe(false);
  });

  it("purchaseAddOn is idempotent — calling twice does not duplicate the code", () => {
    store().purchaseAddOn("it-medical");
    store().purchaseAddOn("it-medical");
    expect(store().purchasedAddOns).toEqual(["it-medical"]);
  });

  it("purchaseAddOn accumulates multiple distinct codes", () => {
    store().purchaseAddOn("it-medical");
    store().purchaseAddOn("it-business");
    expect(store().purchasedAddOns).toContain("it-medical");
    expect(store().purchasedAddOns).toContain("it-business");
    expect(store().purchasedAddOns).toHaveLength(2);
  });

  it("clearEntitlement resets purchasedAddOns to []", () => {
    store().purchaseAddOn("it-medical");
    expect(store().purchasedAddOns).toHaveLength(1);
    store().clearEntitlement();
    expect(store().purchasedAddOns).toEqual([]);
  });
});

// ── hasAddOn pure function (lib/entitlement.ts) ───────────────────────────────

describe("hasAddOn() — pure function (lib/entitlement.ts)", () => {
  it("returns false for empty purchasedAddOns", () => {
    expect(hasAddOn({ purchasedAddOns: [] }, "it-medical")).toBe(false);
  });

  it("returns true when code is in purchasedAddOns", () => {
    expect(hasAddOn({ purchasedAddOns: ["it-medical"] }, "it-medical")).toBe(true);
  });

  it("returns false for a different code not in purchasedAddOns", () => {
    expect(hasAddOn({ purchasedAddOns: ["it-medical"] }, "it-business")).toBe(false);
  });

  it("returns true for any entry in a populated array", () => {
    const state = { purchasedAddOns: ["it-medical", "it-business", "es-cooking"] };
    expect(hasAddOn(state, "es-cooking")).toBe(true);
    expect(hasAddOn(state, "it-medical")).toBe(true);
    expect(hasAddOn(state, "es-legal")).toBe(false);
  });
});
