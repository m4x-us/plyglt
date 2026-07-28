# Stream W21C Task State

### Task #470: Fix documentation: generationGuard.ts's corrected header now contradicts two sibling docs touched the same wave

**File:** lib/basePackLoader.ts, tests/generationGuard.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope doc fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #456 (Wave 20) corrected lib/generationGuard.ts's header to state all 3 GenerationGuard adoptions are complete ("none is a carry-forward"). But lib/basePackLoader.ts:78-79 — touched that SAME wave for the fetchWithTimeout swap — still says "that file's adoption is a tracked carry-forward," directly contradicting the just-corrected header. tests/generationGuard.test.ts:3 also still says "via carry-forward." Three files now disagree on the same fact. This is a direct recurrence, one file away, of the exact citation-staleness class Task #456 itself existed to close (Rule 23: a fix must not recreate its own defect class). at lib/basePackLoader.ts:79.

**Acceptance Criteria:**
- [ ] lib/basePackLoader.ts's comment updated to state specialtyPackLoader's adoption is complete, not a carry-forward
- [ ] tests/generationGuard.test.ts's comment updated to match
- [ ] No behavior change — documentation only

**Source:** Cycle-7 audit finding F04 — severity 4 — convergence 2/8 (Agents A, B) — Rule 23 direct hit (a fix reproducing its own defect class one hop away).

---

### Task #471: Fix test-quality: featureFlags.ts's TRUTHY_FLAG_VALUES second entry ("1") is never exercised by any test

**File:** tests/featureFlags.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #462 (Wave 20) made parseFlag symmetric via TRUTHY_FLAG_VALUES = ["true", "1"], mirroring the existing FALSY_FLAG_VALUES. tests/featureFlags.test.ts exhaustively enumerates the falsy side via it.each(["0","off","False","no","NO"]) per Rule 16, but never once sets a flag env var to "1" — only "true" is tested. Deletion Test fails: removing "1" from TRUTHY_FLAG_VALUES breaks zero existing tests. This is a Rule 16 (Enumerate Before You Assert) violation in the exact same wave that introduced the enumeration Rule 16 is named for. at tests/featureFlags.test.ts:1.

**Acceptance Criteria:**
- [ ] A test sets a flag env var to "1" and asserts it resolves to enabled=true, for both a default-off and default-on flag
- [ ] Deletion Test: removing "1" from TRUTHY_FLAG_VALUES now fails the new test

**Source:** Cycle-7 audit finding F05 — severity 4 — convergence 1/8 (Red Agent R) — Rule 16 violation, LIVE (gates isProEnabled broadly).

---
