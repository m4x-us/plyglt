// ============================================================
// usePushRegistration.ts — iOS APNs registration + token upload (Task #522)
// ============================================================
// When a signed-in Pro user has interrupts enabled AND has already granted
// notification permission, kick off APNs registration (a no-op returning false
// on every non-iOS platform — the platform gate lives in src-tauri/src/push.rs,
// not in user-agent sniffing here) and upload the OS-issued device token to
// Supabase via lib/pushTokenClient.ts's registerPushToken(), the row the
// send-interrupt-notifications edge function dispatches to.
//
// Permission is deliberately NOT requested here: the settings interrupt toggle
// (hooks/useNotificationPermission.ts) owns the permission prompt, so the OS
// dialog appears in response to an explicit user action, never on mount.
// `interruptEnabled` is a dependency precisely so that granting permission via
// that toggle re-runs this effect in the same session.
//
// deviceId comes from store/syncStore.ts's one-time snapshot (same pattern as
// hooks/useSnoozeAndExit.ts). It is generated lazily on the first synced review
// — if it doesn't exist yet, registration is skipped this run and picked up on
// a later launch; a Pro user's first review creates it within the first session.
// ============================================================
// DEPENDS ON: lib/tauri.ts, lib/tauriPush.ts, lib/pushTokenClient.ts,
//             lib/featureFlags.ts, store/authStore.ts, store/entitlementStore.ts,
//             store/settingsStore.ts, store/syncStore.ts
// USED BY: components/InterruptHandler.tsx
// ============================================================
"use client";

import { useEffect } from "react";
import { isTauri, isNotificationPermissionGranted } from "@/lib/tauri";
import {
  getPushToken,
  onPushToken,
  registerForPushNotifications,
} from "@/lib/tauriPush";
import { registerPushToken } from "@/lib/pushTokenClient";
import { getFeatureFlags, isProEnabled } from "@/lib/featureFlags";
import { useAuthStore } from "@/store/authStore";
import { useEntitlementStore } from "@/store/entitlementStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSyncStore } from "@/store/syncStore";

export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.userId);
  const licenseType = useEntitlementStore((s) => s.licenseType);
  const validUntil = useEntitlementStore((s) => s.validUntil);
  const interruptEnabled = useSettingsStore((s) => s.interruptEnabled);

  useEffect(() => {
    if (!isTauri || !userId || !interruptEnabled) return;
    if (!isProEnabled(getFeatureFlags().interruptEngine, licenseType, validUntil)) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    async function uploadToken(token: string) {
      // userId is captured non-null by the guard above; assert for the closure.
      if (!userId) return;
      const deviceId = useSyncStore.getState().deviceId;
      if (!deviceId) return; // no sync identity yet — see header
      const result = await registerPushToken({
        userId,
        platform: "ios",
        deviceId,
        token,
        // Debug/dev builds are signed with aps-environment=development, which
        // routes through Apple's sandbox APNs; TestFlight/App Store signing
        // rewrites the entitlement to production. NODE_ENV mirrors that split:
        // the static export used by `tauri ios build` is a production build.
        appEnv: process.env.NODE_ENV === "production" ? "production" : "sandbox",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!result.ok) {
        console.error(`[ERR-PUSHREG-UPLOAD-${Date.now()}] push token upload failed: ${result.error}`);
      }
    }

    (async () => {
      // Registration without permission would produce a token nobody can be
      // alerted through — wait for the settings toggle's grant instead.
      const granted = await isNotificationPermissionGranted();
      if (!granted || cancelled) return;

      const supported = await registerForPushNotifications();
      if (!supported || cancelled) return;

      unlisten = await onPushToken((token) => {
        void uploadToken(token);
      });

      // The OS may have delivered the token before the listener attached
      // (registration is idempotent across launches and tokens are cached
      // Rust-side) — upload the cached one too; the upsert makes this safe.
      const existing = await getPushToken();
      if (existing && !cancelled) void uploadToken(existing);
    })().catch((err) => {
      console.error(`[ERR-PUSHREG-${Date.now()}] APNs registration flow failed:`, err);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [userId, licenseType, validUntil, interruptEnabled]);
}
