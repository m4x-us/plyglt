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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { useEntitlementStore, SUBSCRIPTION_GRACE_PERIOD_MS, isPackUnlocked, needsValidation, _handleCrossTabStorageEvent, ERR_ADDON_INVALID_CODE, ERR_ADDON_RECEIPT_INVALID, ERR_ADDON_IPC_ERROR, ERR_ADDON_NOT_PRO } from "@/store/entitlementStore";
import type { PurchaseAddOnResult } from "@/store/entitlementStore";
import { resolveVariantEntitlement, hasAddOn, CHECKOUT_URLS, PRICING, ERR_ACTIVATE_NETWORK, ERR_DEACTIVATE_NETWORK, ERR_ACTIVATION_FAILED, ERR_ACTIVATE_NO_INSTANCE, ERR_ACTIVATE_NO_VARIANT, ERR_ACTIVATE_NO_KEY, ERR_LICENSE_NOT_ACTIVE, ERR_VALIDATE_NETWORK, ERR_VALIDATE_NULL, ERR_VALIDATE_INACTIVE } from "@/lib/entitlement";
import * as entitlementLib from "@/lib/entitlement";
import { ALL_PACK_CODES, FREE_PACK_CODES, isSpecialtyPackCode } from "@/lib/langRegistry";
import type { SpecialtyPack } from "@/lib/langRegistry";
import * as specialtyPackLoader from "@/lib/specialtyPackLoader";
import { memCache } from "@/lib/packCache";
import type { Pack, Manifest } from "@/lib/packTypes";

// ── localStorage + Web Crypto stubs (mirrors tests/packLoader.test.ts) ────────
// Needed only by the #326 storage-key-ordering integration test below, which drives a
// real loadPack/loadSpecialtyPack round trip through lib/packCache.ts's storage layer.
const localStorageStore: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem:    (key)        => localStorageStore[key] ?? null,
  setItem:    (key, value) => { localStorageStore[key] = value; },
  removeItem: (key)        => { delete localStorageStore[key]; },
  clear:      ()           => { for (const k in localStorageStore) delete localStorageStore[k]; },
  key:        (i)          => Object.keys(localStorageStore)[i] ?? null,
  get length()             { return Object.keys(localStorageStore).length; },
};
vi.stubGlobal("window", { localStorage: localStorageMock });
vi.stubGlobal("crypto", {
  subtle: {
    digest: async (_algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
      const hash = createHash("sha256").update(Buffer.from(data)).digest();
      return hash.buffer as ArrayBuffer;
    },
  },
});

vi.mock("@/lib/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tauri")>();
  return { ...actual, invoke: vi.fn() };
});
// mockSpecialtyPacksForClearEntitlement is mutated only by the #326 tests below and reset
// to [] in the global beforeEach — all other tests in this file run with SPECIALTY_PACKS=[]
// (the real production default) exactly as before this task.
const mockSpecialtyPacksForClearEntitlement = vi.hoisted<SpecialtyPack[]>(() => []);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: mockSpecialtyPacksForClearEntitlement,
    // Task #380 (mechanical, forced by the alias deletion): the registry-driven impl that
    // lived under the deleted isReadySpecialtyPackCode key now backs the canonical name —
    // same registry-driven default (falsy when the mock list is empty), still a vi.fn so
    // per-test mockReturnValue overrides keep working.
    isSpecialtyPackCode: vi.fn((s: string) => mockSpecialtyPacksForClearEntitlement.some(sp => sp.code === s && sp.ready)),
    // Task #407: isRegisteredSpecialtyCode closes over the module-scope SPECIALTY_PACKS
    // binding, not the exported one — override it here so clearEntitlement's
    // affectedBaseLangs computation uses this mock's list, same reasoning as isSpecialtyPackCode above.
    isRegisteredSpecialtyCode: (s: string) => mockSpecialtyPacksForClearEntitlement.some(sp => sp.code === s),
  };
});
vi.mock("@/lib/packLoader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/packLoader")>();
  return { ...actual, getLoadedAddOns: vi.fn(actual.getLoadedAddOns) };
});
import { invoke } from "@/lib/tauri";
import { loadPack, getLoadedAddOns } from "@/lib/packLoader";
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

beforeEach(() => {
  reset();
  mockSpecialtyPacksForClearEntitlement.length = 0;
  memCache.clear();
  localStorageMock.clear();
});

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
    const variantNames = ["Unrecognised Single", "Unrecognised All", "Monthly", "Annual", "Unknown Variant"];
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
  it("sets all fields including lastValidated exactly as passed by the caller", () => {
    // Task #430: setEntitlement no longer stamps Date.now() internally — the caller must
    // assert whether this data was just verified against the real license server. This is
    // a stop-the-line-relevant contract: an internal auto-stamp would grant a full grace
    // period to ANY caller, including an unsigned backup restore.
    const stamp = 1750000000000;
    store().setEntitlement({
      licenseKey:    "ABCD-1234",
      instanceId:    "inst-abc",
      licenseType:   "subscription",
      unlockedPacks: ["it", "es"],
      validUntil:    null,
      lastValidated: stamp,
    });
    const s = store();
    expect(s.licenseKey).toBe("ABCD-1234");
    expect(s.instanceId).toBe("inst-abc");
    expect(s.licenseType).toBe("subscription");
    expect(s.unlockedPacks).toEqual(["it", "es"]);
    expect(s.validUntil).toBeNull();
    expect(s.lastValidated).toBe(stamp);
  });

  it("#430: lastValidated:0 (unverified backup restore) makes needsValidation() true immediately", () => {
    store().setEntitlement({
      licenseKey:    "ABCD-1234",
      instanceId:    "inst-abc",
      licenseType:   "subscription",
      unlockedPacks: ["it", "es"],
      validUntil:    null,
      lastValidated: 0,
    });
    expect(store().needsValidation()).toBe(true);
  });

  it("#430: lastValidated:Date.now() (genuine activation) makes needsValidation() false", () => {
    store().setEntitlement({
      licenseKey:    "ABCD-1234",
      instanceId:    "inst-abc",
      licenseType:   "subscription",
      unlockedPacks: ["it", "es"],
      validUntil:    null,
      lastValidated: Date.now(),
    });
    expect(store().needsValidation()).toBe(false);
  });
});

// ── markValidated ─────────────────────────────────────────────────────────────

describe("markValidated()", () => {
  it("updates lastValidated to roughly now", () => {
    const before = Date.now();
    store().markValidated(null);
    // existence-check: lastValidated is set to Date.now() internally — genuinely non-deterministic.
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
    const before = Date.now();
    store().touchValidated();
    const s = store();
    // existence-check: lastValidated is set to Date.now() internally — genuinely non-deterministic.
    // Tightened from toBeGreaterThan(0) (proves only "reset happened at some point since epoch")
    // to toBeGreaterThanOrEqual(before) (proves the reset happened during this test, matching
    // the sibling assertions in setEntitlement()/markValidated() above).
    expect(s.lastValidated).toBeGreaterThanOrEqual(before);
    expect(s.validUntil).toBe(originalValidUntil);
  });
});

// ── clearEntitlement ──────────────────────────────────────────────────────────

describe("clearEntitlement()", () => {
  it("resets everything to free defaults", async () => {
    reset({ licenseKey: "ABC", instanceId: "i1", licenseType: "subscription", unlockedPacks: ["it", "es"] });
    // #397: clearEntitlement returns a Promise that rejects on eviction failure — always
    // await it in tests so a genuine failure surfaces as a test failure, not an
    // unhandled rejection. (Same at every call site in this file.)
    await store().clearEntitlement();
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
      instance: { id: "i1" }, meta: { variant_name: "Unknown Variant" },
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
      instance: { id: "i1" }, meta: { variant_name: "Unknown Variant" },
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

  it("redacts the license key when invoke throws — never logs the raw key or the raw error object (Batch 18)", async () => {
    // B7: pre-fix, this catch block logged the raw caught error (`console.error(tag, e)`),
    // which could embed the full license key via the IPC request params. This test fails if
    // that regresses — it asserts the log call's second argument is the redacted shape, not
    // an Error instance.
    mockInvoke.mockRejectedValueOnce(new Error("IPC error"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await activateLicense("ACTKEY-SECRET-1234");
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/ENTITLEMENT_ACTIVATE_FAIL/),
        { licenseKey: "ACTKEY-S...", errType: "Error" },
      );
      expect(spy.mock.calls[0]?.[1]).not.toBeInstanceOf(Error);
    } finally {
      spy.mockRestore();
    }
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

  // Task #183 F010: a degraded Lemon Squeezy response with instance:{id:''} is truthy but must not be
  // treated as a valid instance — Task #185's guard (`if (!res.instance?.id)`) must catch it.
  it("returns ok:false when instance is present but its id is an empty string", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true, error: null,
      license_key: { status: "active", key: "KEY-ABC", expires_at: null },
      instance: { id: "" },
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
    // expires_at is a fixed deterministic string — assert the exact parsed timestamp,
    // not just "some Number greater than now" (which passes even for the wrong value).
    expect(result.validUntil).toBe(1798761600000); // exact epoch for "2027-01-01T00:00:00Z" — not recomputed via new Date()
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

  // Task #236: type-confusion guard — `raw as LsActivateBody` is an unsafe cast; a degraded LS
  // response could return instance.id as a number. The truthiness-only check `!res.instance?.id`
  // passes for 123 (truthy), so the old guard would persist a numeric instanceId as a string.
  // The fixed guard adds `typeof res.instance.id !== "string"` to close this gap.
  it("returns ok:false when instance.id is a number, not a string (type-confusion guard)", async () => {
    mockInvoke.mockResolvedValueOnce({
      activated: true, error: null,
      license_key: { status: "active", key: "KEY-ABC", expires_at: null },
      instance: { id: 123 },
      meta: { variant_name: "Monthly Plan" },
    });
    const r = await activateLicense("KEY-ABC");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("Expected ok:false");
    expect(r.error).toBe(ERR_ACTIVATE_NO_INSTANCE);
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

  it("redacts the license key when invoke throws — never logs the raw key or the raw error object (Batch 18)", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC error"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await validateLicense("VALKEY-SECRET-5678", "INST");
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/ENTITLEMENT_VALIDATE_FAIL/),
        { licenseKey: "VALKEY-S...", errType: "Error" },
      );
      expect(spy.mock.calls[0]?.[1]).not.toBeInstanceOf(Error);
    } finally {
      spy.mockRestore();
    }
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
    // expires_at is a fixed deterministic string — assert the exact parsed timestamp.
    expect(result.validUntil).toBe(1798761600000); // exact epoch for "2027-01-01T00:00:00Z" — not recomputed via new Date()
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

  it("redacts the license key when invoke throws — closes the pre-existing gap where only the return value, never the actual log payload, was ever verified (Batch 18)", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC error"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await deactivateLicense("KEY-ABC", "inst-123");
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/ENTITLEMENT_DEACTIVATE_FAIL/),
        { licenseKey: "KEY-ABC...", errType: "Error" },
      );
    } finally {
      spy.mockRestore();
    }
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

  it("#386: an out-of-union licenseType fails closed — no paid access even for listed packs", () => {
    // Rule 17c regression guard: a corrupt persisted value outside the LicenseType union
    // must hit the explicit default branch and deny paid access. Before #386, it fell
    // through to unlockedPacks.some(...) and granted access with no defined policy.
    const corrupt = "lifetime" as unknown as import("@/lib/licenseTypes").LicenseType;
    expect(isPackUnlocked({ licenseType: corrupt, unlockedPacks: ["es"], validUntil: null }, "es")).toBe(false);
    // Free packs remain unlocked regardless — the free-pack check precedes the switch.
    expect(isPackUnlocked({ licenseType: corrupt, unlockedPacks: [], validUntil: null }, "it")).toBe(true);
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
  // This block covers both branches: variants that match a recognised substring
  // ("monthly" / "annual" / "all languages" — unlock ALL_PACK_CODES) and variants that
  // don't match anything — genuinely unrecognised, coerced to "subscription" licenseType
  // with free pack access only (the conservative fallback). Not every test in this block
  // unlocks only free packs — see the recognised "all languages" case below.
  it("unrecognised single-language variant → subscription licenseType, Italian pack only", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = resolveVariantEntitlement("Legacy Single Language", null);
      expect(r.licenseType).toBe("subscription");
      expect(r.unlockedPacks).toEqual([...FREE_PACK_CODES]);
      expect(r.validUntil).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("'All Languages Extended' variant → subscription licenseType, all packs (RECOGNISED: contains \"all languages\", not actually unrecognised)", () => {
    // "All Languages Extended".toLowerCase() contains the "all languages" substring rule
    // (lib/entitlement.ts:106), so this exercises the recognised branch, not the fallback —
    // it must NOT be described as an "unrecognised" variant.
    const r = resolveVariantEntitlement("All Languages Extended", null);
    expect(r.licenseType).toBe("subscription");
    expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    expect(r.validUntil).toBeNull();
  });

  it("genuinely unrecognised all-languages-shaped variant (\"Omnilinguistic Bundle\") → subscription licenseType, free packs only", () => {
    // Does not contain "monthly", "annual", or "all languages" — must hit the fallback,
    // unlike the "All Languages Extended" case above.
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = resolveVariantEntitlement("Omnilinguistic Bundle", null);
      expect(r.licenseType).toBe("subscription");
      expect(r.unlockedPacks).toEqual([...FREE_PACK_CODES]);
      expect(r.validUntil).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("'Monthly' → subscription license, all packs", () => {
    const r = resolveVariantEntitlement("Monthly", "2027-01-01T00:00:00.000Z");
    expect(r.licenseType).toBe("subscription");
    // S012: exact assertion — Monthly unlocks all packs
    expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    expect(r.validUntil).toBe(1798761600000); // exact epoch for "2027-01-01T00:00:00.000Z" — not recomputed via new Date()
  });

  it("'Annual' → subscription license, all packs", () => {
    const r = resolveVariantEntitlement("Annual", "2027-01-01T00:00:00.000Z");
    expect(r.licenseType).toBe("subscription");
    // S012: exact assertion — Annual unlocks all packs
    expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort());
    // Task #183 F011: all 3 output fields asserted — expiresAt is deterministic, assert the exact value.
    expect(r.validUntil).toBe(1798761600000); // exact epoch for "2027-01-01T00:00:00.000Z" — not recomputed via new Date()
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
      lastValidated: Date.now(),
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
      lastValidated: Date.now(),
    });

    // Paid pack should be unlocked now
    const paidPack = ALL_PACK_CODES.find((c) => !FREE_PACK_CODES.includes(c));
    if (!paidPack) throw new Error("Test setup: no paid pack found in ALL_PACK_CODES");
    expect(store().isPackUnlocked(paidPack)).toBe(true);

    // After clearEntitlement the paid pack should be locked again (#397: await — the
    // Promise rejects on eviction failure and must fail the test, not leak unhandled)
    await store().clearEntitlement();
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
      lastValidated: Date.now(),
    });
    expect(store().isPackUnlocked(paidPack)).toBe(true);

    // Step 2: deactivate returns ok:true (Tauri serialises Rust Ok(true) as boolean true)
    mockInvoke.mockResolvedValueOnce(true);
    const deactivateResult = await deactivateLicense("SEAM-DEACT-KEY", "seam-deact-inst");
    expect(deactivateResult.ok).toBe(true);

    // Step 3: caller (settings page) invokes clearEntitlement after ok:true
    // (#397: awaited so an eviction failure fails the test instead of leaking unhandled)
    await store().clearEntitlement();

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

describe("purchasedAddOns — add-on entitlement (Task #148, #287, #285)", () => {
  beforeEach(() => {
    // purchaseAddOn requires a Pro subscription — store-level isProEnabled gate (#388).
    // Set subscription so happy-path and IPC-level tests reach the intended code paths.
    reset({ licenseType: "subscription", validUntil: null });
    vi.clearAllMocks();
    // Task #427: specialtyPacks now defaults OFF unless NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS is
    // explicitly truthy — purchaseAddOn's isProEnabled gate rejects with ERR_ADDON_NOT_PRO
    // before reaching any guard below unless the flag is stubbed on.
    vi.stubEnv("NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS", "true");
    // Tasks #287 + #285: isSpecialtyPackCode is always-false in production (SPECIALTY_PACKS is
    // frozen with ready:false entries). Mock it to return true so the code-validation guard
    // passes in happy-path tests; individual #287 tests override to false to exercise the
    // rejection path.
    vi.mocked(isSpecialtyPackCode).mockReturnValue(true);
    // Task #285: mock invoke to simulate Tauri IPC returning a verified receipt by default.
    mockInvoke.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("purchasedAddOns defaults to []", () => {
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("hasAddOn store method returns false when code is not in purchasedAddOns", () => {
    expect(store().hasAddOn("it-medical")).toBe(false);
  });

  it("hasAddOn store action delegates to lib/entitlement.ts hasAddOn — spy proves the call", () => {
    // Task #300: the action is hasAddOn: (code) => libHasAddOn(get(), code).
    // Behavioral tests alone can't distinguish delegation from inline reimplementation.
    // This spy confirms the actual lib function is invoked with the current store state.
    const spy = vi.spyOn(entitlementLib, "hasAddOn");
    store().hasAddOn("it-medical");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ purchasedAddOns: [] }),
      "it-medical"
    );
    spy.mockRestore();
  });

  it("purchaseAddOn adds code to purchasedAddOns and returns ok:true", async () => {
    const result: PurchaseAddOnResult = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(result).toEqual({ ok: true });
    expect(store().purchasedAddOns).toContain("it-medical");
    expect(store().purchasedAddOns).toHaveLength(1);
  });

  it("hasAddOn store method returns true after purchaseAddOn", async () => {
    await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(store().hasAddOn("it-medical")).toBe(true);
  });

  it("hasAddOn returns false for a different code after purchaseAddOn", async () => {
    await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(store().hasAddOn("it-business")).toBe(false);
  });

  it("purchaseAddOn is idempotent — calling twice does not duplicate the code", async () => {
    await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(store().purchasedAddOns).toEqual(["it-medical"]);
  });

  it("purchaseAddOn accumulates multiple distinct codes", async () => {
    await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    await store().purchaseAddOn("it-business", "RECEIPT_TOKEN");
    expect(store().purchasedAddOns).toContain("it-medical");
    expect(store().purchasedAddOns).toContain("it-business");
    expect(store().purchasedAddOns).toHaveLength(2);
  });

  it("clearEntitlement resets purchasedAddOns to []", async () => {
    await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(store().purchasedAddOns).toHaveLength(1);
    await store().clearEntitlement(); // #397: rejects on eviction failure — must not leak unhandled
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("#263: clearEntitlement calls resetSpecialtyLoadState to prune in-memory add-on state", async () => {
    // Without this fix, clearEntitlement only zeros purchasedAddOns in the Zustand store
    // but never clears loadedAddOns in specialtyPackLoader — specialty content merged into
    // memCache remains accessible for the rest of the session after a license deactivation.
    // Task #326: resetSpecialtyLoadState() (formerly clearSpecialtyCache, renamed #385) now
    // runs after the memCache eviction Promise settles (not synchronously) so that
    // eviction's own storage-key pruning can still see the bookkeeping — this test must
    // await clearEntitlement() to observe that call.
    const spy = vi.spyOn(specialtyPackLoader, "resetSpecialtyLoadState");
    await store().clearEntitlement();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("#326: clearEntitlement evicts merged specialty content from memCache, not just bookkeeping", async () => {
    // Before this fix, resetSpecialtyLoadState() (proven above) only reset loadedAddOns/inFlight
    // bookkeeping — the actual merged pack (base units + specialty units) remained in
    // memCache["it"], fully accessible via loadPack's memory-cache-hit fast path for the
    // rest of the session. Deleting the eviction loop this test proves would leave
    // memCache.has("it") true after clearEntitlement, and this test would fail.
    mockSpecialtyPacksForClearEntitlement.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    const mergedPack: Pack = {
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
      unitCount: 1, cardCount: 1, units: [],
    };
    memCache.write("it", mergedPack);
    vi.mocked(getLoadedAddOns).mockReturnValueOnce(["it-medical"]);

    expect(memCache.has("it")).toBe(true); // sanity check: merged pack is present before the fix runs

    await store().clearEntitlement();

    expect(memCache.has("it")).toBe(false);
  });

  it("#438: entitlement state does not flip to 'free' until eviction has fully settled — no window where state and cache disagree", async () => {
    // Before #438, the state-reset set() ran as the first two statements in
    // clearEntitlement's body — licenseType flipped to "free" synchronously, before the
    // memCache/storage eviction Promise.all had even started its async work. Any external
    // observer reading store state during that window saw "free" while memCache still held
    // the previously-merged specialty content. clearEntitlement's own function body has no
    // await, so control returns to the caller before ANY .then() callback runs — checking
    // synchronously right after the call (before awaiting) deterministically observes
    // whatever ran BEFORE the async eviction, with no artificial delay needed.
    reset({ licenseKey: "ABC", instanceId: "i1", licenseType: "subscription", unlockedPacks: ["it", "es"] });
    mockSpecialtyPacksForClearEntitlement.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    const mergedPack: Pack = {
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
      unitCount: 1, cardCount: 1, units: [],
    };
    memCache.write("it", mergedPack);
    vi.mocked(getLoadedAddOns).mockReturnValueOnce(["it-medical"]);

    const promise = store().clearEntitlement();

    // Still the pre-deactivation state — eviction has not yet settled.
    expect(store().licenseType).toBe("subscription");
    expect(store().licenseKey).toBe("ABC");
    expect(store().unlockedPacks).toEqual(["it", "es"]);

    await promise;

    expect(store().licenseType).toBe("free");
    expect(store().licenseKey).toBeNull();
    expect(memCache.has("it")).toBe(false);
  });

  it("#326: clearEntitlement is a no-op on memCache when no specialty content was ever merged", async () => {
    // Regression guard for the common case: a user with no specialty purchases deactivating
    // should not have their base pack evicted from memCache — only affected base languages
    // (per getLoadedAddOns) are targeted.
    const basePack: Pack = {
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
      unitCount: 1, cardCount: 1, units: [],
    };
    memCache.write("it", basePack);
    vi.mocked(getLoadedAddOns).mockReturnValueOnce([]);

    await store().clearEntitlement();

    expect(memCache.has("it")).toBe(true);
  });

  it("#326: clearEntitlement clears a merged specialty pack's own storage keys too, not just memCache", async () => {
    // Regression guard for an ordering bug caught in review: clearEntitlement must call
    // evictPack() (which internally prunes specialty storage keys via
    // clearSpecialtyPacksForLang) BEFORE resetSpecialtyLoadState() zeroes the loadedAddOns
    // array that lookup depends on. Reordering those two calls makes
    // clearSpecialtyPacksForLang find nothing to prune, and this test's second assertion
    // fails while memCache eviction (already proven above) still passes — the two
    // guarantees are independent and both must hold.
    mockSpecialtyPacksForClearEntitlement.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    // Task #380 (mechanical): this end-to-end test routes REAL loadPack calls through the
    // canonical isSpecialtyPackCode, which the describe-level beforeEach blankets to true
    // for the purchase-gate tests — a blanket true sends the BASE "it" load down the
    // specialty branch. Restore the registry-driven behavior for this test only.
    vi.mocked(isSpecialtyPackCode).mockImplementation(
      (s: string) => mockSpecialtyPacksForClearEntitlement.some(sp => sp.code === s && sp.ready)
    );

    // unitCount/cardCount must match units.length (Task #418 cross-checks this).
    const basePackJson = JSON.stringify({
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
      unitCount: 0, cardCount: 0, units: [],
    } satisfies Pack);
    const addOnPackJson = JSON.stringify({
      _version: 1, lang: "it-medical", packVersion: "1.0.0", canonicalSource: "en",
      name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹",
      unitCount: 0, cardCount: 0, units: [],
    } satisfies Pack);
    const baseSha = createHash("sha256").update(basePackJson).digest("hex");
    const addOnSha = createHash("sha256").update(addOnPackJson).digest("hex");
    const manifest: Manifest = {
      _version: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      packs: {
        it:          { name: "Italian",        nativeName: "Italiano",        flag: "🇮🇹", version: "1.0.0", size: basePackJson.length, sha256: baseSha },
        "it-medical": { name: "Medical Italian", nativeName: "Italiano Medico", flag: "🇮🇹", version: "1.0.0", size: addOnPackJson.length, sha256: addOnSha },
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => (url.includes("it-medical") ? addOnPackJson : basePackJson),
    })));

    // Real end-to-end merge: base pack loads and caches, then the specialty add-on merges
    // into it and persists its own pack-meta-v1-it-medical / pack-data-v1-it-medical keys.
    await loadPack("it", manifest);
    const addOnResult = await loadPack("it-medical", manifest, { purchasedAddOns: ["it-medical"] });
    expect(addOnResult.ok).toBe(true);
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBe(addOnPackJson);
    const cachedMeta = JSON.parse(localStorageMock.getItem("pack-meta-v1-it-medical")!) as { sha256: string };
    expect(cachedMeta.sha256).toBe(addOnSha);

    await store().clearEntitlement();

    expect(memCache.has("it")).toBe(false);
    expect(localStorageMock.getItem("pack-meta-v1-it-medical")).toBeNull();
    expect(localStorageMock.getItem("pack-data-v1-it-medical")).toBeNull();
  });

  it("#415: clearEntitlement's promise rejects when evictPack reports a storage residue (fullyClean:false) — the former dead .catch is now a live .then check", async () => {
    // Before #415, evictPack could never reject (lib/packCache.ts's clearPackCache
    // swallows every storage failure via Promise.allSettled), so this exact scenario —
    // a real storage removeItem failure during eviction — silently resolved
    // clearEntitlement's Promise as if nothing had gone wrong. The evictionErrors/throw
    // chain and useLicenseActivation.ts's "Deactivated. Restart the app..." message were
    // unreachable dead code. This drives a REAL evictPack → clearPackCache → storage
    // failure end-to-end and proves the chain is live.
    reset({ licenseKey: "ABC", instanceId: "i1", licenseType: "subscription", unlockedPacks: ["it", "es"] });
    mockSpecialtyPacksForClearEntitlement.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    const mergedPack: Pack = {
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      name: "Italian", nativeName: "Italiano", flag: "🇮🇹",
      unitCount: 1, cardCount: 1, units: [],
    };
    memCache.write("it", mergedPack);
    vi.mocked(getLoadedAddOns).mockReturnValueOnce(["it-medical"]);

    const removeItemSpy = vi.spyOn(localStorageMock, "removeItem").mockImplementation(() => {
      throw new Error("storage removeItem failed");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(store().clearEntitlement()).rejects.toThrow("ERR-CLEAR-ENTITLEMENT-INCOMPLETE");
      const logged = errorSpy.mock.calls.map(args => String(args[0]));
      expect(logged.some(m => m.includes("ERR-CLEAR-ENTITLEMENT-EVICT-it") && m.includes("storage residue"))).toBe(true);
    } finally {
      removeItemSpy.mockRestore();
      errorSpy.mockRestore();
    }
    // The license state IS reset regardless — the state-reset set() (Task #438: now runs
    // after eviction settles, in the .then() below) still runs before the throw check.
    expect(store().licenseType).toBe("free");
    // memCache is still cleared despite the storage-layer failure (memCache.delete() is
    // unconditional inside clearPackCache — only the persisted-storage removal failed).
    expect(memCache.has("it")).toBe(false);
  });

  // ── Task #287: code-argument validation ──────────────────────────────────────

  it("#287: purchaseAddOn rejects an unregistered code and returns invalid_code", async () => {
    vi.mocked(isSpecialtyPackCode).mockReturnValueOnce(false);
    const result = await store().purchaseAddOn("not-a-real-code", "RECEIPT_TOKEN");
    expect(result).toEqual({ ok: false, error: ERR_ADDON_INVALID_CODE });
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("#287: purchaseAddOn does not call invoke when the code is invalid", async () => {
    vi.mocked(isSpecialtyPackCode).mockReturnValueOnce(false);
    await store().purchaseAddOn("garbage-code", "RECEIPT_TOKEN");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  // ── Task #285: receipt/payment verification ───────────────────────────────────

  it("#285: purchaseAddOn returns receipt_invalid when invoke returns null (web/browser mode)", async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const result = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(result).toEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("#285: purchaseAddOn returns receipt_invalid when invoke returns false", async () => {
    mockInvoke.mockResolvedValueOnce(false);
    const result = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(result).toEqual({ ok: false, error: ERR_ADDON_RECEIPT_INVALID });
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("#285: purchaseAddOn returns ipc_error when invoke throws", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC timeout"));
    const result = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(result).toEqual({ ok: false, error: ERR_ADDON_IPC_ERROR });
    expect(store().purchasedAddOns).toEqual([]);
  });

  it("#285: purchaseAddOn calls verify_addon_receipt with the correct code and receiptToken", async () => {
    await store().purchaseAddOn("it-medical", "tok_abc123");
    expect(mockInvoke).toHaveBeenCalledWith("verify_addon_receipt", { code: "it-medical", receiptToken: "tok_abc123" });
  });

  // ── Tasks #357/#388/#395: store-level Pro gate ──────────────────────────────
  // Specialty packs are add-ons within the Pro tier (BRAND.md). The gate lives in the
  // store action — not only the UI — so a direct devtools call cannot bypass it.

  it("#388: purchaseAddOn returns not_pro for a free-tier user and persists nothing", async () => {
    reset({ licenseType: "free" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
      expect(result).toEqual({ ok: false, error: ERR_ADDON_NOT_PRO });
      expect(store().purchasedAddOns).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("#388: purchaseAddOn never reaches the IPC boundary for a free-tier user", async () => {
    reset({ licenseType: "free" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
      expect(mockInvoke).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("#388: an unregistered code is rejected as invalid_code even for a free user — code guard precedes the Pro gate", async () => {
    reset({ licenseType: "free" });
    vi.mocked(isSpecialtyPackCode).mockReturnValueOnce(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await store().purchaseAddOn("garbage-code", "RECEIPT_TOKEN");
      expect(result).toEqual({ ok: false, error: ERR_ADDON_INVALID_CODE });
    } finally {
      warnSpy.mockRestore();
    }
  });

  // ── Task #420: isProEnabled became expiry-aware ───────────────────────────────
  it("#420: purchaseAddOn returns not_pro for a subscription past validUntil + grace period, even with licenseType still \"subscription\"", async () => {
    // Before #420, isProEnabled never checked expiry — a lapsed subscriber who never
    // manually deactivated stayed Pro-gated-in indefinitely here, while isPackUnlocked
    // already correctly locked their paid base packs on the same expiry condition.
    reset({ licenseType: "subscription", validUntil: Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
      expect(result).toEqual({ ok: false, error: ERR_ADDON_NOT_PRO });
      expect(store().purchasedAddOns).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("#420: purchaseAddOn still succeeds for a subscription within the grace period past validUntil", async () => {
    reset({ licenseType: "subscription", validUntil: Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS + 60_000 });
    const result = await store().purchaseAddOn("it-medical", "RECEIPT_TOKEN");
    expect(result).toEqual({ ok: true });
  });
});

// ── Seam test: purchaseAddOn → purchasedAddOns → hasAddOn (#284) ─────────────
// Mirrors the activateLicense → setEntitlement → isPackUnlocked seam: calls the
// real purchaseAddOn through the Tauri IPC mock, then verifies both the store's
// purchasedAddOns state and the hasAddOn read path (store method + pure function).

describe("seam: purchaseAddOn → purchasedAddOns → hasAddOn (#284)", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // purchaseAddOn requires a Pro subscription (store-level gate, #388) — set subscription.
    reset({ licenseType: "subscription", validUntil: null });
    vi.clearAllMocks();
    // Task #427: specialtyPacks now defaults OFF unless the env var is explicitly truthy.
    vi.stubEnv("NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS", "true");
    vi.mocked(isSpecialtyPackCode).mockReturnValue(true);
    mockInvoke.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("purchasing an add-on updates purchasedAddOns and makes hasAddOn return true end-to-end", async () => {
    const result: PurchaseAddOnResult = await store().purchaseAddOn("it-medical", "tok_seam_receipt");

    // Step 1: purchaseAddOn returns ok:true
    expect(result).toEqual({ ok: true });

    // Step 2: the code was validated through the specialty-pack registry (#315)
    // — deleting purchaseAddOn's isSpecialtyPackCode branch makes this assertion fail
    expect(vi.mocked(isSpecialtyPackCode)).toHaveBeenCalledWith("it-medical");

    // Step 3: the receipt was verified via Tauri IPC (#314)
    // — deleting purchaseAddOn's receipt-verification block makes this assertion fail
    expect(mockInvoke).toHaveBeenCalledWith("verify_addon_receipt", { code: "it-medical", receiptToken: "tok_seam_receipt" });

    // Step 4: purchasedAddOns in the store reflects the purchase
    expect(store().purchasedAddOns).toContain("it-medical");
    expect(store().purchasedAddOns).toHaveLength(1);

    // Step 5: store method hasAddOn returns true for the purchased code
    expect(store().hasAddOn("it-medical")).toBe(true);

    // Step 6: lib/entitlement.ts pure function hasAddOn also returns true (the read seam)
    expect(hasAddOn(store(), "it-medical")).toBe(true);

    // Step 7: an un-purchased code remains inaccessible via both read paths
    expect(store().hasAddOn("it-business")).toBe(false);
    expect(hasAddOn(store(), "it-business")).toBe(false);
  });

  it("clearing entitlement after a purchase removes the add-on via hasAddOn", async () => {
    await store().purchaseAddOn("it-medical", "tok_seam_receipt");
    expect(store().hasAddOn("it-medical")).toBe(true);

    await store().clearEntitlement(); // #397: rejects on eviction failure — must not leak unhandled

    expect(store().purchasedAddOns).toEqual([]);
    expect(store().hasAddOn("it-medical")).toBe(false);
    expect(hasAddOn(store(), "it-medical")).toBe(false);
  });
});

// ── cross-tab sync handler (#288) ────────────────────────────────────────────

describe("cross-tab sync — _handleCrossTabStorageEvent (#288)", () => {
  it("#288: handler calls rehydrate when key matches the entitlement store key", () => {
    // Zustand persist writes the in-memory snapshot to localStorage without reading the
    // current on-disk value first. Two tabs racing on purchaseAddOn for different codes
    // cause the second write to drop the first tab's purchase. The storage event handler
    // re-hydrates from disk so the next write starts from the merged on-disk state.
    const spy = vi.spyOn(useEntitlementStore.persist, "rehydrate").mockResolvedValue(undefined);
    _handleCrossTabStorageEvent({ key: "entitlement-v1" });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("#288: handler does not call rehydrate when key does not match the entitlement store key", () => {
    const spy = vi.spyOn(useEntitlementStore.persist, "rehydrate").mockResolvedValue(undefined);
    _handleCrossTabStorageEvent({ key: "some-other-store" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("#288: handler does not call rehydrate when key is null", () => {
    const spy = vi.spyOn(useEntitlementStore.persist, "rehydrate").mockResolvedValue(undefined);
    _handleCrossTabStorageEvent({ key: null });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
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
