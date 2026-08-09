// ============================================================
// syncStore.ts — local, not-yet-uploaded sync queue (Task #169)
// ============================================================
// Owns deviceId (generated once, persisted) and pendingEvents (ReviewEvents
// captured locally since the last successful upload). NOT yet wired to a live
// Supabase client — see .autocode/tasks.md Task #169 for what's blocked
// pending Max's Supabase project + Apple/Google OAuth app provisioning.
// Until then this store just accumulates real review events locally, so
// nothing needs to be "backfilled" once the live client exists.
// ============================================================
// DEPENDS ON: @/lib/reviewEvent (createReviewEvent), @/lib/srs (CardProgress, Grade),
//             @/lib/storage (createPlatformStorage), @/store/migrations (SYNC_VERSION)
// USED BY: hooks/useStudySession.ts (enqueueReviewEvent, on every commitSession call —
//          the real production review-write path)
// ============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createPlatformStorage } from "@/lib/storage";
import { SYNC_VERSION, migrateSyncStore } from "@/store/migrations";
import { createReviewEvent, type ReviewEvent } from "@/lib/reviewEvent";
import type { CardProgress, Grade } from "@/lib/srs";

interface SyncState {
  deviceId: string | null;
  pendingEvents: ReviewEvent[];
  // Task #520: written by hooks/useSync.ts's syncNow() at each of its return
  // points — persisted (not just in-memory) so "last synced" survives an app
  // restart instead of resetting to "never synced" every launch.
  lastSyncedAt: number | null; // unix ms; null = never successfully synced
  // The most recent failed sync ATTEMPT's error string; cleared on the next success.
  // "Not signed in" is deliberately not an attempt (hooks/useSync.ts's syncNow()
  // returns early without touching this field), so it never appears here.
  lastSyncError: string | null;

  // Builds a ReviewEvent from the CardProgress commitSession() just produced and
  // appends it to the local queue. Generates and persists a deviceId on first call
  // if one doesn't exist yet.
  enqueueReviewEvent: (cardId: string, grade: Grade, resultingProgress: CardProgress) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      deviceId: null,
      pendingEvents: [],
      lastSyncedAt: null,
      lastSyncError: null,

      enqueueReviewEvent: (cardId, grade, resultingProgress) => {
        const existingDeviceId = get().deviceId;
        const deviceId = existingDeviceId ?? crypto.randomUUID();
        const event = createReviewEvent(cardId, grade, resultingProgress, deviceId, Date.now(), crypto.randomUUID());
        set((s) => ({
          deviceId,
          pendingEvents: [...s.pendingEvents, event],
        }));
      },
    }),
    {
      name: "sync-v1",
      version: SYNC_VERSION,
      migrate: migrateSyncStore,
      storage: createJSONStorage(() => createPlatformStorage("sync-v1")),
    }
  )
);
