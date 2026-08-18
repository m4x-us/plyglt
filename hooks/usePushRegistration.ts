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

import { useEffect, useRef } from "react";
import { isTauri, isNotificationPermissionGranted } from "@/lib/tauri";
import {
  getPushToken,
  onPushToken,
  registerForPushNotifications,
} from "@/lib/tauriPush";
import { registerPushToken, unregisterPushToken } from "@/lib/pushTokenClient";
import { getFeatureFlags, isProEnabled } from "@/lib/featureFlags";
import { useIsHydrated } from "@/lib/storage";
import { useAuthStore } from "@/store/authStore";
import { useEntitlementStore } from "@/store/entitlementStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSyncStore } from "@/store/syncStore";

export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.userId);
  const licenseType = useEntitlementStore((s) => s.licenseType);
  const validUntil = useEntitlementStore((s) => s.validUntil);
  const interruptEnabled = useSettingsStore((s) => s.interruptEnabled);
  // Round-15 audit finding (Agent S): entitlementStore and settingsStore hydrate
  // independently via separate Tauri IPC loads (lib/storage.ts) — interruptEnabled's
  // pre-hydration default (false) can make a real Pro+enabled user look gate-failed for
  // one render, which was enough to fire a real unregisterPushToken DELETE before this fix.
  const entitlementHydrated = useIsHydrated(useEntitlementStore);
  const settingsHydrated = useIsHydrated(useSettingsStore);

  // Round-15 audit finding (3-way convergence: Agent A, B, K, sharpened by Agent W):
  // persists the (userId, deviceId) this hook instance actually registered, across
  // renders AND across the unmount this effect's own cleanup runs in. Needed because
  // neither the gate-failure branch nor the effect cleanup can trust the CURRENT `userId`
  // closure value to still identify who was registered — a sign-out sets it to null before
  // cleanup runs (Agent K), and components/InterruptHandler.tsx's OWN Pro-gate unmounts
  // this whole hook in the SAME commit a licenseType/validUntil change makes gateOk false,
  // before the effect body ever gets a chance to re-run and reach the branch below
  // (Agent A/B/W) — the effect's cleanup function, which DOES still fire on unmount, is
  // the only place code can run in that case.
  const registeredForRef = useRef<{ userId: string; deviceId: string } | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    if (!entitlementHydrated || !settingsHydrated) return;

    const gateOk = !!userId && interruptEnabled && isProEnabled(getFeatureFlags().interruptEngine, licenseType, validUntil);

    async function unregisterFor(targetUserId: string) {
      const deviceId = useSyncStore.getState().deviceId;
      if (!deviceId) return;
      const result = await unregisterPushToken(targetUserId, deviceId);
      if (!result.ok) console.error(`[ERR-PUSHREG-UNREGISTER-${Date.now()}] push token cleanup failed: ${result.error}`);
    }

    if (!gateOk) {
      // Prefer whoever we know was actually registered this session (ref — correct even
      // if `userId` has since gone null via sign-out); fall back to the CURRENT userId so
      // a genuinely-Free cold start still catches a stale row from a PRIOR app launch
      // (e.g. cancelled via the external customer portal while the app was fully closed).
      const target = registeredForRef.current?.userId ?? userId;
      if (target) {
        registeredForRef.current = null;
        void unregisterFor(target);
      }
      return;
    }

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
      } else {
        registeredForRef.current = { userId, deviceId };
      }
    }

    (async () => {
      // Registration without permission would produce a token nobody can be
      // alerted through — wait for the settings toggle's grant instead.
      const granted = await isNotificationPermissionGranted();
      if (!granted || cancelled) return;

      const supported = await registerForPushNotifications();
      if (!supported || cancelled) return;

      // Round-12 audit finding (Agent W): onPushToken (lib/tauriPush.ts) wraps lib/tauri.ts's
      // listen(), a real async Tauri IPC round-trip (see components/InterruptHandler.tsx's
      // Task #166 comment on the same primitive) — there is a genuine window between this
      // await resolving and the check below where cleanup could already have run. Before this
      // fix, the returned unlisten was assigned to the outer `unlisten` unconditionally, so a
      // dep change (sign-out, license downgrade, toggling interruptEnabled) mid-await left
      // `unlisten` still undefined when cleanup ran (a no-op), then this async IIFE resumed
      // and registered a live listener AFTER teardown — permanently leaked, closing over this
      // effect run's now-stale `userId` and silently uploading every future token event under
      // the wrong/signed-out user. Mirrors the `!cancelled` check already used for getPushToken
      // below.
      const un = await onPushToken((token) => {
        void uploadToken(token);
      });
      if (cancelled) {
        un();
        return;
      }
      unlisten = un;

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
      // Round-15 fix: see registeredForRef's own comment above — this is the only place
      // code can run when a licenseType/validUntil change unmounts this hook's parent in
      // the same commit, before the branch above ever gets to run again.
      const prev = registeredForRef.current;
      if (prev) {
        registeredForRef.current = null;
        void unregisterFor(prev.userId);
      }
    };
  }, [userId, licenseType, validUntil, interruptEnabled, entitlementHydrated, settingsHydrated]);
}
