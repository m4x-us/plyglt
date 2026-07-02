"use client";

// ===========================================
// ENTITLEMENT VALIDATOR COMPONENT
// ===========================================
// Invisible component that silently re-validates subscription licenses
// on mount. Renders nothing. The validation effect logic is extracted into
// runEntitlementValidation() so it can be tested without a DOM environment.
// ===========================================
// DEPENDS ON: @/store/entitlementStore, @/lib/entitlement
// USED BY: app/layout.tsx
// ===========================================

import { useEffect } from "react";
import { useEntitlementStore } from "@/store/entitlementStore";
import { validateLicense } from "@/lib/entitlement";
import { UpdateChecker } from "@/components/UpdateChecker";

// Source-level feature flag (satisfies Rule 4). Set to false and rebuild to disable all
// background validation passes — useful during development or when debugging LS connectivity.
const ENTITLEMENT_VALIDATION_ENABLED = true;

/**
 * Validates a subscription license if one is present and overdue.
 * Extracted from the component's useEffect so tests can call it directly
 * without needing a DOM environment. Called with useEntitlementStore.getState
 * in production; called with a test state getter in tests.
 */
export function runEntitlementValidation(
  getState: typeof useEntitlementStore.getState
): Promise<void> {
  if (!ENTITLEMENT_VALIDATION_ENABLED) return Promise.resolve();
  const { licenseKey, instanceId, needsValidation, markValidated, touchValidated } = getState();
  if (!licenseKey || !instanceId) return Promise.resolve();
  if (!needsValidation()) return Promise.resolve();

  return validateLicense(licenseKey, instanceId).then((result) => {
    if (result.ok) {
      markValidated(result.validUntil);
    } else {
      // Validation failed — clearEntitlement only after the grace period
      // (isPackUnlocked applies the 7-day grace, so no need to clear here).
      // touchValidated resets lastValidated so needsValidation() returns false
      // until the next TTL window — prevents hammering LS API on every mount
      // during a network outage.
      console.warn(`[ENTITLEMENT_VALIDATOR_VALIDATE_FAIL-${Date.now()}]`, result.error);
      touchValidated();
    }
  }).catch((e: unknown) => {
    console.error(`[ENTITLEMENT_VALIDATOR_FAIL-${Date.now()}]`, e);
    touchValidated();
  });
}

/** Silently re-validates subscription licenses on mount and checks for app updates.
 *  Renders UpdateChecker as its only child — both produce no visible DOM output. */
export function EntitlementValidator() {
  useEffect(() => {
    // getState() reads current store state without subscribing to future changes.
    // run once on mount only — validation intervals are managed by SUBSCRIPTION_GRACE_PERIOD_MS.
    void runEntitlementValidation(useEntitlementStore.getState);
  }, []);

  return <UpdateChecker />;
}
