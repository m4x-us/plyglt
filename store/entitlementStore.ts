// ===========================================
// ENTITLEMENT STORE
// ===========================================
// Persisted Zustand store for license and pack unlock state.
// Tracks the current license key, instance ID, license type,
// which language packs are unlocked, and validation timestamps.
// ===========================================
// DEPENDS ON: zustand, @/lib/storage, @/store/migrations,
//             @/lib/langRegistry, @/lib/entitlement, @/lib/packLoader,
//             @/lib/specialtyPackLoader, @/lib/tauri, @/lib/licenseTypes,
//             @/lib/featureFlags
// USED BY: app/page.tsx, app/settings/page.tsx, app/stats/page.tsx,
//          components/EntitlementValidator.tsx,
//          hooks/useLangPack.ts, hooks/useExportImport.ts, hooks/useLicenseActivation.ts
// ===========================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createPlatformStorage } from "@/lib/storage";
import { ENTITLEMENT_VERSION, migrateEntitlementStore } from "@/store/migrations";
import { FREE_PACK_CODES, SPECIALTY_PACKS, isRegisteredSpecialtyCode, type PackCode } from "@/lib/langRegistry";
import { resetSpecialtyLoadState } from "@/lib/specialtyPackLoader";
import { evictPack, getLoadedAddOns } from "@/lib/packLoader";
import { hasAddOn as libHasAddOn } from "@/lib/entitlement";
import { SUBSCRIPTION_GRACE_PERIOD_MS } from "@/lib/featureFlags";

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
// Task #420: moved to lib/featureFlags.ts (isProEnabled needs it too, and lib/ must never
// import from store/) — re-exported here so existing external imports of this name from
// this module (tests, components/EntitlementValidator.tsx) keep working unchanged.
export { SUBSCRIPTION_GRACE_PERIOD_MS } from "@/lib/featureFlags";

// Poll window: the LS API is called at most once per this interval, preventing
// hammering on every mount during a network outage.
export const VALIDATION_POLL_INTERVAL_MS = SUBSCRIPTION_GRACE_PERIOD_MS; // same value, independent policy

// Task #412: purchaseAddOn and its ERR_ADDON_*/PurchaseAddOnResult/RECEIPT_TOKEN_*
// constants moved to store/entitlementAddOns.ts (Rule 1 — this file was over the
// 400-line service cap). Re-exported here so existing external imports of these names
// from this module (tests, callers) keep working unchanged.
export {
  ERR_ADDON_INVALID_CODE,
  ERR_ADDON_RECEIPT_INVALID,
  ERR_ADDON_IPC_ERROR,
  ERR_ADDON_NOT_PRO,
  ERR_ADDON_DEACTIVATED,
  type PurchaseAddOnResult,
} from "@/store/entitlementAddOns";
import { createPurchaseAddOn, bumpAddOnDeactivationGuard, type PurchaseAddOnResult } from "@/store/entitlementAddOns";

interface EntitlementState {
  licenseKey: string | null;
  instanceId: string | null;
  licenseType: LicenseType;
  unlockedPacks: PackCode[];
  purchasedAddOns: string[];  // specialty pack codes purchased as add-ons (e.g. "it-medical")
  lastValidated: number;     // unix ms; 0 = never validated
  validUntil: number | null; // null = no expiry; ms timestamp for subscriptions with an end date
  // Task #362: session-only counter, NOT persisted (excluded by partialize). Increments each
  // time clearEntitlement's base-pack evictions complete. useLangPack subscribes to this so
  // it can re-seed memCache after clearEntitlement evicts the currently-active base language.
  _cacheEvictionGeneration: number;

  // Task #343: purchasedAddOns is intentionally absent from this parameter type.
  // Add-on purchases require server-verified receipts via purchaseAddOn() — they cannot be
  // restored from a backup or set by callers that bypass that verification step. The
  // implementation enforces this by destructuring only the declared fields, so callers
  // that accidentally spread extra properties (e.g. a BackupEntitlement object) cannot
  // silently write purchasedAddOns. (See also: useExportImport.ts #342 call-site fix.)
  //
  // Task #430: lastValidated is REQUIRED (not auto-stamped to Date.now() internally) —
  // the caller must assert whether this data was just verified against the real license
  // server. A genuine activateLicense() success (hooks/useLicenseActivation.ts) passes
  // Date.now(): a real server round-trip just happened. An unsigned backup restore
  // (hooks/useExportImport.ts) passes 0: the fields are unverified, and stamping a fresh
  // lastValidated here would grant a full VALIDATION_POLL_INTERVAL_MS grace period with
  // zero server contact — passing 0 makes needsValidation() true immediately, so the next
  // app foreground (components/EntitlementValidator.tsx) re-validates against the real
  // server before continuing to trust the restored fields.
  setEntitlement: (data: {
    licenseKey: string;
    instanceId: string;
    licenseType: LicenseType;
    unlockedPacks: PackCode[];
    validUntil: number | null;
    lastValidated: number;
  }) => void;
  // Task #326: returns a Promise so callers that need to know the specialty-content
  // eviction has genuinely completed (not just fired) can await it. The synchronous
  // state reset (licenseKey, purchasedAddOns, etc.) still happens before this Promise
  // resolves — callers observe that immediately regardless of whether they await.
  // Task #351: the Promise rejects if any base-pack eviction fails, so callers can
  // surface an appropriate message (license IS deactivated; only cached content may linger).
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
  // Task #386 (Rule 17c): structurally exhaustive over the LicenseType union. The default
  // branch fails closed for an out-of-union runtime value (corrupt persisted state) —
  // no paid access; free packs already returned true above. `satisfies never` turns
  // "added a LicenseType without deciding its unlock policy here" into a compile error.
  switch (licenseType) {
    case "free":
      return false;
    case "subscription":
      // Users migrated from a prior app version may have validUntil:null if their old
      // licenseType was coerced to subscription by migration v2. validUntil:null means
      // no expiry — intentional: these users retain access until they re-activate.
      if (validUntil !== null && Date.now() > validUntil + SUBSCRIPTION_GRACE_PERIOD_MS) {
        return false;
      }
      return unlockedPacks.some(code => code === lang);
    default:
      licenseType satisfies never;
      return false;
  }
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
      _cacheEvictionGeneration: 0,

      // Task #342/#343: explicit destructuring enforces the type contract at runtime —
      // extra fields (e.g. purchasedAddOns from a BackupEntitlement spread) cannot
      // sneak through, even if a caller passes a wider object.
      // Task #430: lastValidated is taken from the caller, never stamped to Date.now()
      // internally — see the setEntitlement type's doc comment above for why.
      setEntitlement: ({ licenseKey, instanceId, licenseType, unlockedPacks, validUntil, lastValidated }) =>
        set({ licenseKey, instanceId, licenseType, unlockedPacks, validUntil, lastValidated }),

      clearEntitlement: () => {
        // Task #364 — idempotency: calling clearEntitlement while evictions from a previous
        // call are still in-flight is safe. The state-reset set() (now inside the .then()
        // below — Task #438) is idempotent regardless of call order or timing (null fields
        // simply overwrite null). A second Promise.all races the first but they share
        // the same affectedBaseLangs snapshot — evictPack is also idempotent (evicting an
        // already-empty slot is a no-op). Concurrent calls are not expected in practice
        // (the only caller, useLicenseActivation.ts, awaits before returning), but are safe.
        //
        // Task #326: resetSpecialtyLoadState() resets load bookkeeping only (per its name)
        // — merged pack data lives in memCache. Without evicting the affected base packs
        // too, a deactivated user's session retains full access to previously-merged
        // specialty content via loadPack's memory-cache-hit fast path, which never consults
        // purchasedAddOns. Capture the affected base languages BEFORE anything mutates
        // getLoadedAddOns()'s underlying bookkeeping.
        // Task #407: gate via the shared isRegisteredSpecialtyCode predicate (not a
        // hand-rolled SPECIALTY_PACKS.some/find(sp => sp.code === X) check) before the
        // lookup that needs the actual entry (baseLang) — the non-null assertion is safe
        // because the filter above already proved membership.
        const affectedBaseLangs = new Set(
          getLoadedAddOns()
            .filter(isRegisteredSpecialtyCode)
            .map(code => SPECIALTY_PACKS.find(sp => sp.code === code)!.baseLang)
        );
        // Evict each affected base pack from memCache — and, critically, run this BEFORE
        // resetSpecialtyLoadState() below. evictPack's clearPackCache internally calls
        // clearSpecialtyPacksForLang(baseLang) to find which specialty codes to also purge
        // from their own persisted storage keys (Task #319); that lookup reads the same
        // loadedAddOns array resetSpecialtyLoadState() zeroes. Clearing bookkeeping first would
        // make clearSpecialtyPacksForLang find nothing, silently defeating #319's storage-
        // key eviction for every deactivation — caught in review before this shipped.
        // Returned as a Promise so a caller that needs the eviction to have genuinely
        // completed (not just fired) can await it.
        //
        // Task #438: the entitlement-state set() below runs AFTER eviction completes, not
        // before. Before this fix, the synchronous reset ran first — licenseType flipped to
        // "free" while memCache still served the previously-merged specialty content to any
        // direct reader (loadPack's memory-cache-hit fast path, a mid-render study session)
        // for the full duration of the eviction's storage I/O: entitlement state and cached
        // content were observably inconsistent for that window. The only production caller
        // (hooks/useLicenseActivation.ts:handleDeactivate) already awaits the full returned
        // Promise before updating its own UI, so this reorder costs it nothing; a reactive
        // subscriber elsewhere now sees licenseType flip a beat later (bounded by eviction's
        // I/O duration) instead of a beat earlier than memCache is actually clean — the
        // strictly safer direction to be wrong in.
        //
        // Task #351 (→ #415): eviction failures are collected and re-thrown so callers can
        // surface an appropriate message. The license state IS reset regardless (the set()
        // below runs before the throw check) — a thrown error here means only that cached
        // specialty content may persist until the next page load, not that deactivation failed.
        //
        // Task #415: evictPack NEVER rejects (lib/packCache.ts's clearPackCache swallows
        // every storage failure internally via Promise.allSettled) — a `.catch` here could
        // never fire and was dead code. The result must be inspected instead: `.evicted`
        // covers the (here, practically unreachable — affectedBaseLangs only ever contains
        // registered base language codes) guard-rejection branches defensively, and
        // `.fullyClean` is what actually varies in production — false means memCache was
        // cleared but a storage removal failed and was already logged with its own ref ID
        // in lib/packCache.ts; this is the caller-visible signal that failure produces.
        const evictionErrors: string[] = [];
        return Promise.all(
          Array.from(affectedBaseLangs).map(baseLang =>
            evictPack(baseLang).then(result => {
              if (!result.evicted) {
                console.error(`[ERR-CLEAR-ENTITLEMENT-EVICT-${baseLang}] evictPack reported no-op (${result.reason}) — merged specialty content may remain until reload`);
                evictionErrors.push(baseLang);
                return;
              }
              if (!result.fullyClean) {
                console.error(`[ERR-CLEAR-ENTITLEMENT-EVICT-${baseLang}] evictPack completed with storage residue — merged specialty content may remain until reload`);
                evictionErrors.push(baseLang);
              }
            })
          )
        ).then(() => {
          // Task #338: resetSpecialtyLoadState() resets loadedAddOns bookkeeping, the
          // inFlight map, and the deactivation generation (#394 — invalidates any
          // specialty load still in flight so it cannot merge stale entitlement after the
          // re-seed below). Base-pack eviction is done in the Promise.all above.
          // Any specialty code whose SPECIALTY_PACKS entry was removed between merge and
          // deactivation (making baseLang resolution impossible) is also cleared here.
          resetSpecialtyLoadState();
          // Task #438: entitlement state now flips together with the cache eviction it
          // depends on — no external observer can read licenseType:"free" while memCache
          // still holds specialty content merged under the just-revoked entitlement.
          set({
            licenseKey: null,
            instanceId: null,
            licenseType: "free",
            unlockedPacks: [...FREE_PACK_CODES],
            purchasedAddOns: [],
            lastValidated: 0,
            validUntil: null,
          });
          // Task #449: bump the add-on purchase deactivation guard at the same point
          // purchasedAddOns is reset above — invalidates any purchaseAddOn() call whose
          // Pro gate already passed and is now awaiting (or has just resolved) its IPC
          // round-trip, so it cannot resurrect a purchase into the array just cleared.
          bumpAddOnDeactivationGuard();
          // Task #362: increment _cacheEvictionGeneration AFTER evictions complete so
          // useLangPack's useEffect runs its re-seed AFTER memCache has been cleared,
          // not before (which would cause a race where eviction clears the re-seeded entry).
          set(s => ({ _cacheEvictionGeneration: s._cacheEvictionGeneration + 1 }));
          if (evictionErrors.length > 0) {
            throw new Error(
              `[ERR-CLEAR-ENTITLEMENT-INCOMPLETE] eviction failed for: ${evictionErrors.join(", ")} — specialty content may persist until reload`
            );
          }
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

      // Task #412: implementation extracted to store/entitlementAddOns.ts (Rule 1 —
      // this file was over the 400-line service cap). createPurchaseAddOn closes over
      // this store's real set/get, typed against narrow interfaces that
      // EntitlementState structurally satisfies.
      purchaseAddOn: createPurchaseAddOn(set, get),
    }),
    {
      name: ENTITLEMENT_STORE_KEY,
      version: ENTITLEMENT_VERSION,
      migrate: migrateEntitlementStore,
      storage: createJSONStorage(() => createPlatformStorage(ENTITLEMENT_STORE_KEY)),
      // Task #362: exclude _cacheEvictionGeneration from persistence — it is a session-only
      // signal used to notify useLangPack when memCache eviction has completed. Persisting it
      // would give the counter a stale starting value on next launch (harmless but misleading)
      // and would require a migration. A value of 0 at boot is always correct — useLangPack
      // only needs the increment, not an absolute count.
      partialize: (state) => ({
        licenseKey:      state.licenseKey,
        instanceId:      state.instanceId,
        licenseType:     state.licenseType,
        unlockedPacks:   state.unlockedPacks,
        purchasedAddOns: state.purchasedAddOns,
        lastValidated:   state.lastValidated,
        validUntil:      state.validUntil,
      }),
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
// storage events for the same key are queued (Task #347) rather than dropped.
let _rehydrateInFlight = false;
// Task #347: tracks whether a storage event arrived while a rehydrate was in-flight.
// When rehydrate completes, if this flag is set, a new rehydrate is triggered immediately
// so the dropped event is not lost — prevents stale state after rapid cross-tab writes.
let _pendingRehydrate = false;

/** @internal Exported for unit testing; not part of the module's public API. */
export function _handleCrossTabStorageEvent(e: { key: string | null }): void {
  if (e.key !== ENTITLEMENT_STORE_KEY) return;
  if (_rehydrateInFlight) {
    _pendingRehydrate = true; // Task #347: don't drop — re-trigger after current rehydrate settles
    return;
  }
  _triggerRehydrate();
}

function _triggerRehydrate(): void {
  _rehydrateInFlight = true;
  _pendingRehydrate = false;
  const done = () => {
    _rehydrateInFlight = false;
    if (_pendingRehydrate) {
      _triggerRehydrate(); // Task #347: a storage event arrived while we were in-flight — re-run
    }
  };
  // Task #363: wrap in try/catch so a synchronous throw from persist.rehydrate() resets
  // _rehydrateInFlight rather than locking it true forever (which would permanently disable
  // cross-tab sync for this tab's lifetime).
  try {
    const result = useEntitlementStore.persist.rehydrate();
    if (result instanceof Promise) {
      result.then(done, done);
    } else {
      done();
    }
  } catch (err) {
    console.error(`[ERR-REHYDRATE-SYNC-THROW-${Date.now()}] persist.rehydrate() threw synchronously — cross-tab sync disabled for this event`, err);
    done(); // always reset the flag, even on error
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", _handleCrossTabStorageEvent);
}
