"use client";

// ============================================================
// UpdateChecker.tsx — Invisible background update-check component
// ============================================================
// DEPENDS ON: @/lib/tauri (isTauri, checkForUpdates)
// USED BY: components/EntitlementValidator.tsx
// ============================================================

import { useEffect } from "react";
import { isTauri, checkForUpdates } from "@/lib/tauri";

/** Invisible component. On mount in a Tauri environment, checks for an available app update.
 *  Never auto-installs — callers must invoke result.install() after user confirmation.
 *  No-op in web builds and test environments (isTauri = false). */
export function UpdateChecker() {
  useEffect(() => {
    if (!isTauri) return;
    checkForUpdates()
      .then((result) => {
        if (result.available) {
          console.log(`[UPDATE_AVAILABLE-${Date.now()}]`, `v${result.version} is ready to install.`);
        }
      })
      .catch((err) => {
        console.error(`[ERR-UPDATE-CHECK-${Date.now()}] checkForUpdates failed unexpectedly:`, err);
      });
  }, []);

  return null;
}
