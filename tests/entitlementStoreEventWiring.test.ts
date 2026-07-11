// @vitest-environment jsdom
// Tests the real window.addEventListener('storage', ...) registration in
// store/entitlementStore.ts. Requires jsdom so that 'window' is defined at
// module-import time (when the top-level if-check fires). The node-environment
// tests in tests/entitlement.test.ts call _handleCrossTabStorageEvent directly
// as a plain function and cannot prove this wiring. (Task #305)

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tauri")>();
  return { ...actual, invoke: vi.fn() };
});

// Import after mocks are registered so the module's top-level addEventListener
// fires in the jsdom window context (window is defined by the jsdom environment).
const { useEntitlementStore } = await import("@/store/entitlementStore");

describe("entitlementStore — window.addEventListener registration wiring (#305)", () => {
  it("#305: dispatching StorageEvent with entitlement-v1 key triggers rehydrate", () => {
    const spy = vi.spyOn(useEntitlementStore.persist, "rehydrate").mockResolvedValue(undefined);
    window.dispatchEvent(new StorageEvent("storage", { key: "entitlement-v1" }));
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("#305: dispatching StorageEvent with a different key does not trigger rehydrate", () => {
    const spy = vi.spyOn(useEntitlementStore.persist, "rehydrate").mockResolvedValue(undefined);
    window.dispatchEvent(new StorageEvent("storage", { key: "srs-v1" }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("#305: dispatching StorageEvent with null key does not trigger rehydrate", () => {
    const spy = vi.spyOn(useEntitlementStore.persist, "rehydrate").mockResolvedValue(undefined);
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
