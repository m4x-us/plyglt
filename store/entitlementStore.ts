// ===========================================
// ENTITLEMENT STORE
// ===========================================
// Persisted Zustand store for license and pack unlock state.
// Tracks the current license key, instance ID, license type,
// which language packs are unlocked, and validation timestamps.
// ===========================================
// DEPENDS ON: zustand, @/lib/storage, @/store/migrations,
//             @/lib/langRegistry
// USED BY: app/settings/page.tsx, components/EntitlementValidator.tsx,
//          app/learn/page.tsx, app/study/page.tsx
// ===========================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createPlatformStorage } from "@/lib/storage";
import { ENTITLEMENT_VERSION, migrateEntitlementStore } from "@/store/migrations";
import { FREE_PACK_CODES, type PackCode } from "@/lib/langRegistry";

// LicenseType lives in lib/ (lower layer) to avoid lib/→store/ upward imports.
// Imported for use within this file; re-exported so existing callers of
// store/entitlementStore can keep their import paths without change.
import type { LicenseType } from "@/lib/licenseTypes";
export type { LicenseType } from "@/lib/licenseTypes";

/** @deprecated Use ALL_PACK_CODES from @/lib/langRegistry directly. */
export { ALL_PACK_CODES as ALL_KNOWN_PACKS } from "@/lib/langRegistry";
// Re-exported so existing consumers that import PackCode from this module continue to work.
export type { PackCode } from "@/lib/langRegistry";

// Grace period: subscriptions stay unlocked this long after validUntil so a
// lapsed renewal or brief offline period doesn't lock users out.
export const SUBSCRIPTION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Poll window: the LS API is called at most once per this interval, preventing
// hammering on every mount during a network outage.
export const VALIDATION_POLL_INTERVAL_MS = SUBSCRIPTION_GRACE_PERIOD_MS; // same value, independent policy


interface EntitlementState {
  licenseKey: string | null;
  instanceId: string | null;
  licenseType: LicenseType;
  unlockedPacks: PackCode[];
  purchasedAddOns: string[];  // specialty pack codes purchased as add-ons (e.g. "it-medical")
  lastValidated: number;     // unix ms; 0 = never validated
  validUntil: number | null; // null = no expiry; ms timestamp for subscriptions with an end date

  setEntitlement: (data: {
    licenseKey: string;
    instanceId: string;
    licenseType: LicenseType;
    unlockedPacks: PackCode[];
    validUntil: number | null;
  }) => void;
  clearEntitlement: () => void;
  markValidated: (validUntil: number | null) => void;
  touchValidated: () => void;

  isPackUnlocked: (lang: string) => boolean;
  needsValidation: () => boolean;
  hasAddOn: (code: string) => boolean;
  purchaseAddOn: (code: string) => void;
}

// ── Pure classification functions (Rule 15) ──────────────────────────────────

/** Returns true if the given language pack is accessible given the current entitlement state. */
export function isPackUnlocked(
  state: Pick<EntitlementState, "licenseType" | "unlockedPacks" | "validUntil">,
  lang: string
): boolean {
  if (FREE_PACK_CODES.some(c => c === lang)) return true;
  const { licenseType, unlockedPacks, validUntil } = state;
  if (licenseType === "free") return false;
  // Users migrated from a prior app version may have validUntil:null if their old
  // licenseType was coerced to subscription by migration v2. validUntil:null means
  // no expiry — intentional: these users retain access until they re-activate.
  if (licenseType === "subscription" && validUntil !== null) {
    if (Date.now() > validUntil + SUBSCRIPTION_GRACE_PERIOD_MS) return false;
  }
  return unlockedPacks.some(code => code === lang);
}

/** Returns true if a subscription validation call to LS is due. */
export function needsValidation(
  state: Pick<EntitlementState, "licenseType" | "lastValidated">
): boolean {
  const { licenseType, lastValidated } = state;
  if (licenseType !== "subscription") return false;
  return Date.now() - lastValidated > VALIDATION_POLL_INTERVAL_MS;
}

// Frozen at v1 — changing this key would abandon all existing user data.
// Version tracking is handled by ENTITLEMENT_VERSION + migrateEntitlementStore.
const ENTITLEMENT_STORE_KEY = "entitlement-v1" as const;

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set, get) => ({
      licenseKey: null,
      instanceId: null,
      licenseType: "free",
      unlockedPacks: [...FREE_PACK_CODES],
      purchasedAddOns: [],
      lastValidated: 0,
      validUntil: null,

      setEntitlement: (data) => set({ ...data, lastValidated: Date.now() }),

      clearEntitlement: () =>
        set({
          licenseKey: null,
          instanceId: null,
          licenseType: "free",
          unlockedPacks: [...FREE_PACK_CODES],
          purchasedAddOns: [],
          lastValidated: 0,
          validUntil: null,
        }),

      markValidated: (validUntil) => set({ lastValidated: Date.now(), validUntil }),

      // Resets the validation TTL without changing validUntil — used on validation
      // failure so needsValidation() returns false and the LS API isn't hammered
      // on every mount during a network outage.
      touchValidated: () => set({ lastValidated: Date.now() }),

      isPackUnlocked: (lang) => isPackUnlocked(get(), lang),

      needsValidation: () => needsValidation(get()),

      hasAddOn: (code) => get().purchasedAddOns.includes(code),

      // No-op stub — real payment integration (Lemon Squeezy add-on purchase) comes later.
      // Adds the code optimistically so UI and packLoader can operate on it immediately.
      purchaseAddOn: (code) =>
        set((s) => ({
          purchasedAddOns: s.purchasedAddOns.includes(code)
            ? s.purchasedAddOns
            : [...s.purchasedAddOns, code],
        })),
    }),
    {
      name: ENTITLEMENT_STORE_KEY,
      version: ENTITLEMENT_VERSION,
      migrate: migrateEntitlementStore,
      storage: createJSONStorage(() => createPlatformStorage(ENTITLEMENT_STORE_KEY)),
    }
  )
);
