// ============================================================
// usePushInterruptTap.ts — Routes an iOS push-notification tap to the study session (Task #522)
// ============================================================
// The native half (src-tauri/src/push.rs's UNUserNotificationCenter delegate
// proxy) records every push-triggered tap two ways: a "push:notification-tapped"
// event for a running webview (warm start) and a pending-tap flag for a tap that
// launched the app before any JS existed (cold start). This hook is the app-side
// half — drain both paths into the exact navigation every other interrupt entry
// point already uses (`router.push("/study?mode=interrupt")`), mirroring
// hooks/useInterruptDeepLink.ts's two-path structure precisely.
//
// After routing a warm tap, the native flag (which the delegate sets
// unconditionally, since it cannot know whether JS is listening) is drained too
// — otherwise a stale flag would mis-route the NEXT app launch into an
// interrupt session nobody asked for.
// ============================================================
// DEPENDS ON: lib/tauri.ts (isTauri), lib/tauriPush.ts (onPushTap, takePendingPushTap)
// USED BY: components/InterruptHandler.tsx
// ============================================================
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTauri } from "@/lib/tauri";
import { onPushTap, takePendingPushTap } from "@/lib/tauriPush";

export function usePushInterruptTap(): void {
  const router = useRouter();

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    onPushTap(() => {
      router.push("/study?mode=interrupt");
      // Drain the cold-start flag set by the same tap (see header).
      takePendingPushTap().catch((err) => {
        console.error(`[ERR-PUSHTAP-DRAIN-${Date.now()}] takePendingPushTap failed:`, err);
      });
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.error(`[ERR-PUSHTAP-SUBSCRIBE-${Date.now()}] Failed to subscribe to push taps:`, err);
      });

    takePendingPushTap()
      .then((pending) => {
        if (pending) router.push("/study?mode=interrupt");
      })
      .catch((err) => {
        console.error(`[ERR-PUSHTAP-COLDSTART-${Date.now()}] takePendingPushTap failed:`, err);
      });

    return () => unlisten?.();
  }, [router]);
}
