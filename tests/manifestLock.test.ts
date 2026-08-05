// ============================================================
// tests/manifestLock.test.ts — regression coverage for scripts/manifestLock.ts
// ============================================================
// Task (audit fix, F5/F6/F9/F11): withManifestLock had zero committed test despite the
// original commit message claiming it was "stress-tested... genuinely concurrent processes"
// and "B7-verified" — neither was true. This file covers the mutex's own correctness
// (acquire/release, error isolation) directly, plus real cross-process contention using a
// background child process, since withManifestLock's retry loop uses a synchronous
// Atomics.wait that blocks the event loop and so cannot be unblocked by an in-process
// setTimeout/Promise — only a genuinely separate OS process can release a held lock while
// this process is blocked waiting for it.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, existsSync, utimesSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { withManifestLock } from "@/scripts/manifestLock";

describe("withManifestLock", () => {
  let dir: string;
  let manifestPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "manifestlock-test-"));
    manifestPath = join(dir, "manifest.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs fn() and returns its result when no lock is held", () => {
    const result = withManifestLock(manifestPath, () => 42);
    expect(result).toBe(42);
  });

  it("releases the lock directory after fn() completes, so a second call can acquire it immediately", () => {
    withManifestLock(manifestPath, () => {});
    expect(existsSync(`${manifestPath}.lock`)).toBe(false);
    const result = withManifestLock(manifestPath, () => "second");
    expect(result).toBe("second");
  });

  // B7 target: wrapping the original `rmdirSync(lockPath)` release directly in the `finally`
  // (no try/catch around it) means a thrown fn() error would be replaced by whatever
  // rmdirSync does — this test can't easily force rmdirSync to throw, but it does prove the
  // real, common case: fn()'s own error must survive the lock release step untouched.
  it("releases the lock even when fn() throws, and re-throws fn()'s original error unchanged", () => {
    expect(() => withManifestLock(manifestPath, () => { throw new Error("boom"); })).toThrow("boom");
    expect(existsSync(`${manifestPath}.lock`)).toBe(false);
  });

  it("reclaims a stale lock directory (older than the staleness threshold) instead of waiting out the full retry ceiling", () => {
    const lockPath = `${manifestPath}.lock`;
    mkdirSync(lockPath);
    // Backdate the lock's mtime to simulate a process killed long ago (SIGKILL/OOM/CI
    // cancellation), which skips the `finally` block that would normally release it —
    // nothing else would ever reclaim this lock without staleness detection.
    const oldTime = new Date(Date.now() - 60_000);
    utimesSync(lockPath, oldTime, oldTime);
    const start = Date.now();
    const result = withManifestLock(manifestPath, () => "reclaimed");
    expect(result).toBe("reclaimed");
    // Without staleness reclaim this call would have to wait out the full retry ceiling
    // (100 attempts * 100ms = ~10s) instead of reclaiming within one or two loop iterations.
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("does NOT reclaim a fresh (non-stale) lock — a genuinely concurrent holder is respected until it releases", async () => {
    const lockPath = `${manifestPath}.lock`;
    mkdirSync(lockPath); // fresh — mtime is "now"

    // Release it from a real, separate OS process after a short delay. This is the only way
    // to unblock withManifestLock's synchronous retry loop below: Atomics.wait blocks the
    // Node event loop entirely, so an in-process setTimeout/Promise scheduled before calling
    // withManifestLock would never fire while it's waiting.
    let releaser: ChildProcess | null = spawn(
      process.execPath,
      ["-e", `setTimeout(() => { try { require("fs").rmdirSync(${JSON.stringify(lockPath)}); } catch {} }, 300);`],
      { stdio: "ignore" }
    );

    try {
      const start = Date.now();
      const result = withManifestLock(manifestPath, () => "acquired-after-wait");
      const elapsed = Date.now() - start;
      expect(result).toBe("acquired-after-wait");
      // Proves real contention was respected (did not acquire instantly, since the fresh
      // lock is not stale) and then genuinely resolved once released (did not hit the ~10s
      // ceiling either) — not reclaimed-as-stale, actually waited for the other holder.
      expect(elapsed).toBeGreaterThanOrEqual(200);
      expect(elapsed).toBeLessThan(5000);
    } finally {
      releaser?.kill();
      releaser = null;
    }
  });
});
