// ============================================================
// useLicenseActivation.ts — Hook: activate, deactivate, and validate Lemon Squeezy licenses
// ============================================================
"use client";

import { useState } from "react";
import { useEntitlementStore } from "@/store/entitlementStore";
import { activateLicense, deactivateLicense, validateLicense } from "@/lib/entitlement";

// Task #423: named constant instead of an inline magic number — mirrors
// store/entitlementAddOns.ts's RECEIPT_TOKEN_MAX_LENGTH, which validates the parallel
// receipt-token input via the identical rule. Also mirrored (pending #423, now landed)
// by lib/importBackup.ts's LICENSE_FIELD_MAX_LENGTH, which validates a restored backup's
// licenseKey/instanceId — untrusted input reaching the same field via a different path.
// The three constants are not a single shared import (would require lib/importBackup.ts,
// a lib/ file, to import from hooks/ — an upward, layer-violating import) but their
// values must stay in sync; each site cross-references the others in its own comment.
export const LICENSE_KEY_MAX_LENGTH = 200;
const LICENSE_KEY_PATTERN = /^[A-Za-z0-9-]+$/;

export type LicenseStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function useLicenseActivation() {
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({ type: "idle" });

  async function handleActivate() {
    // Round-15 audit finding (Red Agent R): the Activate BUTTON's `disabled` attribute
    // guards against a double mouse-click, but the license-key input's onKeyDown handler
    // (app/settings/page.tsx) calls handleActivate() on every Enter keypress unconditionally
    // — no OS key-repeat needed, just two ordinary taps before the first round-trip resolves.
    // Two concurrent activateLicense() calls with the same key can both succeed against
    // Lemon Squeezy (each registering a distinct instance), silently consuming two of the
    // license's finite activation seats for what the user believes was one activation.
    if (licenseStatus.type === "loading") return;
    const key = licenseInput.trim();
    if (!key) return;
    // Local validation before IPC — LS keys are alphanumeric+hyphens, max ~64 chars.
    // LICENSE_KEY_MAX_LENGTH is a generous cap; rejects megabyte-scale inputs before a
    // network round-trip.
    if (key.length > LICENSE_KEY_MAX_LENGTH || !LICENSE_KEY_PATTERN.test(key)) {
      setLicenseStatus({ type: "error", message: "Invalid license key format." });
      return;
    }
    setLicenseStatus({ type: "loading" });
    try {
      const result = await activateLicense(key);
      if (result.ok) {
        useEntitlementStore.getState().setEntitlement({
          licenseKey: result.licenseKey,
          instanceId: result.instanceId,
          licenseType: result.licenseType,
          unlockedPacks: result.unlockedPacks,
          validUntil: result.validUntil,
          // Task #430: activateLicense() just completed a real Lemon Squeezy round-trip —
          // this data IS freshly verified, so it earns a full validation grace period.
          lastValidated: Date.now(),
        });
        setLicenseInput("");
        setLicenseStatus({ type: "success", message: "License activated." });
      } else {
        setLicenseStatus({ type: "error", message: result.error });
      }
    } catch (err) {
      console.error(`[ERR-LICENSE-ACTIVATE-${Date.now()}] activateLicense threw unexpectedly`, err);
      setLicenseStatus({ type: "error", message: "Activation failed. Check your connection and try again." });
    }
  }

  async function handleValidate() {
    // Round-15 fix: same re-entrancy guard as handleActivate — the Re-validate button's
    // own `disabled` attribute only blocks a second mouse click, not a second call from
    // any other trigger before the first round-trip resolves.
    if (licenseStatus.type === "loading") return;
    // sev:6 fix — read from getState() instead of reactive state captured at mount time.
    // persist middleware may not have hydrated when the component first mounts.
    const { licenseKey, instanceId, markValidated } = useEntitlementStore.getState();
    if (!licenseKey || !instanceId) return;
    setLicenseStatus({ type: "loading" });
    try {
      const result = await validateLicense(licenseKey, instanceId);
      if (result.ok) {
        markValidated(result.validUntil);
        setLicenseStatus({ type: "success", message: "License is valid." });
      } else {
        setLicenseStatus({ type: "error", message: result.error });
      }
    } catch (err) {
      console.error(`[ERR-LICENSE-VALIDATE-${Date.now()}] validateLicense threw unexpectedly`, err);
      setLicenseStatus({ type: "error", message: "Validation failed. Check your connection and try again." });
    }
  }

  async function handleDeactivate() {
    // Round-15 fix: same re-entrancy guard as handleActivate/handleValidate.
    if (licenseStatus.type === "loading") return;
    // sev:6 fix — read from getState() at call time, not reactive state from mount.
    const { licenseKey, instanceId, clearEntitlement } = useEntitlementStore.getState();
    if (!licenseKey || !instanceId) return;
    setLicenseStatus({ type: "loading" });
    try {
      const result = await deactivateLicense(licenseKey, instanceId);
      if (!result.ok) {
        setLicenseStatus({ type: "error", message: result.error });
        return; // Do NOT clear entitlement — the license slot is still occupied
      }
      // Task #326: clearEntitlement returns a Promise so the specialty-content
      // memCache eviction is guaranteed to complete before this handler resolves.
      // Task #351: clearEntitlement rejects if any base-pack eviction fails. The license
      // IS deactivated (state reset is synchronous) — a rejection here means only that
      // cached specialty content may persist until the next page load.
      try {
        await clearEntitlement();
        setLicenseStatus({ type: "idle" });
      } catch (evictErr) {
        console.error(`[ERR-DEACTIVATE-EVICT-${Date.now()}] specialty-pack eviction failed after deactivation`, evictErr);
        setLicenseStatus({ type: "error", message: "Deactivated. Restart the app to clear cached content." });
      }
    } catch (err) {
      console.error(`[ERR-LICENSE-DEACTIVATE-${Date.now()}] deactivateLicense threw unexpectedly`, err);
      setLicenseStatus({ type: "error", message: "Deactivation failed. Check your connection and try again." });
    }
  }

  return { licenseInput, setLicenseInput, licenseStatus, setLicenseStatus, handleActivate, handleValidate, handleDeactivate };
}
