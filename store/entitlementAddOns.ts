// ============================================================
// ENTITLEMENT ADD-ONS — specialty pack purchase action and its constants
// ============================================================
// purchaseAddOn and its supporting error constants/type, extracted from
// store/entitlementStore.ts under Rule 1 (services ≤400 lines) during Task #412
// remediation — entitlementStore.ts keeps the persisted state shape and the license
// lifecycle actions (setEntitlement/clearEntitlement/markValidated/touchValidated/
// isPackUnlocked/needsValidation); this module owns only the specialty-pack add-on
// purchase flow. createPurchaseAddOn takes narrow (set, get) parameter types rather
// than importing EntitlementState from entitlementStore.ts, so this module has no
// runtime or type dependency on its only caller.
// ============================================================
// DEPENDS ON: @/lib/langRegistry (isSpecialtyPackCode), @/lib/tauri (invoke),
//             @/lib/featureFlags (getFeatureFlags, isProEnabled),
//             @/lib/generationGuard (createGenerationGuard — Task #449 deactivation guard)
// USED BY: store/entitlementStore.ts ONLY. createPurchaseAddOn is exported solely so
//          the store can wire it into its action map, and bumpAddOnDeactivationGuard is
//          exported solely for clearEntitlement to call — invoking either from anywhere
//          else bypasses the store's own state/guard and is a stop-the-line violation.
// ============================================================

import { isSpecialtyPackCode } from "@/lib/langRegistry";
import { invoke } from "@/lib/tauri";
import { getFeatureFlags, isProEnabled } from "@/lib/featureFlags";
import { createGenerationGuard } from "@/lib/generationGuard";
import type { LicenseType } from "@/lib/licenseTypes";

// ── purchaseAddOn error constants ─────────────────────────────────────────────
// Named constants prevent string drift between the implementation and callers.
// Import these — never repeat the string literal inline.
export const ERR_ADDON_INVALID_CODE    = "invalid_code"    as const; // code is not a registered specialty pack
export const ERR_ADDON_RECEIPT_INVALID = "receipt_invalid" as const; // verify_addon_receipt returned falsy
export const ERR_ADDON_IPC_ERROR       = "ipc_error"       as const; // Tauri IPC threw
export const ERR_ADDON_NOT_PRO         = "not_pro"         as const; // purchaser does not hold a Pro subscription
// Task #449: distinct from ERR_ADDON_NOT_PRO — that's checked at entry, before the IPC
// round-trip; this fires when a clearEntitlement() completes WHILE the round-trip is in
// flight, discovered only by the post-await guard re-check. Kept as its own constant
// (not reused ERR_ADDON_NOT_PRO) so a caller/log can distinguish "you aren't Pro" from
// "you were deactivated mid-purchase" — genuinely different diagnostics.
export const ERR_ADDON_DEACTIVATED     = "deactivated"     as const; // entitlement was cleared while the IPC call was in flight

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
  | { ok: false; error: typeof ERR_ADDON_INVALID_CODE | typeof ERR_ADDON_RECEIPT_INVALID | typeof ERR_ADDON_IPC_ERROR | typeof ERR_ADDON_NOT_PRO | typeof ERR_ADDON_DEACTIVATED };

// receiptToken validation constants — mirrors the license-key validation in
// hooks/useLicenseActivation.ts (Task #423: LICENSE_KEY_MAX_LENGTH there cross-
// references this constant — both are 200-char caps rejecting megabyte-scale inputs
// before an IPC/network round-trip, kept as two constants rather than one shared
// import because they gate conceptually distinct inputs — a license key vs. a
// purchase receipt token — that happen to share the same limit today).
export const RECEIPT_TOKEN_MAX_LENGTH = 200;
const RECEIPT_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Narrow store surface purchaseAddOn needs. Kept minimal (not the full EntitlementState)
 * so this module has no type dependency on store/entitlementStore.ts. */
interface PurchaseAddOnGet {
  licenseType: LicenseType;
  validUntil: number | null;
}
interface PurchaseAddOnSetArg {
  purchasedAddOns: string[];
}

// Task #449: mirrors lib/specialtyPackLoader.ts's deactivationGuard pattern (Task #394/
// #409) — the sibling specialty-pack LOAD path already re-checks a generation guard
// immediately before its own risky memCache mutation; this PURCHASE path checked the Pro
// gate once at entry, then awaited an IPC round-trip, then unconditionally appended to
// purchasedAddOns via a functional set() with no re-check. If clearEntitlement() resolves
// while a purchaseAddOn IPC call is in flight, that functional set() reads the current
// (post-deactivation, reset-to-[]) state and re-adds code to it — silently resurrecting a
// purchase record after the license was cleared. bumpAddOnDeactivationGuard() is called
// from store/entitlementStore.ts's clearEntitlement, at the same point it resets
// purchasedAddOns — a module-level singleton (not per-call), matching
// lib/specialtyPackLoader.ts's exact pattern, since this guard must be invalidated by ANY
// deactivation regardless of which purchaseAddOn call is currently in flight.
const deactivationGuard = createGenerationGuard();

/** @internal Called ONLY by store/entitlementStore.ts's clearEntitlement, at the same
 * point it resets purchasedAddOns. Exported (not module-private to a shared file) because
 * this module and entitlementStore.ts are deliberately kept free of a runtime import of
 * each other's internals beyond this one factory/trigger pair — see the module header. */
export function bumpAddOnDeactivationGuard(): void {
  deactivationGuard.bump();
}

/**
 * Builds the purchaseAddOn store action. Called once from store/entitlementStore.ts's
 * Zustand creator, closing over that store's real `set`/`get` — the real EntitlementState
 * structurally satisfies both narrow interfaces above, so this composes without either
 * module importing the other's types.
 */
export function createPurchaseAddOn(
  set: (updater: (s: PurchaseAddOnSetArg) => PurchaseAddOnSetArg) => void,
  get: () => PurchaseAddOnGet
) {
  // Tasks #287 + #285: Validates the specialty pack code and verifies a Lemon Squeezy
  // receipt via Tauri IPC before recording the purchase. In web/browser mode invoke()
  // returns null, so purchases are only possible through the Tauri desktop app.
  // Tauri command: verify_addon_receipt(code: &str, receipt_token: &str) -> bool
  //
  // ⚠ STUB — see the purchaseAddOn contract comment above (#295): this function is
  // unreachable in all current runtimes. Neither the Rust command nor a production
  // caller exists yet. Do not remove the code-path guards below — they will be active
  // once specialty content ships and the backend + caller are wired.
  return async function purchaseAddOn(code: string, receiptToken: string): Promise<PurchaseAddOnResult> {
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
    // Task #449: snapshot the deactivation generation immediately after the Pro gate
    // passes — mirrors lib/specialtyPackLoader.ts's deactivationGuard.snapshot() timing
    // (taken after ITS entitlement gate passes, at loadSpecialtyPack's entry).
    const entryGeneration = deactivationGuard.snapshot();
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
    // Task #449: re-check immediately before the mutating set() — mirrors
    // lib/specialtyPackLoader.ts's _mergeFromJson re-check right before its own risky
    // mutation. Without this, a clearEntitlement() that resolved while the IPC round-trip
    // above was in flight would have already reset purchasedAddOns to [] — the functional
    // set() below would then silently resurrect this purchase into the just-cleared array,
    // granting post-deactivation access to paid content.
    if (deactivationGuard.isStale(entryGeneration)) {
      console.warn(`[purchaseAddOn] entitlement was cleared while the purchase for "${code}" was in flight — not persisted`);
      return { ok: false, error: ERR_ADDON_DEACTIVATED };
    }
    set((s) => ({
      purchasedAddOns: s.purchasedAddOns.includes(code)
        ? s.purchasedAddOns
        : [...s.purchasedAddOns, code],
    }));
    return { ok: true };
  };
}
