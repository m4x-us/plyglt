// ============================================================
// InterruptHandler.tsx — Root-layout component: subscribes to Tauri interrupt and tray events
// ============================================================
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isTauri, listen, enterMandatoryMode, updateInterruptConfig } from "@/lib/tauri";
import { useSettingsStore, isInDnd } from "@/store/settingsStore";
import { useSRSStore } from "@/store/srsStore";
import { useLangPack } from "@/hooks/useLangPack";
import { useEntitlementStore } from "@/store/entitlementStore";
import { validateLicense } from "@/lib/entitlement";
import { getFeatureFlags } from "@/lib/featureFlags";

/** Mounted in the root layout. Returns null immediately when the interrupt engine flag is off. */
export function InterruptHandler() {
  const flags = getFeatureFlags();
  if (!flags.interruptEngine) return null;
  return <InterruptHandlerCore />;
}

/** Inner component — only mounts when interruptEngine flag is on. */
function InterruptHandlerCore() {
  const router = useRouter();
  const { units } = useLangPack();
  const pathname = usePathname();
  const { interruptEnabled, intervalHours, mandatory, dndStart, dndEnd } =
    useSettingsStore();

  // Keep the Rust thread in sync whenever relevant settings change.
  useEffect(() => {
    updateInterruptConfig(interruptEnabled, intervalHours, mandatory).catch((err) => {
      console.error(`[ERR-IPC-CONFIG-${Date.now()}] Failed to sync interrupt config:`, err);
    });
  }, [interruptEnabled, intervalHours, mandatory]);

  // Silently re-validate subscriptions on every app launch (not just when settings page opens).
  const { licenseKey, instanceId, needsValidation, markValidated } = useEntitlementStore();
  useEffect(() => {
    if (!needsValidation() || !licenseKey || !instanceId) return;
    validateLicense(licenseKey, instanceId)
      .then((r) => {
        if (r.ok) markValidated(r.validUntil);
      })
      .catch((err) => {
        console.error(`[ERR-VALIDATE-${Date.now()}] Background license validation failed:`, err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — one check per mount, not on every store change

  // Subscribe to interrupt:fire events.
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    listen<boolean>("interrupt:fire", async (isMandatory) => {
      if (!interruptEnabled) return;
      if (isInDnd(dndStart, dndEnd)) return;

      // Don't interrupt a study session already in progress.
      if (pathname.startsWith("/study")) return;

      // units.length === 0 means the language pack hasn't loaded yet — skip interrupt
      const totalDue = units.length === 0 ? 0 : units.reduce(
        (sum, u) => sum + useSRSStore.getState().getStats(u.cards).due,
        0
      );
      if (totalDue === 0) return;

      if (isMandatory) {
        await enterMandatoryMode();
        router.push("/study?mode=interrupt");
      } else {
        // Passive: system notification — import dynamically so web builds tree-shake it.
        try {
          const { isPermissionGranted, requestPermission, sendNotification } =
            await import("@tauri-apps/plugin-notification");
          let granted = await isPermissionGranted();
          if (!granted) {
            granted = (await requestPermission()) === "granted";
          }
          if (granted) {
            sendNotification({
              title: "plyglt",
              body: `${totalDue} card${totalDue === 1 ? "" : "s"} ready — 2 min study break?`,
            });
          }
        } catch (err) {
          console.error(`[ERR-NOTIF-${Date.now()}] Notification plugin error:`, err);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    }).catch((err) => console.error(`[ERR-LISTEN-INTERRUPT-${Date.now()}] Failed to subscribe to interrupt:fire:`, err));

    return () => unlisten?.();
  }, [interruptEnabled, dndStart, dndEnd, pathname, router, units]);

  // Tray "Study Now" menu item → navigate to a global study session
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    listen<null>("tray:study", () => {
      router.push("/study?mode=global");
    }).then(fn => { unlisten = fn; }).catch((err) => console.error(`[ERR-LISTEN-TRAY-${Date.now()}] Failed to subscribe to tray:study:`, err));
    return () => unlisten?.();
  }, [router]);

  return null;
}
