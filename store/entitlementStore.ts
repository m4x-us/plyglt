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
import { FREE_PACK_CODES, SPECIALTY_PACKS, isSpecialtyPackCode, isRegisteredSpecialtyCode, type PackCode } from "@/lib/langRegistry";
import { resetSpecialtyLoadState } from "@/lib/specialtyPackLoader";
import { evictPack, getLoadedAddOns } from "@/lib/packLoader";
import { invoke } from "@/lib/tauri";
import { hasAddOn as libHasAddOn } from "@/lib/entitlement";
import { getFeatureFlags, isProEnabled, SUBSCRIPTION_GRACE_PERIOD_MS } from "@/lib/featureFlags";

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

// ── purchaseAddOn error constants ─────────────────────────────────────────────
// Named constants prevent string drift between the implementation and callers.
// Import these — never repeat the string literal inline.
export const ERR_ADDON_INVALID_CODE    = "invalid_code"    as const; // code is not a registered specialty pack
export const ERR_ADDON_RECEIPT_INVALID = "receipt_invalid" as const; // verify_addon_receipt returned falsy
export const ERR_ADDON_IPC_ERROR       = "ipc_error"       as const; // Tauri IPC threw
export const ERR_ADDON_NOT_PRO         = "not_pro"         as const; // purchaser does not hold a Pro subscription

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
  | { ok: false; error: typeof ERR_ADDON_INVALID_CODE | typeof ERR_ADDON_RECEIPT_INVALID | typeof ERR_ADDON_IPC_ERROR | typeof ERR_ADDON_NOT_PRO };

// Poll window: the LS API is called at most once per this interval, preventing
// hammering on every mount during a network outage.
export const VALIDATION_POLL_INTERVAL_MS = SUBSCRIPTION_GRACE_PERIOD_MS; // same value, independent policy

// receiptToken validation constants — mirrors the license-key validation in useLicenseActivation.ts
const RECEIPT_TOKEN_MAX_LENGTH = 200;
const RECEIPT_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

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
        // call are still in-flight is safe. The synchronous set() below is idempotent (null
        // fields simply overwrite null). A second Promise.all races the first but they share
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
        // resetSpecialtyLoadState() below. evictPack's clearPackCache internally calls
        // clearSpecialtyPacksForLang(baseLang) to find which specialty codes to also purge
        // from their own persisted storage keys (Task #319); that lookup reads the same
        // loadedAddOns array resetSpecialtyLoadState() zeroes. Clearing bookkeeping first would
        // make clearSpecialtyPacksForLang find nothing, silently defeating #319's storage-
        // key eviction for every deactivation — caught in review before this shipped.
        // Returned as a Promise so a caller that needs the eviction to have genuinely
        // completed (not just fired) can await it.
        //
        // Task #351 (→ #415): eviction failures are collected and re-thrown so callers can
        // surface an appropriate message. The license state IS reset (set() above is
        // synchronous); a thrown error here means only that cached specialty content may
        // persist until the next page load, not that deactivation failed.
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
        // Tasks #357/#388/#395: Pro gate. Specialty packs are add-ons within the Pro tier
        // (BRAND.md), so the purchaser must hold an active, non-expired subscription.
        // Enforced HERE at the store layer — not only in the UI — so a direct devtools call
        // to purchaseAddOn cannot bypass it. Routed through isProEnabled(), the single
        // mandated combinator for all Pro-gated features (CLAUDE.md / lib/featureFlags.ts).
        // getFeatureFlags().specialtyPacks defaults to FALSE when NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS
        // is unset (Task #427 — the safe-off default for this still-unfinished feature), so
        // in a runtime without that env var explicitly set to a truthy value this gate
        // always rejects with ERR_ADDON_NOT_PRO regardless of licenseType. Tests exercising
        // this gate must stub the env var. When the flag IS enabled, this reduces to
        // licenseType === "subscription" and validUntil not past its grace period (Task
        // #420 — isProEnabled became expiry-aware, matching isPackUnlocked's identical
        // policy for pack access).
        //
        // Deferral history (#357, Wave 13): a store-level gate was blocked because
        // tests/entitlement.test.ts (then off-limits) called purchaseAddOn under
        // licenseType:"free". Wave 13 moved those tests to licenseType:"subscription";
        // Wave 14 (#388) verified every purchaseAddOn test call site
        // (tests/entitlement.test.ts, tests/purchaseAddOnGuards.test.ts) now runs under
        // subscription — the stated blocker no longer existed, so the gate was implemented.
        if (!isProEnabled(getFeatureFlags().specialtyPacks, get().licenseType, get().validUntil)) {
          console.warn(`[purchaseAddOn] purchaser does not hold a Pro subscription — rejected`);
          return { ok: false, error: ERR_ADDON_NOT_PRO };
        }
        // Task #322: reject an empty receiptToken before it reaches the IPC boundary.
        // An empty token always fails verification — rejecting early avoids an IPC round-trip.
        if (!receiptToken.trim()) {
          console.warn(`[purchaseAddOn] receiptToken is empty — rejected`);
          return { ok: false, error: ERR_ADDON_RECEIPT_INVALID };
        }
        // Task #349: validate receiptToken length and charset before IPC, mirroring the
        // license-key validation in useLicenseActivation.ts. LS receipt tokens are
        // alphanumeric + hyphens/underscores; the 200-char cap rejects megabyte-scale inputs.
        const trimmedToken = receiptToken.trim();
        if (trimmedToken.length > RECEIPT_TOKEN_MAX_LENGTH || !RECEIPT_TOKEN_PATTERN.test(trimmedToken)) {
          console.warn(`[purchaseAddOn] receiptToken failed format validation (length: ${trimmedToken.length}) — rejected`);
          return { ok: false, error: ERR_ADDON_RECEIPT_INVALID };
        }
        // Task #285: verify receipt via Tauri IPC before persisting the purchase.
        let verified: boolean | null;
        try {
          verified = await invoke<boolean>("verify_addon_receipt", { code, receiptToken: trimmedToken });
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
