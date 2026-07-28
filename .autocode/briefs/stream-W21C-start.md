# Charles — Stream W21C — Wave 21 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Charles | W21C | #470 #471

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #470 — Fix documentation: generationGuard.ts's corrected header now contradicts two sibling docs touched the same wave
2. /task #471 — Fix test-quality: featureFlags.ts's TRUTHY_FLAG_VALUES second entry ("1") is never exercised by any test

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Charles — W21C
[✓] #470 — generationGuard.ts sibling-doc contradiction   ← done
[→] #471 — featureFlags.ts TRUTHY_FLAG_VALUES "1" untested   ← starting now
[ ] (none)

## Files You Own (edit ONLY these)
lib/basePackLoader.ts
tests/generationGuard.test.ts
tests/featureFlags.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/importBackup.ts
tests/importBackup.test.ts
scripts/validatePack.ts
tests/validatePack.test.ts
tests/entitlementCrossTabSync.test.ts
tests/fetchWithTimeout.test.ts
vitest.config.ts

Note: lib/generationGuard.ts itself is NOT in your owned list — it was already corrected
in Wave 20 (Task #456) and does not need further changes; you're fixing the two files that
still contradict it.

## Task Definitions

### Task #470: Fix documentation: generationGuard.ts's corrected header now contradicts two sibling docs touched the same wave

**File:** lib/basePackLoader.ts, tests/generationGuard.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope doc fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #456 (Wave 20) corrected lib/generationGuard.ts's header to state all 3 GenerationGuard adoptions are complete ("none is a carry-forward"). But lib/basePackLoader.ts:78-79 — touched that SAME wave for the fetchWithTimeout swap — still says "that file's adoption is a tracked carry-forward," directly contradicting the just-corrected header. tests/generationGuard.test.ts:3 also still says "via carry-forward." Three files now disagree on the same fact. This is a direct recurrence, one file away, of the exact citation-staleness class Task #456 itself existed to close (Rule 23: a fix must not recreate its own defect class).

**Acceptance Criteria:**
- [ ] lib/basePackLoader.ts's comment updated to state specialtyPackLoader's adoption is complete, not a carry-forward
- [ ] tests/generationGuard.test.ts's comment updated to match
- [ ] No behavior change — documentation only
- [ ] Before closing, grep the whole repo for "carry-forward" to make sure no FOURTH file makes the same stale claim (this exact defect class is what you're fixing — check you're not leaving a sibling behind again)

**Source:** Cycle-7 audit finding F04 — severity 4 — Rule 23 direct hit.

---

### Task #471: Fix test-quality: featureFlags.ts's TRUTHY_FLAG_VALUES second entry ("1") is never exercised by any test

**File:** tests/featureFlags.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #462 (Wave 20) made parseFlag symmetric via TRUTHY_FLAG_VALUES = ["true", "1"], mirroring the existing FALSY_FLAG_VALUES. tests/featureFlags.test.ts exhaustively enumerates the falsy side via it.each(["0","off","False","no","NO"]) per Rule 16, but never once sets a flag env var to "1" — only "true" is tested. Deletion Test fails: removing "1" from TRUTHY_FLAG_VALUES breaks zero existing tests.

**Acceptance Criteria:**
- [ ] A test sets a flag env var to "1" and asserts it resolves to enabled=true, for both a default-off and default-on flag
- [ ] Deletion Test: removing "1" from TRUTHY_FLAG_VALUES now fails the new test (verify this by temporarily reverting and confirming, then restoring)

**Source:** Cycle-7 audit finding F05 — severity 4 — Rule 16 violation, LIVE.

## When You Finish
Write your completion summary to .autocode/stream-W21C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #470 #471
NOT_CLOSED: none

(Or the appropriate variant if incomplete.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W21C | #470 #471
