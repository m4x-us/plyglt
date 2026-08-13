// tauriInterrupt.ts — Interrupt-engine and system-tray IPC wrappers extracted from lib/tauri.ts.
// Exports six commands — updateTrayBadge, updateInterruptConfig, snoozeInterrupt,
// enterMandatoryMode, exitMandatoryMode, and markInterruptFired — all no-ops in web/non-Tauri builds.
// Imports isTauri and invoke from lib/tauri.ts rather than @tauri-apps/api directly;
// called by components/InterruptHandler.tsx, app/study/page.tsx, and app/learn/page.tsx.
// snoozeInterrupt also imports lib/interruptGate.ts (a sibling lib/ module, legal under
// CLAUDE.md's Layer Map) to additionally write the shared cross-device gate (Task #530).

import { isTauri, invoke } from "@/lib/tauri";
import { recordInterruptGateEvent } from "@/lib/interruptGate";

// ── Tray badge ────────────────────────────────────────────────────────────────

/** Updates the system tray icon badge with the due-card count. No-op in web. */
export function updateTrayBadge(dueCount: number): void {
  if (!isTauri) return;
  invoke("update_tray_badge", { count: dueCount }).catch((err) => {
    console.error(`[ERR-TRAY-${Date.now()}] Tray badge update failed:`, err);
  });
}

// ── Interrupt / mandatory mode ────────────────────────────────────────────────

/**
 * Typed contract shared between the TS call site and the Rust `update_interrupt_config`
 * command (struct InterruptConfig in interrupt.rs). Single source of truth for the
 * interrupt-config shape — adding a field here flags all callers that need updating.
 *
 * Note: the IPC wire format remains positional (flat object) for backward compat with
 * existing tests. Migration to an object parameter is tracked in Task #216.
 */
export interface InterruptConfig {
  enabled: boolean;
  intervalHours: number;
  mandatory: boolean;
  wakeEnabled: boolean;
  unlockEnabled: boolean;
  idleEnabled: boolean;
  idleThresholdMinutes: number;
}

/**
 * Push interrupt settings to two Rust background threads (interrupt.rs poll loop and
 * os_events.rs OS-event listeners). No-op in web. Throws on IPC failure.
 */
export async function updateInterruptConfig(
  enabled: boolean,
  intervalHours: number,
  mandatory: boolean,
  wakeEnabled: boolean,
  unlockEnabled: boolean,
  idleEnabled: boolean,
  idleThresholdMinutes: number
): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("update_interrupt_config", { enabled, intervalHours, mandatory, wakeEnabled, unlockEnabled, idleEnabled, idleThresholdMinutes });
  } catch (err) {
    const ref = `ERR-IPC-${Date.now()}`;
    console.error(`[${ref}] update_interrupt_config IPC failed — Rust scheduler not updated`, err);
    throw new Error(`Interrupt config IPC failed (${ref})`);
  }
}

/**
 * Snooze the interrupt for `minutes`. No-op in web. Throws on IPC failure — this local
 * Rust snooze is the primary mechanism and must keep its existing failure contract.
 *
 * Task #530: when `gateContext` is supplied (the caller has a signed-in userId and a
 * known deviceId), also records a `snoozed` event on the shared, cross-device gate
 * (lib/interruptGate.ts, Task #528) so the snooze is visible to every other of this
 * user's devices, not just this one — the exact scenario docs/INTERRUPT_ARCHITECTURE.md
 * §8 calls out (snooze on phone should give relief on desktop too, and vice versa).
 * This is purely additive: the local snooze above already fully succeeded by the time
 * this runs, so a shared-write failure is logged but never thrown — it only means other
 * devices won't see this particular snooze, not that this device's own snooze failed.
 */
export async function snoozeInterrupt(
  minutes: number,
  gateContext?: { userId: string; deviceId: string }
): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("snooze_interrupt", { minutes });
  } catch (err) {
    const ref = `ERR-IPC-${Date.now()}`;
    console.error(`[${ref}] snooze_interrupt IPC failed — interrupts will continue firing`, err);
    throw new Error(`Snooze IPC failed (${ref})`);
  }

  if (gateContext) {
    const result = await recordInterruptGateEvent({
      userId: gateContext.userId,
      deviceId: gateContext.deviceId,
      eventType: "snoozed",
      occurredAt: Date.now(),
      minutesUntilEligible: minutes,
    });
    if (!result.ok) {
      console.error(`[ERR-INTERRUPT-GATE-SNOOZE-${Date.now()}] recordInterruptGateEvent failed for snooze:`, result.error);
    }
  }
}

/** Lock window to always-on-top and disable close/minimise. No-op in web. Throws on IPC failure. */
export async function enterMandatoryMode(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("enter_mandatory_mode");
  } catch (err) {
    const ref = `ERR-IPC-${Date.now()}`;
    console.error(`[${ref}] enter_mandatory_mode IPC failed — window not locked`, err);
    throw new Error(`Enter mandatory mode IPC failed (${ref})`);
  }
}

/** Restore window decorations (and hide if it was auto-opened). No-op in web. Throws on IPC failure. */
export async function exitMandatoryMode(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("exit_mandatory_mode");
  } catch (err) {
    const ref = `ERR-IPC-${Date.now()}`;
    console.error(`[${ref}] exit_mandatory_mode IPC failed — window may remain in mandatory state`, err);
    throw new Error(`Exit mandatory mode IPC failed (${ref})`);
  }
}

/**
 * Confirms a real interrupt fire — the ONLY thing that advances src-tauri/src/interrupt.rs's
 * `last_triggered_secs` clock (Task #524). Call this once, and only once, at the exact point
 * components/InterruptHandler.tsx decides to actually show content for a fire — never on a
 * bare check-in, never when `totalDue === 0`. No-op in web. Throws on IPC failure so the
 * caller can log/handle it (Task #526).
 */
export async function markInterruptFired(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("mark_interrupt_fired");
  } catch (err) {
    const ref = `ERR-IPC-${Date.now()}`;
    console.error(`[${ref}] mark_interrupt_fired IPC failed — Rust clock not advanced for this fire`, err);
    throw new Error(`Mark interrupt fired IPC failed (${ref})`);
  }
}
