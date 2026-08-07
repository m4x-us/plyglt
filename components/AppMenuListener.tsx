"use client";

// ===========================================
// APP MENU LISTENER COMPONENT
// ===========================================
// Invisible component mounted unconditionally in the root layout (not gated
// behind the interruptEngine feature flag the way InterruptHandler.tsx's
// tray:study listener is) so the native macOS menu bar's "Settings…" item
// (src-tauri/src/app_menu.rs, Cmd+,) works from every page, including the
// home screen before a language is picked — that page has no in-app
// Settings link at all, so the menu bar was the only remaining way in.
// No-ops entirely in the web build (lib/tauri.ts's listen() returns a no-op
// unlisten function when !isTauri).
// ===========================================
// DEPENDS ON: @/lib/tauri
// USED BY: app/layout.tsx
// ===========================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listen } from "@/lib/tauri";

export function AppMenuListener() {
  const router = useRouter();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<void>("menu:settings", () => {
      router.push("/settings");
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) =>
        console.error(`[ERR-LISTEN-MENU-${Date.now()}] Failed to subscribe to menu:settings:`, err)
      );
    return () => unlisten?.();
  }, [router]);

  return null;
}
