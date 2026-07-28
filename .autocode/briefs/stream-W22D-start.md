# Derek — Stream W22D — Wave 22 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Derek | W22D | #477

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Task
1. /task #477 — Fix data-integrity: parseBackup's #467 fix gives a truthy non-number _version a worse error message than the scenario it was written to protect against

STATUS BOARD RULE — MANDATORY: After completing the task, print your status board:

Derek — W22D
[✓] #477 — parseBackup version-mismatch message quality   ← done

## Files You Own (edit ONLY these)
lib/importBackup.ts
tests/importBackup.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/entitlementCrossTabSync.ts
tests/entitlementCrossTabSync.test.ts
tests/fetchWithTimeout.test.ts
scripts/validatePack.ts
tests/validatePack.test.ts

## Task Definition

### Task #477: Fix data-integrity: parseBackup's #467 fix gives a truthy non-number _version a worse error message than the scenario it was written to protect against

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #467's own rationale explicitly cites "a genuinely newer app version that ever serializes _version as a string" as a scenario to guard against. But `parseBackup({_version:"999",...})` now returns the generic "Invalid backup file — missing required fields." instead of the specific, more helpful "This backup was created by a newer version of the app... Please update plyglt." message the sibling numeric out-of-range case correctly produces. Task #467's own acceptance criteria asked for "the same or an equally clear error message" — a generic fallback is measurably less clear for the exact user this task was meant to help. The new test at tests/importBackup.test.ts:429-432 locks this weaker message in as intended behavior.

Suggested approach: after the basic shape checks pass (or fail for other reasons), if `_version` is a non-number STRING that parses as a number greater than CURRENT_BACKUP_VERSION (e.g. via `Number(data._version)` and checking it's not NaN), give it the specific "newer version... update plyglt" message instead of the generic one. Genuinely malformed non-numeric-string/object/array/boolean values should still get the generic message — don't try to make every non-number value produce the specific message, only the ones that look like a plausible future version number.

**Acceptance Criteria:**
- [ ] A truthy but non-number _version that looks like a plausible future version (e.g. a numeric string like "999") gets the specific "newer version... update plyglt" message
- [ ] Existing tests for genuinely malformed (non-numeric, e.g. object/array/boolean) _version values continue to get the generic message — update/add tests accordingly
- [ ] If you decide a full fix is out of proportion to the finding's severity, it's acceptable to instead explicitly document the tradeoff (generic message accepted for all non-number cases) in a code comment and in your completion report — but attempt the more precise fix first

**Source:** Cycle-8 audit finding C8-F04 — severity 5 — execution-verified (Agent W), message-quality regression, LIVE.

## When You Finish
Write your completion summary to .autocode/stream-W22D/completion.md, beginning with:

CLOSED: #477
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Derek is done."

— Derek | W22D | #477
