# Adam — Stream W25A — Wave 25 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Adam | W25A | #486

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Wave 24 (previous wave) landed Task #485, which extracted a shared `isValidBackupVersionNumber(v)`
predicate (`isFinite(v) && v > 0`) used by both the string and numeric `_version` branches in
`lib/importBackup.ts`. That predicate was deliberately left WITHOUT a `Number.isInteger` check —
this task (#486) is exactly where that's supposed to be added. Read the existing predicate and
its comment before writing anything; extend it, don't duplicate it.

## Your Task
1. /task #486 — Fix edge-case: parseBackup's numeric _version branch has no negative/fractional floor — Task #479 only ported the isFinite check, not the accompanying constraint

STATUS BOARD RULE — MANDATORY: After completing the task, print your status board:

Adam — W25A
[✓] #486 — numeric branch fractional/negative floor   ← done

## Files You Own (edit ONLY these)
lib/importBackup.ts
tests/importBackup.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/entitlementCrossTabSync.ts

## Task Definition

### Task #486: Fix edge-case: parseBackup's numeric _version branch has no negative/fractional floor — Task #479 only ported the isFinite check, not the accompanying constraint

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Task #485 (COMPLETE — Wave 24 landed the shared `isValidBackupVersionNumber` predicate this task extends)
**Priority:** P1

**What:**
Task #479's numeric `_version` branch (line 133) only ported the `isFinite` check from the string branch's fix, not the accompanying no-negative/no-fractional constraint that makes the string branch's `/^\d+$/` pre-check meaningful. Agent W execution-verified: `parseBackup({_version:-1,...})`, `parseBackup({_version:1.5,...})`, and `parseBackup({_version:-0.0001,...})` all return `ok:true` — a fractional or negative numeric version is silently accepted as a valid backup version. This is the recurring "one of two structurally-identical branches fixed, twin left open" pattern named in every cycle since cycle 6, recreated inside Task #479 itself — its own inline comment claims "the sibling numeric branch had the identical isFinite gap" and states it closed it, when it only ported one of two necessary guards. Note: Task #485 (Wave 24, already landed) fixed the negative/zero case via a shared `isValidBackupVersionNumber(v) => isFinite(v) && v > 0` predicate, but deliberately did NOT add a `Number.isInteger` check — `_version: 1.5` (number) is still accepted today. That is this task's remaining scope. at lib/importBackup.ts:parseBackup:103-142.

**Acceptance Criteria:**
- [ ] The numeric branch rejects fractional `_version` values (e.g. `Number.isInteger(data._version)`, added to the existing `isValidBackupVersionNumber` predicate or as an additional check alongside it — your call, but don't duplicate the existing floor logic)
- [ ] Tests cover `_version: 1.5` and `_version: -0.0001` on the numeric path, asserting rejection with the generic message (the `-1`/`0` cases are already covered by Task #485's tests — don't duplicate those, just confirm they still pass)
- [ ] Confirm whether the string branch needs a symmetric update too — a fractional numeric string like `"1.5"` is already rejected by the existing `/^\d+$/` digits-only regex (no dot allowed), so this may already be symmetric; verify this explicitly with a test rather than assuming it

**Source:** Cycle-10 audit finding F002 — severity 7 — Rule 23a violation (fix did not generalize to every member of the class), LIVE, ESCALATE.

## When You Finish
Write your completion summary to .autocode/stream-W25A/completion.md, beginning with:

CLOSED: #486
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Adam is done."

— Adam | W25A | #486
