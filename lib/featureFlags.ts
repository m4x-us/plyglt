// ============================================================
// lib/featureFlags.ts
// ============================================================
// DEPENDS ON: nothing (reads process.env only)
// USED BY: grep -r "from \"@/lib/featureFlags\"" --include="*.ts" --include="*.tsx" .
// ============================================================

export interface FeatureFlags {
  interruptEngine: boolean; // NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE
  vacationMode: boolean;    // NEXT_PUBLIC_FLAGS_VACATION_MODE
  analytics: boolean;       // NEXT_PUBLIC_FLAGS_ANALYTICS
}

/** Returns feature flags read from NEXT_PUBLIC_FLAGS_* env vars.
 *  Default: true (feature on). Set to "false" to disable. */
export function getFeatureFlags(): FeatureFlags {
  return {
    interruptEngine: process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE !== "false",
    vacationMode: process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE !== "false",
    analytics: process.env.NEXT_PUBLIC_FLAGS_ANALYTICS !== "false",
  };
}
