// ===========================================
// ENTITLEMENT STORE
// ===========================================
// Persisted Zustand store for license and pack unlock state.
// Tracks the current license key, instance ID, license type,
// which language packs are unlocked, and validation timestamps.
// ===========================================
// DEPENDS ON: zustand, @/lib/storage, @/store/migrations,
//             @/lib/langRegistry, @/lib/entitlement, @/lib/packLoader
// USED BY: app/settings/page.tsx, components/EntitlementValidator.tsx,
//          app/learn/page.tsx, app/study/page.tsx
// ===========================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createPlatformStorage } from "@/lib/storage";
import { ENTITLEMENT_VERSION, migrateEntitlementStore } from "@/store/migrations";
import { FREE_PACK_CODES, SPECIALTY_PACKS, isSpecialtyPackCode, type PackCode } from "@/lib/langRegistry";
import { clearSpecialtyCache } from "@/lib/specialtyPackLoader";
import { evictPack, getLoadedAddOns } from "@/lib/packLoader";
import { invoke } from "@/lib/tauri";
import { hasAddOn as libHasAddOn } from "@/lib/entitlement";

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

// ── purchaseAddOn error constants ─────────────────────────────────────────────
// Named constants prevent string drift between the implementation and callers.
// Import these — never repeat the string literal inline.
export const ERR_ADDON_INVALID_CODE   = "invalid_code"    as const; // code is not a registered specialty pack
export const ERR_ADDON_RECEIPT_INVALID = "receipt_invalid" as const; // verify_addon_receipt returned falsy
export const ERR_ADDON_IPC_ERROR       = "ipc_error"       as const; // Tauri IPC threw

// purchaseAddOn contract (Tasks #287, #285):
//   signature: (code: string, receiptToken: string) => Promise<PurchaseAddOnResult>
//   success:   { ok: true } — code appended to purchasedAddOns
//   failure:   { ok: false; error: one of the ERR_ADDON_* constants above }
//   web mode:  invoke() returns null → receipt_invalid — no purchase without Tauri IPC
//
// ── DELIBERATE DEFERRAL (Task #295) ─────────────────────────────────────────
// purchaseAddOn is an intentionally unreachable stub in all current runtimes:
//   1. The Tauri command verify_addon_receipt does not exist in src-tauri —
//      it is not registered in generate_handler! and has no implementation in
//      license.rs. invoke() will throw (Tauri) or return null (web), causing
//      ERR_ADDON_IPC_ERROR or ERR_ADDON_RECEIPT_INVALID in every call.
//   2. No production caller passes a real code+receipt to this function.
//      LanguageGrid's specialty-tile CTA opens the generic BuyModal (subscription
//      checkout only); no per-add-on code or receipt-delivery mechanism exists.
// Both the Rust backend and the frontend wiring wait for real specialty-pack content
// and pricing per the BRAND.md roadmap. This is a deliberate design decision, not a
// bug or oversight. Do not attempt to call purchaseAddOn until specialty content ships.
export type PurchaseAddOnResult =
  | { ok: true }
  | { ok: false; error: typeof ERR_ADDON_INVALID_CODE | typeof ERR_ADDON_RECEIPT_INVALID | typeof ERR_ADDON_IPC_ERROR };

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
  // Task #326: returns a Promise so callers that need to know the specialty-content
  // eviction has genuinely completed (not just fired) can await it. The synchronous
  // state reset (licenseKey, purchasedAddOns, etc.) still happens before this Promise
  // resolves — callers observe that immediately regardless of whether they await.
  clearEntitlement: () => Promise<void>;
  markValidated: (validUntil: number | null) => void;
  touchValidated: () => void;

  isPackUnlocked: (lang: string) => boolean;
  needsValidation: () => boolean;
  hasAddOn: (code: string) => boolean;
  purchaseAddOn: (code: string, receiptToken: string) => Promise<PurchaseAddOnResult>;
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

      clearEntitlement: () => {
        // Task #326: clearSpecialtyCache() only resets loadedAddOns/inFlight bookkeeping —
        // it never touches memCache. Without evicting the affected base packs too, a
        // deactivated user's session retains full access to previously-merged specialty
        // content via loadPack's memory-cache-hit fast path, which never consults
        // purchasedAddOns. Capture the affected base languages BEFORE anything mutates
        // getLoadedAddOns()'s underlying bookkeeping.
        const affectedBaseLangs = new Set(
          getLoadedAddOns()
            .map(code => SPECIALTY_PACKS.find(sp => sp.code === code)?.baseLang)
            .filter((lang): lang is PackCode => lang !== undefined)
        );
        // Reset observable state synchronously — callers that don't await the returned
        // Promise still see licenseKey/purchasedAddOns/etc. cleared immediately.
        set({
          licenseKey: null,
          instanceId: null,
          licenseType: "free",
          unlockedPacks: [...FREE_PACK_CODES],
          purchasedAddOns: [],
          lastValidated: 0,
          validUntil: null,
        });
        // Evict each affected base pack from memCache — and, critically, run this BEFORE
        // clearSpecialtyCache() below. evictPack's clearPackCache internally calls
        // clearSpecialtyPacksForLang(baseLang) to find which specialty codes to also purge
        // from their own persisted storage keys (Task #319); that lookup reads the same
        // loadedAddOns array clearSpecialtyCache() zeroes. Clearing bookkeeping first would
        // make clearSpecialtyPacksForLang find nothing, silently defeating #319's storage-
        // key eviction for every deactivation — caught in review before this shipped.
        // Returned as a Promise so a caller that needs the eviction to have genuinely
        // completed (not just fired) can await it — evictPack's own clearPackCache never
        // rejects in practice (storage removal uses Promise.allSettled internally), but the
        // .catch() keeps this path closed rather than an unhandled rejection if that changes.
        return Promise.all(
          Array.from(affectedBaseLangs).map(baseLang =>
            evictPack(baseLang).catch(err => {
              console.error(`[ERR-CLEAR-ENTITLEMENT-EVICT-${baseLang}-${Date.now()}] evictPack failed during clearEntitlement — merged specialty content may remain accessible until next reload`, err);
            })
          )
        ).then(() => {
          // Final bookkeeping sweep — clears inFlight (untouched by per-baseLang eviction
          // above) and any loadedAddOns entries the per-baseLang pass didn't reach (e.g. a
          // code whose SPECIALTY_PACKS entry was removed between merge and deactivation).
          clearSpecialtyCache();
        });
      },

      markValidated: (validUntil) => set({ lastValidated: Date.now(), validUntil }),

      // Resets the validation TTL without changing validUntil — used on validation
      // failure so needsValidation() returns false and the LS API isn't hammered
      // on every mount during a network outage.
      touchValidated: () => set({ lastValidated: Date.now() }),

      isPackUnlocked: (lang) => isPackUnlocked(get(), lang),

      needsValidation: () => needsValidation(get()),

      // Task #300: delegate to lib/entitlement.ts's canonical pure implementation
      // rather than duplicating the check. lib/entitlement.ts's hasAddOn doc comment
      // explicitly directs this; it is the single source of truth for non-React callers.
      hasAddOn: (code) => libHasAddOn(get(), code),

      // Tasks #287 + #285: Validates the specialty pack code and verifies a Lemon Squeezy
      // receipt via Tauri IPC before recording the purchase. In web/browser mode invoke()
      // returns null, so purchases are only possible through the Tauri desktop app.
      // Tauri command: verify_addon_receipt(code: &str, receipt_token: &str) -> bool
      //
      // ⚠ STUB — see the purchaseAddOn contract comment above (#295): this function is
      // unreachable in all current runtimes. Neither the Rust command nor a production
      // caller exists yet. Do not remove the code-path guards below — they will be active
      // once specialty content ships and the backend + caller are wired.
      purchaseAddOn: async (code, receiptToken) => {
        // Task #287: reject any code that isn't a registered specialty pack code.
        // Prevents garbage strings from persisting forever in purchasedAddOns (no removal path exists).
        if (!isSpecialtyPackCode(code)) {
          console.warn(`[purchaseAddOn] "${code}" is not a registered specialty pack code — rejected`);
          return { ok: false, error: ERR_ADDON_INVALID_CODE };
        }
        // Task #322: reject an empty receiptToken before it reaches the IPC boundary.
        // An empty token always fails verification — rejecting early avoids an IPC round-trip
        // and establishes the input boundary. Token format is Lemon Squeezy order receipt;
        // only non-empty is validated here — structural checks happen server-side.
        if (!receiptToken.trim()) {
          console.warn(`[purchaseAddOn] receiptToken is empty — rejected`);
          return { ok: false, error: ERR_ADDON_RECEIPT_INVALID };
        }
        // Task #285: verify receipt via Tauri IPC before persisting the purchase.
        let verified: boolean | null;
        try {
          verified = await invoke<boolean>("verify_addon_receipt", { code, receiptToken });
        } catch (err) {
          console.error(`[PURCHASE_ADDON_IPC_FAIL-${Date.now()}]`, { errType: err instanceof Error ? err.name : typeof err });
          return { ok: false, error: ERR_ADDON_IPC_ERROR };
        }
        if (!verified) {
          console.warn(`[purchaseAddOn] receipt verification rejected for "${code}" — not persisted`);
          return { ok: false, error: ERR_ADDON_RECEIPT_INVALID };
        }
        set((s) => ({
          purchasedAddOns: s.purchasedAddOns.includes(code)
            ? s.purchasedAddOns
            : [...s.purchasedAddOns, code],
        }));
        return { ok: true };
      },
    }),
    {
      name: ENTITLEMENT_STORE_KEY,
      version: ENTITLEMENT_VERSION,
      migrate: migrateEntitlementStore,
      storage: createJSONStorage(() => createPlatformStorage(ENTITLEMENT_STORE_KEY)),
    }
  )
);

// Cross-tab sync: Zustand persist writes the in-memory state snapshot to localStorage
// at call time — it does not merge against the on-disk value first. If one tab writes
// entitlement state (license activation, validation, deactivation) and a second tab is
// open, the second tab's in-memory state is stale until it is rehydrated. Listening for
// the native 'storage' event re-hydrates in-memory state whenever another tab writes,
// so the next set() call in this tab reads the on-disk value rather than a stale snapshot.
// This guard is browser-only; Tauri uses a file-backed store that is single-process and
// not subject to this race. (Task #288)
//
// Scope note (Task #303): the original comment described "two browser tabs racing on
// purchaseAddOn" — that scenario cannot occur today because purchaseAddOn is an
// intentionally unreachable stub (#295). The guard is retained because it remains
// correct and useful for all other entitlement writes (setEntitlement, markValidated,
// clearEntitlement). The comment above reflects the actual current use case.
//
// Race limitation (Task #304): _rehydrateInFlight deduplicates rapid storage events so
// concurrent rehydrate() calls do not race each other. However, a set() call that
// completes between the storage event and rehydrate completion may still be overwritten
// — Zustand has no cross-operation lock for that scenario. The window is small in
// practice (entitlement writes are rare) and acceptable given the client-only,
// honour-system entitlement model (decision 2026-06-24).

// Task #304: deduplicates concurrent rehydrate() calls so rapid storage events
// do not trigger overlapping rehydrations. Once a rehydrate is in flight, further
// storage events for the same key are ignored until it settles.
let _rehydrateInFlight = false;

/** @internal Exported for unit testing; not part of the module's public API. */
export function _handleCrossTabStorageEvent(e: { key: string | null }): void {
  if (e.key !== ENTITLEMENT_STORE_KEY) return;
  if (_rehydrateInFlight) return;
  _rehydrateInFlight = true;
  const done = () => { _rehydrateInFlight = false; };
  const result = useEntitlementStore.persist.rehydrate();
  if (result instanceof Promise) {
    result.then(done, done);
  } else {
    done();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", _handleCrossTabStorageEvent);
}
