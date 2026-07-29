// tauriInterrupt.ts — Interrupt-engine and system-tray IPC wrappers extracted from lib/tauri.ts.
// Exports five commands — updateTrayBadge, updateInterruptConfig, snoozeInterrupt,
// enterMandatoryMode, and exitMandatoryMode — all no-ops in web/non-Tauri builds.
// Imports isTauri and invoke from lib/tauri.ts rather than @tauri-apps/api directly;
// called by components/InterruptHandler.tsx, app/study/page.tsx, and app/learn/page.tsx.

import { isTauri, invoke } from "@/lib/tauri";

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

/** Snooze the interrupt for `minutes`. No-op in web. Throws on IPC failure. */
export async function snoozeInterrupt(minutes: number): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("snooze_interrupt", { minutes });
  } catch (err) {
    const ref = `ERR-IPC-${Date.now()}`;
    console.error(`[${ref}] snooze_interrupt IPC failed — interrupts will continue firing`, err);
    throw new Error(`Snooze IPC failed (${ref})`);
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
