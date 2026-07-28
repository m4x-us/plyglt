# Barry — Stream W23B — Wave 23 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Barry | W23B | #480

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Task
1. /task #480 — Fix code-quality: validatePack's dedup loop still collides on empty/whitespace-only card ids after Task #478's partial fix

STATUS BOARD RULE — MANDATORY: After completing the task, print your status board:

Barry — W23B
[✓] #480 — validatePack dedup loop empty-string id gap   ← done

## Files You Own (edit ONLY these)
scripts/validatePack.ts
tests/validatePack.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/importBackup.ts
tests/importBackup.test.ts
store/entitlementCrossTabSync.ts
tests/entitlementCrossTabSync.test.ts

## Task Definition

### Task #480: Fix code-quality: validatePack's dedup loop still collides on empty/whitespace-only card ids after Task #478's partial fix

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #478's fix (`if (!isString(id)) continue;`) closes the undefined/non-string dedup-key collision but does not replicate validateCard's compound check (`!isString(card["id"]) || card["id"].trim() === ""`). Two cards both with `id: ""` both pass `isString("")` (true), collide in the ids Set, and reproduce the exact garbled "Duplicate card IDs: " output Task #478 was supposed to eliminate. A whitespace-only id (" ") survives the same gap. Related, distinct angle: the `continue` also silently drops ANY invalid-id card from this specific loop with zero record (though validateCard's separate check still reports the shape issue elsewhere).

**Acceptance Criteria:**
- [ ] The dedup guard mirrors validateCard's exact compound check: `isString(id) && id.trim() !== ""`
- [ ] Tests cover two cards both with id:"" and both with id:" " (whitespace-only), asserting no garbled "Duplicate card IDs:" line
- [ ] The new/existing garbled-output tests also assert validateCard's own per-card id errors are still present in the result (not just the absence of the duplicate line), so the test can distinguish "correctly suppressed" from "dedup silently stopped running" — this also closes a separate finding (F010) about the existing tests being absence-only

**Source:** Cycle-9 audit finding F002 + F010 — severity 5 — convergence 5/8 — Rule 23 violation, LIVE.

## When You Finish
Write your completion summary to .autocode/stream-W23B/completion.md, beginning with:

CLOSED: #480
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Barry is done."

— Barry | W23B | #480
