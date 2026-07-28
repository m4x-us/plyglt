# Stream W22D Task State

### Task #477: Fix data-integrity: parseBackup's #467 fix gives a truthy non-number _version a worse error message than the scenario it was written to protect against

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #467's own rationale explicitly cites "a genuinely newer app version that ever serializes _version as a string" as a scenario to guard against. But `parseBackup({_version:"999",...})` now returns the generic "Invalid backup file — missing required fields." instead of the specific, more helpful "This backup was created by a newer version of the app... Please update plyglt." message the sibling numeric out-of-range case correctly produces. Task #467's own acceptance criteria asked for "the same or an equally clear error message" — a generic fallback is measurably less clear for the exact user this task was meant to help. The new test at tests/importBackup.test.ts:429-432 locks this weaker message in as intended behavior. at lib/importBackup.ts:94.

**Acceptance Criteria:**
- [ ] A truthy but non-number _version that looks like a plausible future version (e.g. a numeric string) gets the specific "newer version... update plyglt" message where reasonable, or the tradeoff of using the generic message is explicitly documented and accepted in this task's resolution
- [ ] Existing tests for genuinely malformed (non-numeric, e.g. object/array/boolean) _version values continue to get the generic message

**Source:** Cycle-8 audit finding C8-F04 — severity 5 — convergence 1/8 (Agent W, execution-verified) — message-quality regression, LIVE.

---
