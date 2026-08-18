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

// Module-scope, not per-render: uses no effect-closure state — reads deviceId fresh off
// useSyncStore.getState() every call — so both usePushRegistration's effects below (the
// gate-failure branch and the true-unmount-only cleanup) can share one implementation.
//
// `expectedNonce` (round-18 audit fix): passed through to unregisterPushToken's own
// compare-and-swap delete — see that function's doc comment in lib/pushTokenClient.ts.
// `notUpdatedSince` (round-18 audit fix, second finding): the fallback timestamp guard
// used ONLY when no nonce is known — see the gate-failure branch's own call site and
// unregisterPushToken's doc comment for the full reasoning.
async function unregisterFor(targetUserId: string, expectedNonce?: string, notUpdatedSince?: string): Promise<void> {
  const deviceId = useSyncStore.getState().deviceId;
  if (!deviceId) return;
  const result = await unregisterPushToken(targetUserId, deviceId, expectedNonce, notUpdatedSince);
  if (!result.ok) console.error(`[ERR-PUSHREG-UNREGISTER-${Date.now()}] push token cleanup failed: ${result.error}`);
}

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
  // renders AND across the true-unmount-only cleanup below. Needed because neither the
  // gate-failure branch nor that cleanup can trust the CURRENT `userId` closure value to
  // still identify who was registered — a sign-out sets it to null before the effect
  // re-runs (Agent K), and components/InterruptHandler.tsx's OWN Pro-gate unmounts this
  // whole hook in the SAME commit a licenseType/validUntil change makes gateOk false,
  // before the multi-dep effect body ever gets a chance to re-run and reach the branch
  // below (Agent A/B/W). Round 16 split the true-unmount cleanup into its own empty-deps
  // effect (see below) — this ref is what lets that separate effect still know who to
  // unregister without its own closure ever having seen a live userId. `nonce` (round-18
  // audit fix) is this specific registration attempt's own compare-and-swap identifier —
  // see unregisterPushToken's doc comment in lib/pushTokenClient.ts for why the token
  // value itself cannot serve this purpose (device tokens are stable per install, not
  // per registration attempt, so two racing registrations often share the same token).
  const registeredForRef = useRef<{ userId: string; deviceId: string; nonce: string } | null>(null);

  // Round-17 audit finding (Agent W): if uploadToken's registerPushToken() call is still
  // in flight when this hook instance's effect is torn down (a real network round-trip,
  // easily still pending seconds after mount), whichever cleanup runs first can find
  // registeredForRef.current still null and no-op; when the registration THEN resolves,
  // uploadToken must self-clean the row it just created instead of writing to the ref —
  // see uploadToken's own `if (cancelled)` branch below, which round 18 broadened from
  // round 17's narrower unmount-only check (see that branch's comment for why).
  useEffect(() => {
    if (!isTauri) return;
    if (!entitlementHydrated || !settingsHydrated) return;

    const gateOk = !!userId && interruptEnabled && isProEnabled(getFeatureFlags().interruptEngine, licenseType, validUntil);

    if (!gateOk) {
      // Prefer whoever we know was actually registered this session (ref — correct even
      // if `userId` has since gone null via sign-out); fall back to the CURRENT userId so
      // a genuinely-Free cold start still catches a stale row from a PRIOR app launch
      // (e.g. cancelled via the external customer portal while the app was fully closed).
      const target = registeredForRef.current?.userId ?? userId;
      const targetNonce = registeredForRef.current?.nonce;
      if (target) {
        registeredForRef.current = null;
        // Round-18 audit fix, second finding (8-way convergence: Security Agent S, Agent
        // V, Agent K, Agent N, Agent A, Agent W, Red Agent R, Agent B): when no ref exists
        // this session, there's no nonce to compare-and-swap against — but leaving this
        // delete fully unconditional (the original round-18 shape) let it race and silently
        // wipe a FRESH same-session registration. Concrete trigger (Agent A/B): a signed-in
        // Pro user's first mount with interruptEnabled=false fires this branch with no
        // ref/nonce; if the user then toggles interrupts on before this delete resolves,
        // the new registration's upsert can land first, and this stale unconditional
        // delete would otherwise wipe it. Capturing "now" synchronously, BEFORE firing,
        // and conditioning the delete on updated_at not having advanced since closes this
        // — see unregisterPushToken's own doc comment for the full reasoning. Only applies
        // when targetNonce is itself undefined; when a nonce IS known, that CAS is already
        // sufficient and this extra guard is redundant (harmless either way, since a nonce
        // match already proves the row hasn't been touched by anyone else).
        const notUpdatedSince = targetNonce === undefined ? new Date().toISOString() : undefined;
        void unregisterFor(target, targetNonce, notUpdatedSince);
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
      // Round-18 audit fix: a fresh nonce per registration attempt, independent of the
      // token value — see registeredForRef's own comment above for why the token can't
      // serve this purpose.
      const nonce = crypto.randomUUID();
      const result = await registerPushToken({
        userId,
        platform: "ios",
        deviceId,
        token,
        registrationNonce: nonce,
        // Debug/dev builds are signed with aps-environment=development, which
        // routes through Apple's sandbox APNs; TestFlight/App Store signing
        // rewrites the entitlement to production. NODE_ENV mirrors that split:
        // the static export used by `tauri ios build` is a production build.
        appEnv: process.env.NODE_ENV === "production" ? "production" : "sandbox",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!result.ok) {
        console.error(`[ERR-PUSHREG-UPLOAD-${Date.now()}] push token upload failed: ${result.error}`);
        return;
      }
      // Round-18 audit fix (Agent B, "ghost registration" finding — deepens round 17's
      // trulyUnmountedRef fix): checking `cancelled` here (instead of the narrower,
      // unmount-only signal round 17 used) closes a second, distinct leak. `cancelled` is
      // set by THIS SAME effect run's own cleanup, which fires both on a true unmount AND
      // on an ordinary dep-change re-run (e.g. the user toggles interrupts off while this
      // registration is still in flight) — round 17's fix only caught the former. Without
      // this check, an in-flight registration that resolves after the user has ALREADY
      // opted out left a "ghost" row alive with no future cleanup opportunity — the newer
      // effect run's own gate-failure branch already ran and found nothing to unregister
      // (this ref was still null at that moment), so nothing else would ever catch it.
      // Self-cleaning here is safe in EVERY case, including the ordinary "dep changed but
      // gate is still true" case (e.g. a validUntil-only revalidation): it's scoped to
      // this exact attempt's own nonce, so it can only ever delete a row that still holds
      // that exact value — a newer effect run's own fresh registration (a different
      // nonce) is untouched regardless of resolution order, the same CAS guarantee
      // verified for the true-unmount cleanup below.
      if (cancelled) {
        void unregisterFor(userId, nonce);
        return;
      }
      registeredForRef.current = { userId, deviceId, nonce };
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
      // Round-16 fix: this cleanup used to also call unregisterFor(prev.userId) here — see
      // the dedicated empty-deps effect below for why that was wrong and where it moved.
    };
  }, [userId, licenseType, validUntil, interruptEnabled, entitlementHydrated, settingsHydrated]);

  // Round-16 audit finding (4-way convergence: Agent N, Security Agent S, Agent B, Red
  // Agent R): round 15 put the "must survive teardown" unregister inside the multi-dep
  // effect's cleanup above. React runs that cleanup before EVERY dependency-triggered
  // re-run, not only before a true unmount — so it fired on ordinary, expected transitions
  // this hook was never supposed to react to that way:
  //   1. A dep change that leaves gateOk TRUE (e.g. validUntil advancing on a routine
  //      background license revalidation while licenseType/interruptEnabled stay put) fired
  //      a real DELETE against a still-valid registration, immediately followed by the new
  //      effect run's own fresh upsert to re-create it. Nothing ordered the two network
  //      calls — if the DELETE resolved after the UPSERT, a fully entitled, unchanged Pro
  //      user's push registration was silently, permanently wiped.
  //   2. A dep change that flips gateOk TRUE->FALSE while still mounted (e.g. toggling
  //      interrupts off) fired this cleanup's unregister AND the gate-failure branch's own
  //      explicit unregister above in the same transition — one logical event, two DELETE
  //      calls, racing each other with no ordering guarantee either.
  // Fixed by moving the true-unmount-only unregister into its own effect with an empty
  // dependency array: an effect with no deps never re-runs — its cleanup fires exclusively
  // on a genuine unmount, so it can no longer fire alongside a still-mounted re-registration
  // or duplicate the gate-failure branch's own call.
  //
  // Round-18 audit fix (Agent W, deepened from the round-16/17 cross-instance debt row):
  // this call now passes prev.nonce through to unregisterFor's compare-and-swap delete —
  // a stale DELETE from THIS unmounting instance can resolve after a brand-new instance
  // (a fast Deactivate-then-Reactivate) has already re-registered the same
  // (userId, deviceId) pair, often with the identical OS-issued token (device tokens are
  // stable per install, not per registration attempt). Without the nonce, that late
  // DELETE would silently wipe the newer, still-valid registration. With it, the DELETE
  // only matches if the row's registration_nonce still equals what THIS instance wrote —
  // once a newer instance's own registerPushToken() call has overwritten it with a fresh
  // nonce, this becomes a harmless no-op instead.
  useEffect(() => {
    return () => {
      const prev = registeredForRef.current;
      if (prev) {
        registeredForRef.current = null;
        void unregisterFor(prev.userId, prev.nonce);
      }
    };
  }, []);
}
