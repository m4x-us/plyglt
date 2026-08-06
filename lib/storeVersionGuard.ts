// ============================================================
// storeVersionGuard.ts — shared migration-version guard (no React, no Zustand)
// ============================================================
// Extracted from store/migrations.ts (Task #169) so store/syncMigrations.ts
// can share it without a circular import (migrations.ts re-exports FROM
// syncMigrations.ts; syncMigrations.ts importing back from migrations.ts
// would be circular — this file is the shared ancestor both import from).
// ============================================================
// USED BY: store/migrations.ts, store/syncMigrations.ts
// ============================================================

// A stored version newer than this build understands (e.g. data written by a
// build newer than this one — a stale/downgraded app instance, or a newer tab
// during a rollout) must never be silently treated as already-current and
// passed through unmigrated and unvalidated. See store/migrations.ts's header
// rule: "silent fallbacks corrupt user data" applies equally to a version
// that's too NEW, not just too old.
export function assertNotFutureVersion(storeName: string, storedVersion: number, currentVersion: number): void {
  if (storedVersion > currentVersion) {
    throw new Error(
      `${storeName} store version ${storedVersion} is newer than this app build understands (current ${currentVersion}) — refusing to apply unmigrated data`
    );
  }
}
