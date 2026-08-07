// ============================================================
// tauri.ts — Runtime helpers and graceful degradation wrappers for the Tauri desktop API
// ============================================================
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

// ── Deep links (Task #519 — desktop OAuth callback) ─────────────────────────────

/**
 * Registers a listener for deep-link URLs the OS hands to the already-running
 * app (e.g. after a user completes OAuth sign-in in the system browser and it
 * navigates to the custom `plyglt://` scheme registered in tauri.conf.json).
 * No-op in web — returns a no-op unlisten function, matching listen()'s
 * degradation pattern.
 */
export async function onDeepLinkUrl(handler: (urls: string[]) => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  return onOpenUrl(handler);
}

/**
 * Returns the deep-link URL(s) the app was launched with, if the OS started a
 * fresh process via the deep link (cold start) rather than the app already
 * running when the link arrived. null in web, or when there is none.
 */
export async function getCurrentDeepLinkUrls(): Promise<string[] | null> {
  if (!isTauri) return null;
  const { getCurrent } = await import("@tauri-apps/plugin-deep-link");
  return getCurrent();
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

export type UpdateCheckResult =
  | { available: false }
  | { available: true; version: string; install: () => Promise<void> };

/**
 * Checks for a new version. Returns an UpdateCheckResult — never auto-installs.
 * When available=true, the caller must explicitly call result.install() after
 * obtaining user confirmation. This is a supply-chain risk guard.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isTauri) return { available: false };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update?.available) {
      return {
        available: true,
        version: update.version ?? "unknown",
        install: () => update.downloadAndInstall(),
      };
    }
    return { available: false };
  } catch (err) {
    // Non-fatal — network may be offline. Log so manifest parse failures leave a trace.
    console.error(`[ERR-UPDATER-${Date.now()}] checkForUpdates failed:`, err);
    return { available: false };
  }
}
