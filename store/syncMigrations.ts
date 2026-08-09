// ===========================================
// SYNC STORE MIGRATIONS (Task #169)
// ===========================================
// Extracted from store/migrations.ts under the Rule 1 400-line cap — that file
// stays the single source of truth for every OTHER store's migrations; this one
// existed only because the sync store's addition would have pushed it over.
// Re-exported from store/migrations.ts so store/syncStore.ts (and every future
// caller) still has one canonical import path — see that file's header comment.
// deviceId + pendingEvents (local, not-yet-uploaded ReviewEvents). Not yet wired
// to a live Supabase client — this migration entry exists per store/migrations.ts's
// own rule ("every persisted store has a *_VERSION + *_MIGRATIONS + migrate*Store"),
// ahead of the store shipping, same as every other store in that file.
// ===========================================
// DEPENDS ON: @/lib/storeVersionGuard (assertNotFutureVersion — shared, not
//             imported from store/migrations.ts, since that file re-exports
//             FROM here and importing back would be circular).
// USED BY: store/migrations.ts (re-export), store/syncStore.ts
// ===========================================

import { assertNotFutureVersion } from "@/lib/storeVersionGuard";

export const SYNC_VERSION = 2;

const SYNC_MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  1: (data: unknown) => {
    const d = data as Record<string, unknown>;
    return {
      deviceId: typeof d.deviceId === "string" && d.deviceId.length > 0 ? d.deviceId : null,
      pendingEvents: Array.isArray(d.pendingEvents) ? d.pendingEvents : [],
    };
  },
  // Task #520: adds lastSyncedAt/lastSyncError so the sync-status indicator survives
  // an app restart. Every pre-existing persisted blob predates these fields, so both
  // default to null (matches SyncSignIn.tsx's "never synced yet" / "no error" states) —
  // never fabricate a timestamp or error string for data that genuinely has neither.
  2: (data: unknown) => {
    const d = data as Record<string, unknown>;
    // Number.isFinite (not just typeof === "number") rejects NaN/Infinity/-Infinity —
    // typeof NaN === "number" is true, and a NaN lastSyncedAt would render "NaNd ago"
    // in lib/utils.ts's formatRelativeTime. A negative value is equally impossible
    // for a real Date.now() write, so it's rejected the same way.
    const validTimestamp =
      typeof d.lastSyncedAt === "number" && Number.isFinite(d.lastSyncedAt) && d.lastSyncedAt >= 0;
    return {
      ...d,
      lastSyncedAt: validTimestamp ? d.lastSyncedAt : null,
      lastSyncError: typeof d.lastSyncError === "string" ? d.lastSyncError : null,
    };
  },
};

export function migrateSyncStore(persisted: unknown, storedVersion: number): unknown {
  assertNotFutureVersion("Sync", storedVersion, SYNC_VERSION);
  let v = storedVersion;
  let data = persisted;
  while (v < SYNC_VERSION) {
    v++;
    const fn = SYNC_MIGRATIONS[v];
    if (!fn) throw new Error(`Missing sync store migration to version ${v}`);
    data = fn(data);
  }
  return data;
}
