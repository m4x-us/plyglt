# Stream W22B Task State

### Task #475: Fix test-quality: fetchWithTimeout.test.ts's rewritten test proves only one of the two timers the finally block clears

**File:** tests/fetchWithTimeout.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #472's rewritten test captures `setTimeoutSpy.mock.results[1]!.value` (the backstop timer, the SECOND setTimeout call) and asserts clearTimeoutSpy was called with it — but never captures or asserts anything about `results[0]` (the abort timer, cleared by the same finally block one line above). Confirmed empirically: commenting out `clearTimeout(abortTimeoutId)` in lib/fetchWithTimeout.ts and running the full test file leaves all 6 tests green. Task #472 exists specifically because a prior test proved nothing — this rewrite fixes exactly one of the two timers it needed to prove and leaves the other unverified, the same defect class one line over, in the same task. at tests/fetchWithTimeout.test.ts:76.

**Acceptance Criteria:**
- [ ] The test also asserts `clearTimeoutSpy` was called with `setTimeoutSpy.mock.results[0]!.value` (the abort timer's id)
- [ ] Deletion Test: temporarily removing `clearTimeout(abortTimeoutId)` now fails the test, then restore

**Source:** Cycle-8 audit finding C8-F02 — severity 6 — convergence 2/8 (Agents A, W) — Rule 18 violation, LIVE.

---
