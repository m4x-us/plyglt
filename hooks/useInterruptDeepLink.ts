// ============================================================
// useInterruptDeepLink.ts — Routes a `plyglt://interrupt` deep link to the study session (Task #171)
// ============================================================
// A real push notification's tap action (mobile) will eventually open this
// app-registered URL — that native tap-handling is Task #522, blocked on real
// Xcode/Apple Developer Program provisioning this machine doesn't have yet.
// This hook is the app-side half: once ANY caller opens `plyglt://interrupt`,
// route straight to the study session, bypassing the main menu — the exact
// mechanism components/InterruptHandler.tsx already uses for desktop's
// Rust-driven mandatory-interrupt flow (`router.push("/study?mode=interrupt")`)
// and the tray "Study Now" item. No new session logic — this hook only decides
// WHEN to call the same navigation desktop's interrupt entry points already use.
//
// Mirrors store/authStore.ts's existing plyglt://auth-callback handling: both
// cold-start (getCurrentDeepLinkUrls, checked once) and warm-start
// (onDeepLinkUrl's event) are covered, since the OS can deliver a deep link
// either way depending on whether the app process was already running.
// ============================================================
// DEPENDS ON: lib/tauri.ts (isTauri, onDeepLinkUrl, getCurrentDeepLinkUrls)
// USED BY: components/InterruptHandler.tsx
// ============================================================
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTauri, onDeepLinkUrl, getCurrentDeepLinkUrls } from "@/lib/tauri";

const INTERRUPT_DEEP_LINK_HOST = "interrupt";

// Exported for direct unit testing of the matching rule, independent of the
// hook's React/effect plumbing — mirrors store/authStore.ts's own exported
// handleDeepLinkCallback for the same reason.
export function isInterruptDeepLink(url: string): boolean {
  if (!url.startsWith("plyglt://")) return false;
  try {
    // A custom (non-"special") URL scheme's host is an opaque string, not a
    // normalized hostname — unlike http(s), it is NOT lowercased by the URL
    // parser (verified: new URL("plyglt://INTERRUPT").hostname === "INTERRUPT").
    // Lowercase explicitly so a differently-cased payload still matches.
    return new URL(url).hostname.toLowerCase() === INTERRUPT_DEEP_LINK_HOST;
  } catch (e) {
    // A malformed URL does not navigate — but per AGENTS.md's "no silent catch"
    // rule, this must still be logged, matching store/authStore.ts's own
    // handleDeepLinkCallback parse-error guard exactly (which logs, then returns).
    console.error(`[ERR-DEEPLINK-INTERRUPT-PARSE-${Date.now()}] Malformed deep-link URL:`, e);
    return false;
  }
}

export function useInterruptDeepLink(): void {
  const router = useRouter();

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    onDeepLinkUrl((urls) => {
      for (const url of urls) {
        if (isInterruptDeepLink(url)) router.push("/study?mode=interrupt");
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.error(`[ERR-DEEPLINK-INTERRUPT-${Date.now()}] Failed to subscribe to onDeepLinkUrl:`, err);
      });

    getCurrentDeepLinkUrls()
      .then((urls) => {
        if (!urls) return;
        for (const url of urls) {
          if (isInterruptDeepLink(url)) router.push("/study?mode=interrupt");
        }
      })
      .catch((err) => {
        console.error(`[ERR-DEEPLINK-INTERRUPT-COLDSTART-${Date.now()}] getCurrentDeepLinkUrls failed:`, err);
      });

    return () => unlisten?.();
  }, [router]);
}
