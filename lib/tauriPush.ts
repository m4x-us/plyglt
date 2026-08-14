// ============================================================
// tauriPush.ts — gateway for the iOS APNs push IPC commands (Task #522)
// ============================================================
// Thin wrapper over src-tauri/src/push.rs's three commands and three events,
// following lib/tauriInterrupt.ts's single-gateway pattern. Event names must
// stay in sync with push.rs's EVENT_* constants — they are the wire contract.
//
// Platform gating lives in Rust, not here: register_for_push_notifications
// returns false on every non-iOS platform (and lib/tauri.ts's invoke returns
// null outside Tauri entirely), so callers need no user-agent sniffing.
// ============================================================
// DEPENDS ON: lib/tauri.ts (invoke, listen)
// USED BY: hooks/usePushRegistration.ts, hooks/usePushInterruptTap.ts
// ============================================================

import { invoke, listen } from "@/lib/tauri";

export const PUSH_TOKEN_EVENT = "push:device-token";
export const PUSH_TAP_EVENT = "push:notification-tapped";
export const PUSH_REGISTRATION_FAILED_EVENT = "push:registration-failed";

/**
 * Starts APNs registration. Resolves true when registration was actually
 * kicked off (iOS only) — false means "not this platform", not an error.
 */
export async function registerForPushNotifications(): Promise<boolean> {
  return (await invoke<boolean>("register_for_push_notifications")) ?? false;
}

/** The APNs token the OS already delivered this launch, if any. */
export async function getPushToken(): Promise<string | null> {
  return (await invoke<string | null>("get_push_token")) ?? null;
}

/**
 * Consumes the native pending-tap flag. True exactly once per un-drained
 * push-notification tap — the cold-start half of tap routing, mirroring
 * getCurrentDeepLinkUrls in hooks/useInterruptDeepLink.ts.
 */
export async function takePendingPushTap(): Promise<boolean> {
  return (await invoke<boolean>("take_pending_push_tap")) ?? false;
}

/** Subscribe to APNs token delivery. Returns an unlisten function. */
export async function onPushToken(handler: (token: string) => void): Promise<() => void> {
  return listen<string>(PUSH_TOKEN_EVENT, handler);
}

/** Subscribe to warm-start push-notification taps. Returns an unlisten function. */
export async function onPushTap(handler: () => void): Promise<() => void> {
  return listen<string>(PUSH_TAP_EVENT, () => handler());
}
