"use client";

// ===========================================
// SYNC TRIGGER COMPONENT
// ===========================================
// Invisible component that fires useSync()'s syncNow() per
// docs/SYNC_ARCHITECTURE.md §3: once whenever the user is signed in (covers both
// "app open while already signed in" and "just completed sign-in" — both are just
// `status` becoming "signed-in"), plus periodically in the background while it stays
// signed in. No network/online pre-check (the codebase has no such utility, and
// navigator.onLine is unreliable) — a sync attempt while offline simply fails and
// silently retries next interval, same as EntitlementValidator's license validation
// and matching BRAND.md's "never makes you feel behind" applied to infrastructure,
// not just scheduling. Renders nothing.
// ===========================================
// DEPENDS ON: @/hooks/useSync, @/store/authStore
// USED BY: app/layout.tsx
// ===========================================

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSync } from "@/hooks/useSync";

// Periodic background sync interval. docs/SYNC_ARCHITECTURE.md §3 only says "TBD,
// likely matching or slower than the existing interrupt cadence" (hours) — 5 minutes
// is deliberately much shorter than that, since syncing is cheap/idempotent and the
// goal is a second device's reviews showing up promptly, not matching the interrupt
// engine's notification pacing.
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function SyncTrigger() {
  const status = useAuthStore((s) => s.status);
  const { syncNow } = useSync();

  useEffect(() => {
    if (status !== "signed-in") return;

    void syncNow().catch((e: unknown) => {
      // syncNow() itself never throws (every branch returns a result object) —
      // this catch exists only to guarantee an unexpected rejection can never
      // become an unhandled promise rejection in a fire-and-forget call.
      console.error(`[ERR-SYNC-TRIGGER-${Date.now()}] syncNow rejected unexpectedly`, e);
    });

    const interval = setInterval(() => {
      void syncNow().catch((e: unknown) => {
        console.error(`[ERR-SYNC-TRIGGER-${Date.now()}] syncNow rejected unexpectedly`, e);
      });
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status, syncNow]);

  return null;
}
