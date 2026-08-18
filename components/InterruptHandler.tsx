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
import { getFeatureFlags, isProEnabled } from "@/lib/featureFlags";
import { useEntitlementStore } from "@/store/entitlementStore";
import { INTERRUPT_SESSION_FLOOR, INTERRUPT_SESSION_CAP } from "@/lib/queue";

/** Mounted in the root layout. Returns null immediately unless interruptEngine is both flagged
 *  on and Pro-entitled — owner decision, Batch 23 round 13 audit: closes a gap open across 5
 *  rounds where any Free user could enable the full engine (BRAND.md lists it Pro-only), and
 *  where the sibling hooks/usePushRegistration.ts already gated the identical flag this way. */
export function InterruptHandler() {
  const flags = getFeatureFlags();
  const licenseType = useEntitlementStore((s) => s.licenseType);
  const validUntil = useEntitlementStore((s) => s.validUntil);
  if (!isProEnabled(flags.interruptEngine, licenseType, validUntil)) return null;
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

  // Task #641: re-entrancy guard for the interrupt:fire listener below. Rust's
  // emit_interrupt is fire-and-forget with no queueing/retry (src-tauri/src/interrupt.rs) —
  // if the event fires twice in rapid succession, two concurrent async executions of the
  // callback body could both pass the early-return guards and both proceed, producing
  // duplicate mandatory locks or notifications for one logical interrupt. Same ref-based-
  // guard shape as configSeqRef above, not a state-triggered one — nothing here needs to
  // cause a re-render, it only needs to be readable/writable synchronously across
  // concurrent callback invocations.
  // Task #650: this ref is per-component-instance, not module-scoped, so it cannot
  // guard against a fresh InterruptHandlerCore instance racing an orphaned callback
  // left running by a just-unmounted prior instance. Not module-scoped deliberately:
  // this component mounts once at the root layout and is not expected to unmount
  // during normal app lifetime, so that race has no real trigger today. Flagged for
  // completeness only, not fixed — see .autocode/debt.md.
  const interruptFireInFlightRef = useRef(false);

  // Keep the Rust thread in sync whenever relevant settings change.
  useEffect(() => {
    const seq = ++configSeqRef.current;
    (async () => {
      try {
        await updateInterruptConfig(
          interruptEnabled,
          intervalHours,
          mandatory,
          wakeEnabled,
          unlockEnabled,
          idleEnabled,
          idleThresholdMinutes,
        );
        // Task #633: the identical staleness check the .catch() branch below already had —
        // previously missing from the success path entirely, a real doc/code mismatch (the
        // comment on configSeqRef above claims protection against exactly this class of
        // race, but the guard as originally written only covered rejection). Honest caveat:
        // updateInterruptConfig resolves Promise<void> (lib/tauriInterrupt.ts) with no
        // further JS-side action after it today, so this specific check is currently inert —
        // by the time any await here resolves, the Rust-side write (the actual "overwrite"
        // the finding describes) has already happened, and no JS-side check run after the
        // fact can undo it. Kept anyway, symmetric with the catch branch, so any future
        // change that adds real post-success logic here (e.g. storing an ack) is
        // automatically protected rather than requiring someone to remember to add this
        // check when that logic lands.
        if (seq !== configSeqRef.current) return; // stale — a newer write is in flight
      } catch (err) {
        if (seq !== configSeqRef.current) return; // stale — a newer write is in flight
        console.error(`[ERR-IPC-CONFIG-${Date.now()}] Failed to sync interrupt config:`, err);
      }
    })();
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
      // Task #641: a second fire landing while the first is still being processed is a
      // no-op — released in the finally below regardless of which exit path (an early
      // return, a thrown error, or normal completion) the callback takes.
      if (interruptFireInFlightRef.current) return;
      interruptFireInFlightRef.current = true;
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
        // until each branch below has as much confidence as it can get that content
        // will reach the user: the passive branch only calls it once a native
        // notification permission is confirmed AND the notification is actually sent
        // — calling it earlier (the pre-#570 bug) advanced the shared cooldown clock
        // and suppressed future interrupts on every device even when permission was
        // denied and the user never saw anything.
        //
        // Task #614: the mandatory branch below calls markFired() unconditionally —
        // NOT because the study session is guaranteed to show content (it is not; see
        // docs/INTERRUPT_ARCHITECTURE.md §10.2/§10.4: the session floor "is a target,
        // not an unconditional guarantee ... can leave a session below 6 — even, in
        // one rare combination, completely empty," and components/StudyEmptyQueue.tsx
        // exists precisely for that outcome). A real sequence exists where computeDue
        // returns non-zero via the near-due/flex fallback, this branch locks the
        // window and navigates to /study?mode=interrupt, and the mount-fill effect's
        // fill pass still comes up empty (a stranded introduction pause combined with
        // an exhausted near-due pool) — the user sees "Nothing ready," yet the shared
        // gate clock has already advanced for the full interval on every device.
        // This is an accepted, explicitly-documented trade-off, not an oversight: a
        // correct fix requires a signal back from the opened session confirming it
        // actually has content, which only app/study/page.tsx / useStudySession.ts
        // (mount-fill effect, owned by a different stream) can produce — closing this
        // gap for real needs a change in one of those files, out of this file's scope.
        // Until that lands, the accepted risk is bounded to the rare stranded-pause
        // (docs/INTERRUPT_ARCHITECTURE.md §10.3) + exhausted-near-due-pool combination,
        // and its blast radius is one skipped interrupt interval, not data loss or a
        // permanent stuck state.
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
          // Task #614: fires speculatively — see markFired's own comment above for why
          // this is an accepted trade-off rather than a guarantee.
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
              // hooks/useStudyQueueSetup.ts slices the opened queue at the same cap, so a
              // backlog day must not announce more cards than the session can ever deliver. Same
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
      } finally {
        interruptFireInFlightRef.current = false;
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
