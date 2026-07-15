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

/** True when the Pro feature flag is on AND the user has an active subscription.
 *  All M2 Pro-gated call sites must use this combinator instead of inline logic. */
export function isProEnabled(flagValue: boolean, licenseType: LicenseType): boolean {
  return flagValue && licenseType === "subscription";
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
