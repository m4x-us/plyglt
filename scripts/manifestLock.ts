// ============================================================
// manifestLock.ts — cross-process mutex for exportPack.ts's manifest.json read-modify-write
// ============================================================
/**
 * Extracted from scripts/exportPack.ts (Task: audit fix — F5/F6/F9/F11 from the
 * multi-language-architecture-prep audit) so `withManifestLock` is directly importable for
 * tests. exportPack.ts's own top-level body has real side effects on every import (writes
 * pack files, calls process.exit), so it can't itself be safely imported the way
 * scripts/checkCardIds.ts / scripts/lintCardQuality.ts guard their CLI logic behind an
 * `isMainModule` check — this module has no top-level side effects, so no such guard is
 * needed here.
 *
 * DEPENDS ON: node:fs, node:crypto is not used here
 * USED BY: scripts/exportPack.ts (its sole caller)
 *
 * writeFileSync/renameSync-based atomic writes (writeFileAtomic in exportPack.ts) fix
 * torn/partial reads of a single file. They do NOT fix the separate read-modify-write race:
 * manifest.json holds every language's entry, so two exportPack.ts processes running
 * concurrently for DIFFERENT langCodes can both read the manifest, both compute an update,
 * and both write — whichever finishes writing last wins, silently discarding the other's
 * update. Closing that race needs real cross-process mutual exclusion, not a smaller
 * in-process reordering — hence this lock.
 *
 * mkdirSync throwing EEXIST when the directory already exists is atomic at the OS level
 * (unlike a "check if file exists, then create it" pattern, which has its own race), making
 * a lock directory a standard, dependency-free mutex primitive for exactly this situation.
 */

import { mkdirSync, rmdirSync, statSync } from "node:fs";

const LOCK_MAX_ATTEMPTS = 100; // 100 * 100ms = 10s max wait before giving up
const LOCK_RETRY_MS = 100;

// A lock directory older than this is treated as abandoned by a process that was killed
// (SIGKILL/OOM/CI cancellation) between mkdirSync and the finally block's release — a killed
// process never runs `finally`, so nothing else would ever reclaim the lock otherwise. 30s is
// comfortably longer than any real export run (a pack export + manifest write takes well
// under 1s) but short enough that a genuinely wedged pipeline self-heals within a run or two
// instead of needing a human to find and delete the directory by hand.
const STALE_LOCK_MS = 30_000;

// Returns true iff a stale lock was found and removed — the caller should retry mkdirSync
// immediately rather than sleeping, since the path is very likely free now.
function reclaimIfStale(lockPath: string): boolean {
  try {
    const age = Date.now() - statSync(lockPath).mtimeMs;
    if (age > STALE_LOCK_MS) {
      rmdirSync(lockPath);
      return true;
    }
  } catch {
    // statSync/rmdirSync failed — the lock vanished between our EEXIST and this check
    // (another process just released it, or just reclaimed it itself). Fall through: the
    // next mkdirSync attempt will either succeed on the now-free path or hit a fresh EEXIST.
  }
  return false;
}

// rmdirSync's own failure must not masquerade as fn() having failed, and must not replace a
// real error fn() threw — log distinctly and swallow, matching this codebase's
// readCacheMeta/readCacheData internal-try/catch pattern in lib/basePackLoader.ts for the
// same "a cleanup step's own fallibility must not corrupt the caller's real outcome" reason.
function releaseLock(lockPath: string): void {
  try {
    rmdirSync(lockPath);
  } catch (err) {
    console.error(
      `[ERR-MANIFEST-LOCK-RELEASE-${Date.now()}] Failed to release lock at ${lockPath}: ${String(err)} — ` +
      `this does not indicate the underlying manifest write failed; the lock directory may need manual cleanup.`
    );
  }
}

export function withManifestLock<T>(manifestPath: string, fn: () => T): T {
  const lockPath = `${manifestPath}.lock`;
  let attempt = 0;
  for (;;) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (err) {
      const isBusy = (err as NodeJS.ErrnoException).code === "EEXIST";
      if (!isBusy) throw err;
      if (reclaimIfStale(lockPath)) continue;
      attempt++;
      if (attempt >= LOCK_MAX_ATTEMPTS) {
        throw new Error(
          `Could not acquire manifest lock at ${lockPath} after ${attempt} attempt(s) ` +
          `(~${(LOCK_MAX_ATTEMPTS * LOCK_RETRY_MS / 1000).toFixed(0)}s) — ` +
          `if no other exportPack.ts run is actually in progress, delete this directory manually: ${String(err)}`
        );
      }
      // Synchronous sleep — deliberate: this is a CLI build script (not app runtime code),
      // and the whole point is to block THIS process until the lock is free, not to yield
      // to other work. Atomics.wait on a throwaway buffer is the standard synchronous-sleep
      // technique in Node scripts with no async equivalent available in a sync call chain.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
    }
  }
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}
