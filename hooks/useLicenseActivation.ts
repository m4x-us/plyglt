"use client";

import { useState } from "react";
import { useEntitlementStore } from "@/store/entitlementStore";
import { activateLicense, deactivateLicense, validateLicense } from "@/lib/entitlement";

export type LicenseStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function useLicenseActivation() {
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({ type: "idle" });

  async function handleActivate() {
    if (!licenseInput.trim()) return;
    setLicenseStatus({ type: "loading" });
    try {
      const result = await activateLicense(licenseInput);
      if (result.ok) {
        useEntitlementStore.getState().setEntitlement({
          licenseKey: result.licenseKey,
          instanceId: result.instanceId,
          licenseType: result.licenseType,
          unlockedPacks: result.unlockedPacks,
          validUntil: result.validUntil,
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
      clearEntitlement();
      setLicenseStatus({ type: "idle" });
    } catch (err) {
      console.error(`[ERR-LICENSE-DEACTIVATE-${Date.now()}] deactivateLicense threw unexpectedly`, err);
      setLicenseStatus({ type: "error", message: "Deactivation failed. Check your connection and try again." });
    }
  }

  return { licenseInput, setLicenseInput, licenseStatus, setLicenseStatus, handleActivate, handleValidate, handleDeactivate };
}
