// ============================================================
// InterruptHandler.tsx — Root-layout component: subscribes to Tauri interrupt and tray events
// ============================================================
"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isTauri, listen } from "@/lib/tauri";
import { enterMandatoryMode, updateInterruptConfig } from "@/lib/tauriInterrupt";
import { useInterruptConfig, isInDnd } from "@/hooks/useInterruptConfig";
import { useInterruptDeepLink } from "@/hooks/useInterruptDeepLink";
import { useLangPack } from "@/hooks/useLangPack";
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
  const {
    interruptEnabled,
    intervalHours,
    mandatory,
    dndStart,
    dndEnd,
    wakeEnabled,
    unlockEnabled,
    idleEnabled,
    idleThresholdMinutes,
    computeDue,
  } = useInterruptConfig();

  // Task #171: a mobile push notification tap opens plyglt://interrupt — route it
  // to the same study session desktop's own interrupt entry points use below.
  useInterruptDeepLink();

  // Sequence counter: each effect run claims a new seq. If a stale IPC call resolves
  // after a newer one has started, its resolution is ignored — only the latest write wins.
  // Guards against rapid toggle races where an older in-flight call could revert Rust state.
  const configSeqRef = useRef(0);

  // Keep the Rust thread in sync whenever relevant settings change.
  useEffect(() => {
    const seq = ++configSeqRef.current;
    updateInterruptConfig(
      interruptEnabled,
      intervalHours,
      mandatory,
      wakeEnabled,
      unlockEnabled,
      idleEnabled,
      idleThresholdMinutes,
    ).catch((err) => {
      if (seq !== configSeqRef.current) return; // stale — a newer write is in flight
      console.error(`[ERR-IPC-CONFIG-${Date.now()}] Failed to sync interrupt config:`, err);
    });
  }, [interruptEnabled, intervalHours, mandatory, wakeEnabled, unlockEnabled, idleEnabled, idleThresholdMinutes]);

  // Subscribe to interrupt:fire events.
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    listen<boolean>("interrupt:fire", async (isMandatory) => {
      if (!interruptEnabled) return;
      if (isInDnd(dndStart, dndEnd)) return;

      // Don't interrupt a study session already in progress.
      if (pathname.startsWith("/study")) return;

      const totalDue = computeDue(units);
      if (totalDue === 0) return;

      if (isMandatory) {
        try {
          await enterMandatoryMode();
        } catch (e) {
          // IPC failure means the window won't be locked, but the study session
          // must still open — a soft-lock is better than a silent no-op.
          console.error(`[IH-MANDATORY-${Date.now()}] enterMandatoryMode IPC failed — window not locked`, e);
        }
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
  }, [interruptEnabled, dndStart, dndEnd, pathname, router, units, computeDue]);

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
