# Stream W22A Task State

### Task #474: Fix error-handling: entitlementCrossTabSync's async rehydrate rejection is silently swallowed, unlike its sync-throw sibling

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
triggerRehydrate's Promise branch does `result.then(done, done)` — done resets the in-flight flag and requeues but never logs. Its sibling, the synchronous-throw branch 8 lines below, correctly logs via `console.error("[ERR-REHYDRATE-SYNC-THROW-...]", err)` before calling done(). This wave's own new test for the async-reject scenario (tests/entitlementCrossTabSync.test.ts:178-200) sets up an errorSpy but never asserts on it — the test documents the swallow instead of catching it. Direct violation of AGENTS.md Rule 8 ("every catch block must surface the error... swallowing errors is a stop-the-line violation") — the `.then` rejection handler is functionally a catch block here. This gap sits inside the very task (#469) opened to close this module's error-handling gaps. at store/entitlementCrossTabSync.ts:77.

**Acceptance Criteria:**
- [ ] The async-rejection path logs the rejection reason with a ref ID, matching the sync-throw path's pattern
- [ ] The existing "a queued event during an in-flight rehydrate that later REJECTS..." test asserts the errorSpy was actually called, not just call counts

**Source:** Cycle-8 audit finding C8-F01 — severity 7 — convergence 1/8 (Agent B) — Rule 8 violation, LIVE (cross-tab sync runs in production web builds today).

---
