# Derek — Stream W21D — Wave 21 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Derek | W21D | #472 #473

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #472 — Fix test-quality: fetchWithTimeout.test.ts's "backstop does not fire" test is pseudocode
2. /task #473 — Fix CI structural gap: vitest.config.ts excludes scripts/ from coverage, hiding this batch's own validator logic from the Verification Gate

Do #472 first, then #473 — #473 may change what counts toward coverage thresholds, so it's
cleaner to have #472's test fix already in place before re-checking the coverage numbers.

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Derek — W21D
[✓] #472 — fetchWithTimeout.test.ts pseudocode test fix   ← done
[→] #473 — vitest.config.ts scripts/ coverage exclusion   ← starting now
[ ] (none)

## Files You Own (edit ONLY these)
tests/fetchWithTimeout.test.ts
vitest.config.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/importBackup.ts
tests/importBackup.test.ts
scripts/validatePack.ts
tests/validatePack.test.ts
tests/entitlementCrossTabSync.test.ts
lib/basePackLoader.ts
tests/generationGuard.test.ts
tests/featureFlags.test.ts

## Task Definitions

### Task #472: Fix test-quality: fetchWithTimeout.test.ts's "backstop does not fire" test is pseudocode

**File:** tests/fetchWithTimeout.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
The test "the backstop timer does not fire (no unhandled rejection) when fetch settles first" (line 76) claims to prove the backstop timer is inert after early settlement, but deleting the finally block's clearTimeout(backstopTimeoutId!) would NOT fail this test — Promise.race already attaches a rejection handler to the backstop promise at race-call time, so a later, uncleared rejection becomes an already-handled promise with no observable effect the test can detect. This is a Rule 18 (Test Falsifiability / B7) violation in a brand-new file authored this same wave specifically to close a prior test-quality gap.

**Acceptance Criteria:**
- [ ] The test is rewritten to actually prove the timer was cleared — e.g. spy on global clearTimeout and assert it was called with the backstop's timer ID, or another mechanism that would observably fail if the timer fired uncleared
- [ ] Deletion Test: temporarily remove the finally block's clearTimeout(backstopTimeoutId!), confirm the rewritten test now fails, then restore the fix

**Source:** Cycle-7 audit finding F06 — severity 4 — Rule 18 violation.

---

### Task #473: Fix CI structural gap: vitest.config.ts excludes scripts/ from coverage, hiding this batch's own validator logic from the Verification Gate

**File:** vitest.config.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
vitest.config.ts's coverage.exclude list includes "scripts" — meaning scripts/validatePack.ts's substantial new logic this batch (Task #459's prerequisites and unitCount/cardCount cross-checks) cannot move the Verification Gate's coverage percentages at all. This is structurally the same shape as cycle 6's own headline finding ("the gate doesn't scan what it claims to guard"), just inverted. Not currently exploitable — lib/packTypes.ts's hasValidUnitsArray runtime guard independently enforces the same invariants — but the gate's green status says nothing about this batch's own new validator code.

**Acceptance Criteria:**
- [ ] scripts/ is removed from coverage.exclude, or a documented, deliberate reason is written for why it stays excluded
- [ ] If included: run the full coverage suite and confirm thresholds still pass with scripts/ counted (tests/validatePack.test.ts already exists and should cover the bulk of it — check whether other files under scripts/, like exportPack.ts or checkCardIds.ts, drag the average down and need their own coverage or an explicit narrower exclude)

**Source:** Cycle-7 audit finding F07 — severity 4 — structural CI/coverage-gate risk, echoes cycle 6's own root cause.

## When You Finish
Write your completion summary to .autocode/stream-W21D/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #472 #473
NOT_CLOSED: none

(Or the appropriate variant if incomplete — if including scripts/ in coverage breaks the
threshold and can't be cleanly fixed within this task's scope, it's fine to instead choose
the "documented deliberate reason to stay excluded" acceptance-criteria option and note that
choice clearly in your completion report.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W21D | #472 #473
