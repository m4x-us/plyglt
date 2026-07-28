// ============================================================
// useExportImport.ts — Hook: export and import SRS/entitlement state as a JSON backup file
// ============================================================
"use client";

import { useRef, useState } from "react";
import { useSRSStore } from "@/store/srsStore";
import { useEntitlementStore } from "@/store/entitlementStore";
import { exportBackup } from "@/lib/exportBackup";
import { parseBackup, type BackupEntitlement } from "@/lib/importBackup";
import { getLangPair } from "@/lib/constants"; // Task #340: route through canonical lib/constants accessor

// Task #440: purchasedAddOns cannot be restored from an unsigned backup file — add-on
// purchases require a server-verified receipt via purchaseAddOn(). Previously this was
// enforced only by readFile's manual choice of which fields to destructure from
// result.entitlement — a future call site writing `setEntitlement({...result.entitlement,
// licenseKey, instanceId})` would silently reintroduce it (an abandoned worktree found
// during the audit already shows exactly this regression in a copy of the code).
// RestorableEntitlement/excludePurchasedAddOns make the exclusion structural: the field is
// omitted via destructuring (not a positive field allowlist), so it survives
// BackupEntitlement gaining new fields, and its TYPE genuinely lacks purchasedAddOns —
// spreading the result can never reintroduce it, unlike spreading BackupEntitlement itself
// (which would bypass TypeScript's excess-property check on object-literal spreads).
export type RestorableEntitlement = Omit<BackupEntitlement, "purchasedAddOns">;

export function excludePurchasedAddOns(entitlement: BackupEntitlement): RestorableEntitlement {
  const { purchasedAddOns: _purchasedAddOns, ...restorable } = entitlement;
  return restorable;
}

export type DataStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function useExportImport() {
  const importRef = useRef<HTMLInputElement>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>({ type: "idle" });

  function handleExport() {
    const srs = useSRSStore.getState();
    const entitlement = useEntitlementStore.getState();
    const langPair = getLangPair(); // Task #340: no direct localStorage access outside lib/constants
    const payload = exportBackup(
      { cards: srs.cards, streak: srs.streak, lastStudiedDate: srs.lastStudiedDate },
      {
        licenseKey:      entitlement.licenseKey,
        instanceId:      entitlement.instanceId,
        licenseType:     entitlement.licenseType,
        unlockedPacks:   entitlement.unlockedPacks,
        validUntil:      entitlement.validUntil,
        purchasedAddOns: entitlement.purchasedAddOns,
      },
      langPair
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plyglt-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataStatus({ type: "success", message: "Progress exported — check your Downloads folder." });
  }

  function readFile(file: File): Promise<void> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = (event) => {
        const domError = (event.target as FileReader).error;
        console.error(`[ERR-IMPORT-FILEREADER-${Date.now()}]`, domError);
        setDataStatus({ type: "error", message: "Could not read the file." });
        if (importRef.current) importRef.current.value = "";
        resolve();
      };
      reader.onload = () => {
        try {
          const result = parseBackup(JSON.parse(reader.result as string));
          if (!result.ok) {
            setDataStatus({ type: "error", message: result.error });
            if (importRef.current) importRef.current.value = "";
            resolve();
            return;
          }
          const activeLangPair = getLangPair(); // Task #340: no direct localStorage access outside lib/constants
          if (result.langPair !== activeLangPair) {
            setDataStatus({
              type: "error",
              message: `This backup is for ${result.langPair} but you are studying ${activeLangPair}. Switch languages first, then import.`,
            });
            if (importRef.current) importRef.current.value = "";
            resolve();
            return;
          }
          useSRSStore.setState({ ...result.srs, activeSession: null });
          // Task #342/#440: purchasedAddOns is structurally excluded here (see
          // excludePurchasedAddOns above) — add-on purchases require server-verified
          // receipts via purchaseAddOn(); they cannot be restored from an unsigned backup file.
          const restorableEntitlement = excludePurchasedAddOns(result.entitlement);
          const { licenseKey, instanceId } = restorableEntitlement;
          // Task #391: a backup without both licenseKey and instanceId cannot restore a license —
          // setEntitlement's contract requires both. Deliberately keep the session's current
          // entitlement untouched (an unsigned backup file must never downgrade an active
          // license), but say so in the status message instead of silently reporting only the
          // card restore. tests/seam_importRestore.test.ts (#393, next wave) asserts this seam.
          let licenseRestored = false;
          if (licenseKey && instanceId) {
            // Task #430: a backup file is unsigned, untrusted input — it was never verified
            // against the real license server (unlike a genuine activateLicense() success).
            // lastValidated: 0 makes needsValidation() true immediately, so
            // components/EntitlementValidator.tsx re-validates against Lemon Squeezy on the
            // next app foreground instead of trusting these restored fields for a full
            // VALIDATION_POLL_INTERVAL_MS grace period with zero server contact.
            // Spreading restorableEntitlement here (rather than listing fields by name) is
            // safe by construction — its TYPE lacks purchasedAddOns, so this can never
            // reintroduce it even as the call site evolves (#440). licenseKey/instanceId are
            // re-listed only to narrow them from string|null to the string the if-guard above
            // already proved.
            useEntitlementStore.getState().setEntitlement({ ...restorableEntitlement, licenseKey, instanceId, lastValidated: 0 });
            licenseRestored = true;
          }
          const skippedNote = result.skippedCardCount > 0
            ? ` (${result.skippedCardCount} card(s) skipped — corrupted data)`
            : "";
          const licenseNote = licenseRestored ? "" : " No license in backup — license unchanged.";
          setDataStatus({ type: "success", message: `Restored ${result.validCardCount} card(s) of progress.${skippedNote}${licenseNote}` });
        } catch (e) {
          console.error(`[ERR-IMPORT-PARSE-${Date.now()}]`, e);
          setDataStatus({ type: "error", message: "Could not read the file — is it a valid backup?" });
        }
        if (importRef.current) importRef.current.value = "";
        resolve();
      };
      reader.readAsText(file);
    });
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  }

  return { importRef, dataStatus, handleExport, handleImportFile, readFile };
}
