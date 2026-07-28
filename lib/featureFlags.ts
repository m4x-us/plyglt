// ============================================================
// lib/featureFlags.ts
// ============================================================
// DEPENDS ON: lib/licenseTypes (LicenseType)
// USED BY: components/InterruptHandler.tsx, components/LanguageGrid.tsx, app/stats/page.tsx
// ============================================================

import type { LicenseType } from "@/lib/licenseTypes";

export interface FeatureFlags {
  interruptEngine: boolean;  // NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE
  vacationMode: boolean;     // NEXT_PUBLIC_FLAGS_VACATION_MODE
  analytics: boolean;        // NEXT_PUBLIC_FLAGS_ANALYTICS
  specialtyPacks: boolean;   // NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS
}

// Standard env-var falsy values — "false", "0", "off", "no" all disable a flag.
const FALSY_FLAG_VALUES: string[] = ["false", "0", "off", "no"];

function parseFlag(v: string | undefined): boolean {
  return !FALSY_FLAG_VALUES.includes(v?.toLowerCase() ?? "");
}

// Grace period: a subscription stays Pro-enabled this long after validUntil, so a lapsed
// renewal or brief offline period doesn't lock users out. Lives here (not in
// store/entitlementStore.ts, a store/ file) because lib/ must never import from store/
// (CLAUDE.md layer rule) and isProEnabled below needs it — store/entitlementStore.ts's
// isPackUnlocked applies the IDENTICAL policy to pack access and re-exports this same
// constant for backward compatibility, so there remains exactly one grace-period value,
// not two independently tuned ones silently drifting apart (Task #420).
export const SUBSCRIPTION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the Pro feature flag is on, the user holds an active subscription, AND that
 *  subscription has not lapsed past its grace period — the same expiry policy
 *  store/entitlementStore.ts's isPackUnlocked already applies to pack access (Task #420;
 *  before this fix, isProEnabled never checked expiry, so a lapsed subscriber who never
 *  manually deactivated stayed Pro-gated-in indefinitely for every isProEnabled call site
 *  while correctly losing access to paid base packs via isPackUnlocked). validUntil is the
 *  raw state field — not a boolean the caller pre-computed — so this remains the single
 *  place the expiry math is written instead of every call site re-deriving it.
 *  All M2 Pro-gated call sites must use this combinator instead of inline logic. */
export function isProEnabled(flagValue: boolean, licenseType: LicenseType, validUntil: number | null): boolean {
  if (!flagValue || licenseType !== "subscription") return false;
  // validUntil:null means no expiry (e.g. users migrated from a pre-versioning build) —
  // intentional, mirrors isPackUnlocked's identical null-check in store/entitlementStore.ts.
  if (validUntil !== null && Date.now() > validUntil + SUBSCRIPTION_GRACE_PERIOD_MS) return false;
  return true;
}

/** Returns feature flags read from NEXT_PUBLIC_FLAGS_* env vars.
 *  Default: true (feature on). "false", "0", "off", or "no" disables. */
export function getFeatureFlags(): FeatureFlags {
  return {
    interruptEngine: parseFlag(process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE),
    vacationMode:    parseFlag(process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE),
    analytics:       parseFlag(process.env.NEXT_PUBLIC_FLAGS_ANALYTICS),
    specialtyPacks:  parseFlag(process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS),
  };
}
