// ===========================================
// LEMON SQUEEZY LICENSE MANAGEMENT
// ===========================================
// Handles license activation, validation, and deactivation against the
// Lemon Squeezy API via Tauri IPC commands. Parses variant names into
// entitlement data (licenseType, unlockedPacks, validUntil).
// ===========================================
// DEPENDS ON: @/lib/tauri (invoke), @/lib/licenseTypes (LicenseType),
//             @/lib/langRegistry (ALL_PACK_CODES, FREE_PACK_CODES)
// USED BY: app/settings/page.tsx, components/EntitlementValidator.tsx
// ===========================================

import { invoke } from "@/lib/tauri";
import type { LicenseType } from "@/lib/licenseTypes";
import { ALL_PACK_CODES, FREE_PACK_CODES, type PackCode } from "@/lib/langRegistry";

// ── Checkout constants (live in lib/checkout.ts — re-exported for callers) ───
export { LS_STORE_SLUG, CHECKOUT_URLS, PRICING, CUSTOMER_PORTAL_URL } from "@/lib/checkout";

// ── Error message constants ───────────────────────────────────────────────────
// Named constants prevent silent divergence between call sites.
// Import these in callers — never repeat the string literal inline.
export const ERR_ACTIVATE_NETWORK     = "Activation request failed — check your connection." as const;
// ERR_DEACTIVATE_NETWORK covers both IPC throws (network) and non-true invoke
// responses (web env / serialisation mismatch). Both cases: connection context
// is the correct user-facing mental model.
export const ERR_DEACTIVATE_NETWORK   = "Deactivation failed — check your connection." as const;
export const ERR_ACTIVATION_FAILED    = "Activation failed." as const;
export const ERR_ACTIVATE_NO_INSTANCE = "Activation returned no instance." as const;
export const ERR_ACTIVATE_NO_VARIANT  = "Activation response missing variant data." as const;
export const ERR_ACTIVATE_NO_KEY      = "Activation response missing license key." as const;
export const ERR_LICENSE_NOT_ACTIVE   = "License is not active." as const;
export const ERR_VALIDATE_NETWORK     = "Validation failed — check your connection." as const;
export const ERR_VALIDATE_NULL        = "Validation request failed." as const;
export const ERR_VALIDATE_INACTIVE    = "License is no longer valid." as const;

// Lemon Squeezy variant name substrings used in resolveVariantEntitlement.
// Update here if LS variant names change — one place, not buried in logic.
const VARIANT_MONTHLY       = "monthly";
const VARIANT_ANNUAL        = "annual";
// "all languages" matches "All Languages Pack", "All Languages Annual", etc.
// Unrecognised variant names return subscription licenseType and free pack access only.
const VARIANT_ALL_LANGUAGES = "all languages";

// ── LS response shapes ────────────────────────────────────────────────────────

interface LsKey {
  status: "active" | "inactive" | "expired" | "disabled";
  key: string;
  expires_at: string | null;
}

interface LsMeta {
  variant_name: string;
}

// Activation response — returned by ls_activate_license
interface LsActivateBody {
  activated?: boolean;
  error: string | null;
  license_key: LsKey | null | undefined; // LS API omits on error responses
  instance: { id: unknown } | null; // id typed unknown — typeof check required before use (Task #236)
  meta?: LsMeta; // optional — LS API omits meta on error responses
}

// Validation response — returned by ls_validate_license (distinct shape from activation)
interface LsValidateBody {
  valid?: boolean;
  error: string | null;
  license_key: LsKey | null | undefined;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parses a Lemon Squeezy expires_at string to a Unix ms timestamp, or null if absent/invalid. */
function parseExpiry(expiresAt: string | null): number | null {
  if (expiresAt == null) return null;
  const t = new Date(expiresAt).getTime();
  return isFinite(t) ? t : null;
}

// ── Variant → entitlement parsing ─────────────────────────────────────────────

/**
 * Maps a Lemon Squeezy variant name to entitlement data.
 *
 * Variant name substrings that unlock all languages:
 *   "monthly"       — matches "Monthly Plan", "Monthly Subscription", etc.
 *   "annual"        — matches "Annual Plan", "Annual Subscription", "semiannual"
 *                     ("semiannual".includes("annual") === true — intentional,
 *                     since semiannual is a paid plan and should unlock all packs).
 *   "all languages" — matches "All Languages Pack", "All Languages Annual", etc.
 *
 * Any variant name that does not match the above unlocks only the free packs.
 * Unknown variant names are treated conservatively — they do not escalate access.
 *
 * @internal — exported for testing and called by activateLicense; not part of the public API
 */
export function resolveVariantEntitlement(
  variantName: string,
  expiresAt: string | null
): { licenseType: LicenseType; unlockedPacks: PackCode[]; validUntil: number | null } {
  const n = variantName.toLowerCase();
  // Always "subscription" — plyglt has no lifetime plans (BRAND.md).
  const licenseType: LicenseType = "subscription";
  const unlocksAll = n.includes(VARIANT_MONTHLY) || n.includes(VARIANT_ANNUAL) || n.includes(VARIANT_ALL_LANGUAGES);
  if (!unlocksAll) {
    console.warn(`[ENTITLEMENT_VARIANT_UNKNOWN-${Date.now()}]`, { variantName });
  }
  const unlockedPacks = unlocksAll ? [...ALL_PACK_CODES] : [...FREE_PACK_CODES];
  const validUntil = parseExpiry(expiresAt);
  return { licenseType, unlockedPacks, validUntil };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ActivateResult =
  | { ok: true; licenseKey: string; instanceId: string; licenseType: LicenseType; unlockedPacks: PackCode[]; validUntil: number | null }
  | { ok: false; error: string };

export async function activateLicense(key: string): Promise<ActivateResult> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("ls_activate_license", { licenseKey: key.trim() });
  } catch (e) {
    console.error(`[ENTITLEMENT_ACTIVATE_FAIL-${Date.now()}]`, e);
    return { ok: false, error: ERR_ACTIVATE_NETWORK };
  }
  if (raw == null) {
    console.error(`[ENTITLEMENT_ACTIVATE_EMPTY-${Date.now()}]`, { raw });
    return { ok: false, error: ERR_ACTIVATE_NETWORK };
  }

  const res = raw as LsActivateBody;
  if (!res.activated || res.error) {
    if (res.error) console.error(`[ENTITLEMENT_ACTIVATE_ERR-${Date.now()}]`, { error: res.error });
    return { ok: false, error: ERR_ACTIVATION_FAILED };
  }
  if (!res.instance?.id || typeof res.instance.id !== "string") {
    console.error(`[ENTITLEMENT_ACTIVATE_NO_INSTANCE-${Date.now()}]`, { activated: res.activated });
    return { ok: false, error: ERR_ACTIVATE_NO_INSTANCE };
  }
  if (!res.license_key || res.license_key.status !== "active")
    return { ok: false, error: ERR_LICENSE_NOT_ACTIVE };
  if (!res.meta?.variant_name) {
    console.error(`[ENTITLEMENT_ACTIVATE_NO_VARIANT-${Date.now()}]`, { status: res.license_key.status });
    return { ok: false, error: ERR_ACTIVATE_NO_VARIANT };
  }
  if (!res.license_key.key) {
    console.error(`[ENTITLEMENT_ACTIVATE_BAD_KEY-${Date.now()}]`, { keyType: typeof res.license_key.key });
    return { ok: false, error: ERR_ACTIVATE_NO_KEY };
  }

  const { licenseType, unlockedPacks, validUntil } = resolveVariantEntitlement(
    res.meta.variant_name,
    res.license_key.expires_at
  );
  return { ok: true, licenseKey: res.license_key.key, instanceId: res.instance.id as string, licenseType, unlockedPacks, validUntil };
}

export type ValidateResult =
  | { ok: true; validUntil: number | null }
  | { ok: false; error: string };

export async function validateLicense(key: string, instanceId: string): Promise<ValidateResult> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("ls_validate_license", { licenseKey: key, instanceId });
  } catch (e) {
    console.error(`[ENTITLEMENT_VALIDATE_FAIL-${Date.now()}]`, e);
    return { ok: false, error: ERR_VALIDATE_NETWORK };
  }
  if (raw == null) {
    console.error(`[ENTITLEMENT_VALIDATE_EMPTY-${Date.now()}]`, { raw });
    return { ok: false, error: ERR_VALIDATE_NULL };
  }

  const res = raw as LsValidateBody;
  if (!res.valid || res.error) {
    if (res.error) console.error(`[ENTITLEMENT_VALIDATE_ERR-${Date.now()}]`, { error: res.error });
    return { ok: false, error: ERR_VALIDATE_INACTIVE };
  }
  if (!res.license_key || res.license_key.status !== "active") {
    console.error(`[ENTITLEMENT_VALIDATE_STRUCT-${Date.now()}]`, { valid: res.valid, status: res.license_key?.status });
    return { ok: false, error: ERR_LICENSE_NOT_ACTIVE };
  }

  return { ok: true, validUntil: parseExpiry(res.license_key.expires_at) };
}

// ── Add-on entitlement ────────────────────────────────────────────────────────

/** Returns true if the given specialty pack code has been purchased as an add-on. */
export function hasAddOn(state: { purchasedAddOns: string[] }, code: string): boolean {
  return state.purchasedAddOns.includes(code);
}

export type DeactivateResult = { ok: true } | { ok: false; error: string };

export async function deactivateLicense(key: string, instanceId: string): Promise<DeactivateResult> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("ls_deactivate_license", { licenseKey: key, instanceId });
  } catch {
    // IPC error is not logged — it may embed the license key via request params.
    console.error(`[ENTITLEMENT_DEACTIVATE_FAIL-${Date.now()}]`, { licenseKey: key.slice(0, 8) + "..." });
    return { ok: false, error: ERR_DEACTIVATE_NETWORK };
  }
  // ls_deactivate_license returns Result<bool, String>. Tauri serialises Ok(true)
  // as JSON true. Any other value (null in web env, false, or an object) means
  // the deactivation did not succeed.
  if (raw !== true) {
    console.error(`[ENTITLEMENT_DEACTIVATE_NON_TRUE-${Date.now()}]`, { raw });
    return { ok: false, error: ERR_DEACTIVATE_NETWORK };
  }
  return { ok: true };
}
