/**
 * useNotificationPermission — extracted from app/settings/page.tsx (Task #166 debt,
 * 2026-08-13) to keep that route under CLAUDE.md's 150-line cap, same pattern as
 * hooks/useSnoozeAndExit.ts and hooks/useInterruptConfig.ts.
 *
 * Owns the notification-permission state and the interrupt-toggle handler that must
 * check/request that permission before turning reminders on. On Tauri, checks/requests
 * through lib/tauri.ts's native gateway (components/InterruptHandler.tsx sends through
 * the same one) rather than the browser Notification Web API, which reads a separate,
 * unrelated permission system that can read "denied" inside a Tauri webview even when
 * the real, relevant permission is grantable (found live on Windows, Task #166).
 */
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { isTauri, isNotificationPermissionGranted, requestNotificationPermission } from "@/lib/tauri";

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export function useNotificationPermission() {
  const setInterruptEnabled = useSettingsStore((s) => s.setInterruptEnabled);
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>("unsupported");

  useEffect(() => {
    if (isTauri) {
      isNotificationPermissionGranted().then((granted) => {
        setNotifPermission(granted ? "granted" : "default");
      });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);

  async function handleInterruptToggle(v: boolean) {
    if (!v) { setInterruptEnabled(false); return; }
    if (notifPermission === "denied") return;
    if (notifPermission === "default") {
      const result = isTauri
        ? (await requestNotificationPermission())
        : typeof Notification !== "undefined"
          ? await Notification.requestPermission()
          : "denied";
      setNotifPermission(result);
      if (result === "granted") setInterruptEnabled(true);
      return;
    }
    setInterruptEnabled(true);
  }

  return { notifPermission, handleInterruptToggle };
}
