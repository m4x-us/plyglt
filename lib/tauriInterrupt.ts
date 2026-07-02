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

/** Push interrupt settings to the Rust background thread. No-op in web. Throws on IPC failure. */
export async function updateInterruptConfig(
  enabled: boolean,
  intervalHours: number,
  mandatory: boolean
): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("update_interrupt_config", { enabled, intervalHours, mandatory });
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

/** Lock window to always-on-top and disable close/minimise. No-op in web. */
export async function enterMandatoryMode(): Promise<void> {
  if (!isTauri) return;
  await invoke("enter_mandatory_mode");
}

/** Restore window decorations (and hide if it was auto-opened). No-op in web. */
export async function exitMandatoryMode(): Promise<void> {
  if (!isTauri) return;
  await invoke("exit_mandatory_mode");
}
