// ============================================================
// InterruptHandler.tsx — Root-layout component: subscribes to Tauri interrupt and tray events
// ============================================================
"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isTauri, listen, isNotificationPermissionGranted, requestNotificationPermission, sendNativeNotification } from "@/lib/tauri";
import { enterMandatoryMode, markInterruptFired, updateInterruptConfig } from "@/lib/tauriInterrupt";
import { readInterruptGateState, recordInterruptGateEvent } from "@/lib/interruptGate";
import { useInterruptConfig, isInDnd } from "@/hooks/useInterruptConfig";
import { useInterruptDeepLink } from "@/hooks/useInterruptDeepLink";
import { usePushInterruptTap } from "@/hooks/usePushInterruptTap";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useLangPack } from "@/hooks/useLangPack";
import { getFeatureFlags } from "@/lib/featureFlags";
import { INTERRUPT_SESSION_FLOOR, INTERRUPT_SESSION_CAP } from "@/lib/queue";

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
    userId,
    deviceId,
    computeDue,
  } = useInterruptConfig();

  // Task #171: a mobile push notification tap opens plyglt://interrupt — route it
  // to the same study session desktop's own interrupt entry points use below.
  useInterruptDeepLink();

  // Task #522 (iOS): native push-notification taps arrive via push.rs's delegate
  // proxy rather than a deep link — route them the same way, and register the
  // APNs device token with Supabase once permission + Pro + sign-in line up.
  usePushInterruptTap();
  usePushRegistration();

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
  const latestRef = useRef({ interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router, intervalHours, userId, deviceId });
  useEffect(() => {
    latestRef.current = { interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router, intervalHours, userId, deviceId };
  }, [interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router, intervalHours, userId, deviceId]);

  // Subscribe to interrupt:fire events exactly once, for the component's whole lifetime —
  // see latestRef above for why this must never re-subscribe on a dependency change.
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    listen<boolean>("interrupt:fire", async (isMandatory) => {
      // Task #601: top-level guard — computeDue and readInterruptGateState below are not
      // individually try/catch'd (unlike the branches further down), so an uncaught throw
      // from either would otherwise reject this async listener callback silently: no
      // console.error, no trace, the interrupt just never fires and nothing says why.
      try {
        const { interruptEnabled, dndStart, dndEnd, pathname, units, computeDue, router, intervalHours, userId, deviceId } = latestRef.current;
        if (!interruptEnabled) return;
        if (isInDnd(dndStart, dndEnd)) return;

        // Don't interrupt a study session already in progress.
        if (pathname.startsWith("/study")) return;

        const totalDue = computeDue(units);
        if (totalDue === 0) return;

        // Task #529: shared cross-device gate check — before actually firing, ask whether
        // another device (desktop or mobile) already fired/snoozed within the current
        // interval. Signed-out (no userId) has nothing to check against; readInterruptGateState
        // itself returns "unknown" on timeout/error/not_configured — both cases fall back to
        // local-only behavior and fire anyway, per docs/INTERRUPT_ARCHITECTURE.md §6 (Max
        // confirmed fire-anyway-on-timeout over suppress-on-timeout, 2026-08-13). Only a
        // "known" result with a still-future effectiveUntil suppresses this fire.
        if (userId) {
          const gate = await readInterruptGateState(userId);
          if (gate.status === "known" && gate.effectiveUntil !== null && Date.now() < gate.effectiveUntil) {
            return;
          }
        }

        // Task #526/#529, moved by Task #570: confirms a real fire to Rust (advances
        // interrupt.rs's last_triggered_secs clock) and records it on the shared
        // cross-device gate. Both are best-effort — a failed write only means the
        // Rust clock won't advance or this fire won't be visible to other devices,
        // never a reason to block content already decided. Deliberately NOT called
        // until each branch below actually knows content will reach the user: the
        // mandatory branch always shows content (the study session itself), so it
        // calls this unconditionally; the passive branch only calls it once a native
        // notification permission is confirmed AND the notification is actually sent
        // — calling it earlier (the pre-#570 bug) advanced the shared cooldown clock
        // and suppressed future interrupts on every device even when permission was
        // denied and the user never saw anything.
        const markFired = async () => {
          try {
            await markInterruptFired();
          } catch (e) {
            console.error(`[IH-MARKFIRED-${Date.now()}] markInterruptFired failed — Rust clock not advanced for this fire`, e);
          }

          // deviceId can be null on a device that has never committed a review yet
          // (store/syncStore.ts generates it lazily) — skip the write rather than
          // invent a device id for this unrelated purpose.
          if (userId && deviceId) {
            recordInterruptGateEvent({
              userId,
              deviceId,
              eventType: "fired",
              occurredAt: Date.now(),
              minutesUntilEligible: intervalHours * 60,
            }).catch((e) => {
              console.error(`[IH-GATE-WRITE-${Date.now()}] recordInterruptGateEvent failed — this fire won't be visible to other devices`, e);
            });
          }
        };

        if (isMandatory) {
          await markFired();
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
              // Batch 23: floor the announced count to INTERRUPT_SESSION_FLOOR (6) — a
              // session that opens with fewer ready cards fills with new/near-due material
              // (hooks/useStudySession.ts's mount effect), so the notification must never
              // undersell what the session will actually contain. Mirrors the server push
              // path's identical floor in supabase/functions/send-interrupt-notifications.
              // Task #564: also cap at INTERRUPT_SESSION_CAP (8) — totalDue sums FSRS-due
              // cards across the whole catalog and is genuinely unbounded, but
              // app/study/page.tsx slices the opened queue at the same cap, so a backlog
              // day must not announce more cards than the session can ever deliver. Same
              // clamp shape as dueEstimate.ts's buildNotificationPayload (server sibling).
              // docs/INTERRUPT_ARCHITECTURE.md §10.4: a stranded introduction pause combined
              // with an empty near-due pool can leave the opened session below this count,
              // even empty — a pre-existing, documented limitation (Task #580); not worth
              // wiring client-side introduction-engine pause state into this notification
              // just to cover that rare edge case.
              const announcedDue = Math.min(Math.max(totalDue, INTERRUPT_SESSION_FLOOR), INTERRUPT_SESSION_CAP);
              await sendNativeNotification(
                "plyglt",
                `${announcedDue} card${announcedDue === 1 ? "" : "s"} ready — 2 min study break?`
              );
              // Task #570 / #591: only mark the interrupt as genuinely fired now that the
              // notification has actually been sent — see markFired's own comment above.
              // Accepted best-effort limitation: sendNativeNotification resolving only proves
              // the @tauri-apps/plugin-notification IPC call completed without throwing — the
              // plugin's sendNotification() is `(options) => void`, with no delivery callback,
              // receipt, or "shown" event of any kind (verified against the plugin's own
              // dist-js/index.d.ts). There is no stronger signal to check here; the OS may still
              // silently drop the notification (system DND, notification center disabled, etc.)
              // and this call has no way to know. Matches this project's honor-system-style
              // trade-offs elsewhere (CLAUDE.md §5, Entitlement Model) rather than a client-only
              // module inventing an unverifiable check.
              await markFired();
            }
          } catch (err) {
            console.error(`[ERR-NOTIF-${Date.now()}] Notification plugin error:`, err);
          }
        }
      } catch (err) {
        console.error(`[ERR-INTERRUPT-FIRE-${Date.now()}] interrupt:fire handler failed:`, err);
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
