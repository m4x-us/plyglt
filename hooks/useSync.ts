// ============================================================
// useSync.ts — Hook: orchestrates upload → download → replay across three stores (Task #517)
// ============================================================
// This is where store/authStore.ts, store/syncStore.ts, and store/srsStore.ts meet.
// None of those stores import each other — CLAUDE.md's Layer Map assigns exactly this
// kind of cross-store composition to hooks/, not to a store reaching into a sibling
// store directly.
"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { useSRSStore } from "@/store/srsStore";
import { uploadReviewEvents, downloadReviewEvents } from "@/lib/syncClient";
import { replayLatestEventPerCard, syncedStateToCardProgress } from "@/lib/conflictResolution";
import type { CardProgress } from "@/lib/srs";

export type SyncNowResult = { ok: true } | { ok: false; error: string };

export function useSync() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.userId);

  // Reads store state via getState() at call time rather than closing over reactive
  // values — this can run from a periodic timer long after the component last
  // rendered, and must always act on the current pendingEvents/cards, not a stale
  // snapshot from whenever the hook itself last re-rendered.
  const syncNow = useCallback(async (): Promise<SyncNowResult> => {
    if (status !== "signed-in" || !userId) {
      return { ok: false, error: "Not signed in." };
    }

    const pending = useSyncStore.getState().pendingEvents;
    if (pending.length > 0) {
      const uploadResult = await uploadReviewEvents(userId, pending);
      if (!uploadResult.ok) {
        // Silent retry: leave pendingEvents untouched so the next sync attempt
        // (periodic timer, or the next app open) resends the same batch — no
        // event is ever dropped on a failed upload. Do not proceed to
        // download+merge: this device's own latest review isn't server-side
        // yet, so merging remote-only state here could regress it.
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
      return { ok: false, error: downloadResult.error };
    }

    // Replay the full downloaded set (which includes whatever this device just
    // uploaded above) and adopt it as authoritative per card — safe because the
    // upload-before-download ordering guarantees this device's own latest event
    // is already part of the input, so merging can never regress local state to
    // something older than what this device already knows.
    const merged = replayLatestEventPerCard(downloadResult.events);
    const patch: Record<string, CardProgress> = {};
    for (const cardId of Object.keys(merged)) {
      patch[cardId] = syncedStateToCardProgress(merged[cardId]!);
    }
    if (Object.keys(patch).length > 0) {
      useSRSStore.setState((s) => ({ cards: { ...s.cards, ...patch } }));
    }

    return { ok: true };
  }, [status, userId]);

  return { syncNow };
}
