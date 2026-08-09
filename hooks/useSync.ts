// ============================================================
// useSync.ts — Hook: orchestrates upload → download → replay across three stores (Task #517)
// ============================================================
// This is where store/authStore.ts, store/syncStore.ts, and store/srsStore.ts meet.
// None of those stores import each other — CLAUDE.md's Layer Map assigns exactly this
// kind of cross-store composition to hooks/, not to a store reaching into a sibling
// store directly.
"use client";

import { useCallback, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { useSRSStore } from "@/store/srsStore";
import { uploadReviewEvents, downloadReviewEvents } from "@/lib/syncClient";
import { replayLatestEventPerCard, syncedStateToCardProgress } from "@/lib/conflictResolution";
import type { CardProgress } from "@/lib/srs";

export type SyncNowResult = { ok: true } | { ok: false; error: string };

// How long to wait after the most recent review before syncing — short enough
// that a review reaches Supabase in seconds rather than up to the full 5-minute
// SyncTrigger.tsx background interval, but debounced so a quick burst of
// answers (a whole study session) collapses into one upload instead of one per
// card. Found via Task #518's live test: a real review sat unsynced long enough
// to look broken during manual verification, even though the code was correct.
const TRIGGER_SYNC_DEBOUNCE_MS = 2000;

// Module-scope (not per-hook-instance) in-flight guard. Audit finding
// (2026-08-09, Task #520 review): useSyncStore/useSRSStore are module-level
// singletons shared by every useSync() caller — SyncTrigger.tsx's periodic
// 5-minute timer and any component's debounced triggerSyncSoon() are
// genuinely concurrent, real, live-reachable call sites, not a hypothetical.
// Without this guard, two overlapping runSyncNow() calls each make their own
// non-atomic sequence of useSyncStore/useSRSStore.setState() calls; whichever
// call's terminal write lands last wins regardless of which one represents
// current truth — a fast call's real, still-unresolved lastSyncError could be
// silently clobbered by a slower call's stale success, hiding an active sync
// problem behind a "synced" status. Serializing all real work through one
// shared in-flight promise (every concurrent caller awaits the SAME
// execution rather than starting a second one) removes the race at its root
// rather than trying to order the individual setState calls.
let inFlightSyncPromise: Promise<SyncNowResult> | null = null;

// Reads store state via getState() at call time rather than closing over reactive
// values — this can run from a periodic timer long after the component last
// rendered, and must always act on the current pendingEvents/cards, not a stale
// snapshot from whenever the hook itself last re-rendered. A free function
// (not a hook) so the module-scope in-flight guard above can call it directly,
// independent of which component instance's useSync() triggered it.
async function runSyncNow(userId: string): Promise<SyncNowResult> {
  const pending = useSyncStore.getState().pendingEvents;
  if (pending.length > 0) {
    const uploadResult = await uploadReviewEvents(userId, pending);
    if (!uploadResult.ok) {
      // Silent retry: leave pendingEvents untouched so the next sync attempt
      // (periodic timer, or the next app open) resends the same batch — no
      // event is ever dropped on a failed upload. Do not proceed to
      // download+merge: this device's own latest review isn't server-side
      // yet, so merging remote-only state here could regress it.
      // lastSyncedAt is deliberately untouched — a failed sync doesn't move
      // "last successful sync" forward; only lastSyncError updates so the
      // status indicator (components/SyncSignIn.tsx) can show the failure.
      useSyncStore.setState({ lastSyncError: uploadResult.error });
      return { ok: false, error: uploadResult.error };
    }
    // Clear only the specific events this call actually uploaded — NOT a blind
    // `{ pendingEvents: [] }`. `uploadReviewEvents` above is an `await`, which
    // yields the event loop; a real review can be enqueued (enqueueReviewEvent,
    // hooks/useStudySession.ts) while this request is in flight. Re-reading
    // current state inside the setState updater and filtering by the uploaded
    // ids' own set means any event added mid-upload survives untouched, ready
    // for the next sync call — a blind clear-to-empty would silently drop it
    // forever (never uploaded, no longer queued).
    const uploadedIds = new Set(pending.map((e) => e.id));
    useSyncStore.setState((s) => ({
      pendingEvents: s.pendingEvents.filter((e) => !uploadedIds.has(e.id)),
    }));
  }

  const downloadResult = await downloadReviewEvents(userId);
  if (!downloadResult.ok) {
    // Local state is already safe (upload above succeeded or there was nothing
    // to upload) — a failed download just means this device doesn't see other
    // devices' newer reviews yet. Retried on the next sync attempt.
    useSyncStore.setState({ lastSyncError: downloadResult.error });
    return { ok: false, error: downloadResult.error };
  }

  // Replay the full downloaded set (which includes whatever this device just
  // uploaded above) and adopt it as authoritative per card — safe because the
  // upload-before-download ordering guarantees this device's own latest event
  // is already part of the input, so merging can never regress local state to
  // something older than what this device already knows. Also safe against
  // the concurrent-call race the in-flight guard above closes: only one
  // runSyncNow() body ever executes at a time, so there is no second,
  // independently-snapshotted patch that could land afterward and overwrite
  // this one with staler data.
  const merged = replayLatestEventPerCard(downloadResult.events);
  const patch: Record<string, CardProgress> = {};
  for (const cardId of Object.keys(merged)) {
    patch[cardId] = syncedStateToCardProgress(merged[cardId]!);
  }
  if (Object.keys(patch).length > 0) {
    useSRSStore.setState((s) => ({ cards: { ...s.cards, ...patch } }));
  }

  // A full sync (upload + download + merge) completed without error — this
  // is the only path that advances lastSyncedAt, and it also clears any
  // prior lastSyncError so the status indicator drops back to "synced".
  useSyncStore.setState({ lastSyncedAt: Date.now(), lastSyncError: null });
  return { ok: true };
}

export function useSync() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.userId);

  const syncNow = useCallback(async (): Promise<SyncNowResult> => {
    if (status !== "signed-in" || !userId) {
      // Not signed in is an inapplicable state, not a failed sync attempt —
      // lastSyncError deliberately stays untouched here, so it always
      // reflects the most recent real attempt's outcome, never this case.
      return { ok: false, error: "Not signed in." };
    }

    // Join the already-running sync instead of starting a second, concurrent
    // one — see the in-flight guard's own comment above for why this matters.
    if (inFlightSyncPromise) return inFlightSyncPromise;
    const promise = runSyncNow(userId).finally(() => {
      inFlightSyncPromise = null;
    });
    inFlightSyncPromise = promise;
    return promise;
  }, [status, userId]);

  // Debounced fire-and-forget wrapper around syncNow(), for callers (the study
  // session's review-commit path) that want a review to reach Supabase quickly
  // without triggering a network call per card, and without blocking the UI on
  // the result — matches syncNow()'s own silent-retry contract. Deliberately
  // not cleared on unmount: the timer is a plain JS setTimeout, independent of
  // React's lifecycle, and syncNow() reads live store state via getState() —
  // letting it fire after the study page unmounts (e.g. an interrupt session
  // exiting immediately after the last card) is the whole point, not a leak.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerSyncSoon = useCallback(() => {
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      // Not surfaced to the user (silent-retry, matches syncNow()'s own contract)
      // but must stay visible in the console — an unlogged {ok:false} here is
      // exactly the gap that made a real, persistent sync failure undetectable
      // during Task #518 follow-up debugging (2026-08-08).
      void syncNow()
        .then((result) => {
          if (!result.ok) {
            console.error(`[ERR-SYNC-TRIGGER-${Date.now()}] triggerSyncSoon's syncNow failed:`, result.error);
          }
        })
        .catch((e: unknown) => {
          // syncNow() itself never throws (every branch returns a result object) —
          // this catch exists only to guarantee an unexpected rejection can never
          // become an unhandled promise rejection in a fire-and-forget call.
          // Matches components/SyncTrigger.tsx's identical guard.
          console.error(`[ERR-SYNC-TRIGGER-${Date.now()}] triggerSyncSoon's syncNow rejected unexpectedly`, e);
        });
    }, TRIGGER_SYNC_DEBOUNCE_MS);
  }, [syncNow]);

  return { syncNow, triggerSyncSoon };
}
