/**
 * lib/tauri.ts — Runtime helpers for the Tauri desktop environment.
 *
 * All exports degrade gracefully in the browser (Next.js web build).
 * Import this module freely from any component — it is safe server-side too.
 */

// ── Environment detection ─────────────────────────────────────────────────────

/** True only inside the Tauri webview. Safe to call during SSR (returns false). */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ── Tauri command / event wrappers ────────────────────────────────────────────

/** Invoke a Tauri command defined in lib.rs. No-op in web. */
export async function invoke<T = void>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri) return null;
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

/** Listen for an event emitted by the Rust backend. Returns an unlisten function. */
export async function listen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen: tauriListen } = await import("@tauri-apps/api/event");
  return tauriListen<T>(event, (e) => handler(e.payload));
}

/** Emit an event to the Rust backend. No-op in web. */
export async function emit(event: string, payload?: unknown): Promise<void> {
  if (!isTauri) return;
  const { emit: tauriEmit } = await import("@tauri-apps/api/event");
  await tauriEmit(event, payload);
}

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

// ── Autostart ─────────────────────────────────────────────────────────────────

/** Register the app to launch at login. No-op in web. */
export async function enableAutostart(): Promise<void> {
  if (!isTauri) return;
  const { enable } = await import("@tauri-apps/plugin-autostart");
  await enable();
}

/** Remove the app from login items. No-op in web. */
export async function disableAutostart(): Promise<void> {
  if (!isTauri) return;
  const { disable } = await import("@tauri-apps/plugin-autostart");
  await disable();
}

// ── External URL opener ───────────────────────────────────────────────────────

/** Open a URL in the system browser. Falls back to window.open in web context. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri) {
    await invoke("open_url", { url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

/** Checks for a new version and, if found, prompts the user to install it. */
export async function checkForUpdates(): Promise<void> {
  if (!isTauri) return;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update?.available) {
      // The update dialog is handled by the plugin; just download and install.
      await update.downloadAndInstall();
    }
  } catch {
    // Non-fatal — network may be offline
  }
}
