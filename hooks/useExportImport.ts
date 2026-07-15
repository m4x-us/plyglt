// ============================================================
// useExportImport.ts — Hook: export and import SRS/entitlement state as a JSON backup file
// ============================================================
"use client";

import { useRef, useState } from "react";
import { useSRSStore } from "@/store/srsStore";
import { useEntitlementStore } from "@/store/entitlementStore";
import { exportBackup } from "@/lib/exportBackup";
import { parseBackup } from "@/lib/importBackup";
import { getLangPair } from "@/lib/constants"; // Task #340: route through canonical lib/constants accessor

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
          // Task #342: destructure only the fields accepted by setEntitlement's type contract.
          // purchasedAddOns is intentionally excluded — add-on purchases require server-verified
          // receipts via purchaseAddOn(); they cannot be restored from an unsigned backup file.
          const { licenseKey, instanceId, licenseType, unlockedPacks, validUntil } = result.entitlement;
          if (licenseKey && instanceId) {
            useEntitlementStore.getState().setEntitlement({ licenseKey, instanceId, licenseType, unlockedPacks, validUntil });
          }
          const skippedNote = result.skippedCardCount > 0
            ? ` (${result.skippedCardCount} card(s) skipped — corrupted data)`
            : "";
          setDataStatus({ type: "success", message: `Restored ${result.validCardCount} card(s) of progress.${skippedNote}` });
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
