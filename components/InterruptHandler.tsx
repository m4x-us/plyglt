// ============================================================
// InterruptHandler.tsx — Root-layout component: subscribes to Tauri interrupt and tray events
// ============================================================
"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isTauri, listen, isNotificationPermissionGranted, requestNotificationPermission, sendNativeNotification } from "@/lib/tauri";
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

  // Always-current snapshot the interrupt:fire handler below reads at call time, so the
  // subscription effect can subscribe once instead of re-subscribing on every dependency
  // change. Task #166 Windows VM investigation (2026-08-12): lib/tauri.ts's listen() is an
  // async IPC round-trip to register with the Rust side — tearing down the old listener and
  // awaiting a new one on every pathname/settings change (the old deps array below) left a
  // real window with NO listener registered. Rust's emit_interrupt is fire-and-forget
  // (app.emit, no queueing/retry), so an interrupt:fire landing in that window was silently,
  // permanently dropped. Both reproduced VM failures navigated /study -> / (a pathname
  // change) immediately before locking — exactly the trigger for this gap.
  // router is included here too, deliberately NOT relied on as a stable dependency of the
  // subscription effect below — App Router's useRouter() is stable in production, but that
  // is exactly the kind of referential-stability assumption this fix exists to stop making.
  const latestRef = useRef({ interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router });
  useEffect(() => {
    latestRef.current = { interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router };
  }, [interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router]);

  // Subscribe to interrupt:fire events exactly once, for the component's whole lifetime —
  // see latestRef above for why this must never re-subscribe on a dependency change.
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    listen<boolean>("interrupt:fire", async (isMandatory) => {
      const { interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router } = latestRef.current;
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
        // Passive: system notification, via lib/tauri.ts's single gateway (Task #166
        // live-testing fix, 2026-08-10) — was previously importing
        // @tauri-apps/plugin-notification directly, the exact CLAUDE.md-forbidden
        // pattern that let this permission check drift out of sync with
        // app/settings/page.tsx's own (separate, wrong) permission check.
        try {
          let granted = await isNotificationPermissionGranted();
          if (!granted) {
            granted = (await requestNotificationPermission()) === "granted";
          }
          if (granted) {
            await sendNativeNotification(
              "plyglt",
              `${totalDue} card${totalDue === 1 ? "" : "s"} ready — 2 min study break?`
            );
          }
        } catch (err) {
          console.error(`[ERR-NOTIF-${Date.now()}] Notification plugin error:`, err);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    }).catch((err) => console.error(`[ERR-LISTEN-INTERRUPT-${Date.now()}] Failed to subscribe to interrupt:fire:`, err));

    return () => unlisten?.();
  }, []);

  // Tray "Study Now" menu item → navigate to a global study session. Reads router via
  // latestRef (not a direct closure) for the same reason as the interrupt:fire subscription
  // above — subscribes once, never re-registers on a router reference change.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    listen<null>("tray:study", () => {
      latestRef.current.router.push("/study?mode=global");
    }).then(fn => { unlisten = fn; }).catch((err) => console.error(`[ERR-LISTEN-TRAY-${Date.now()}] Failed to subscribe to tray:study:`, err));
    return () => unlisten?.();
  }, []);

  return null;
}
