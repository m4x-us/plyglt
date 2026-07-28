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
// Task #462: the only values that explicitly ENABLE a flag regardless of defaultEnabled.
// Symmetric to FALSY_FLAG_VALUES — an explicit "true"/"1" always wins, just as an explicit
// falsy value always wins. Anything that is neither is not a recognized signal at all (a
// typo'd env var, e.g. "tru" or "yes-please") and must fall through to defaultEnabled, not
// silently resolve to enabled=true the way "any non-falsy string" did before this fix.
const TRUTHY_FLAG_VALUES: string[] = ["true", "1"];

// Task #427: defaultEnabled is per-flag, not a blanket true — a flag gating an unfinished
// feature (e.g. specialtyPacks) must default OFF when unset, while a shipped feature
// (interruptEngine, vacationMode, analytics) keeps defaulting ON so omitting the env var
// anywhere doesn't silently disable something already live. See getFeatureFlags() below
// for which default each flag uses.
function parseFlag(v: string | undefined, defaultEnabled: boolean): boolean {
  // Task #448 (F009): an env var explicitly set to "" is indistinguishable in practice
  // from unset (e.g. an unfilled CI template variable) — it must fall through to
  // defaultEnabled too, not silently enable a flag whose safe default is off. Only
  // v === undefined was checked before; "" skipped that branch and fell through to
  // !FALSY_FLAG_VALUES.includes("") === true regardless of defaultEnabled.
  if (v === undefined || v === "") return defaultEnabled;
  const normalized = v.toLowerCase();
  if (TRUTHY_FLAG_VALUES.includes(normalized)) return true;
  if (FALSY_FLAG_VALUES.includes(normalized)) return false;
  // Task #462 (F8): a value that is neither a recognized truthy nor falsy signal (a typo'd
  // env var) is not an explicit override at all — it must fall through to defaultEnabled,
  // the same as undefined/"". Previously any such value resolved to enabled=true regardless
  // of defaultEnabled, letting a malformed env value silently enable a Pro-gated feature.
  return defaultEnabled;
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
 *  "false", "0", "off", or "no" (case-insensitive) always disables a flag when set.
 *  Shipped features (interruptEngine, vacationMode, analytics) default ON when the env
 *  var is unset — omitting it must not silently disable something already live.
 *  specialtyPacks defaults OFF when unset (Task #427): it gates an unfinished, dormant
 *  feature (BRAND.md roadmap — no specialty pack is ready yet), so the safe default is
 *  off, not on. */
export function getFeatureFlags(): FeatureFlags {
  return {
    interruptEngine: parseFlag(process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE, true),
    vacationMode:    parseFlag(process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE, true),
    analytics:       parseFlag(process.env.NEXT_PUBLIC_FLAGS_ANALYTICS, true),
    specialtyPacks:  parseFlag(process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS, false),
  };
}
