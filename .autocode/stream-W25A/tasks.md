# Stream W25A Task State

### Task #486: Fix edge-case: parseBackup's numeric _version branch has no negative/fractional floor — Task #479 only ported the isFinite check, not the accompanying constraint

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Task #485 (COMPLETE)
**Priority:** P1
**Status:** OPEN

**What:**
Task #479's numeric `_version` branch (line 133) only ported the `isFinite` check from the string branch's fix, not the accompanying no-negative/no-fractional constraint that makes the string branch's `/^\d+$/` pre-check meaningful. Agent W execution-verified: `parseBackup({_version:-1,...})`, `parseBackup({_version:1.5,...})`, and `parseBackup({_version:-0.0001,...})` all return `ok:true` — a fractional or negative numeric version is silently accepted as a valid backup version. Note: Task #485 (Wave 24, already landed) fixed the negative/zero case via a shared `isValidBackupVersionNumber(v) => isFinite(v) && v > 0` predicate, but deliberately did NOT add a `Number.isInteger` check — `_version: 1.5` (number) is still accepted today. That is this task's remaining scope. at lib/importBackup.ts:parseBackup:103-142.

**Acceptance Criteria:**
- [ ] The numeric branch rejects fractional `_version` values (e.g. `Number.isInteger(data._version)`, added to the existing `isValidBackupVersionNumber` predicate or as an additional check alongside it)
- [ ] Tests cover `_version: 1.5` and `_version: -0.0001` on the numeric path, asserting rejection with the generic message
- [ ] Confirm whether the string branch needs a symmetric update too — verify explicitly with a test rather than assuming it

**Source:** Cycle-10 audit finding F002 — severity 7 — Rule 23a violation (fix did not generalize to every member of the class), LIVE, ESCALATE.

---
