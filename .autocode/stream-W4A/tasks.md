# Stream W4A Task State

### Task #563: Fix tests: No test in the suite can detect the F001 overshoot

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No test in the suite can detect the F001 overshoot. The canIntroduceNewCard mock (capUsedNotStranded) is a pure function of its own call arguments only and returns the same answer regardless of how many cards were already introduced earlier in the same render. INTERRUPT_FLEX_DAILY_MAX's actual value (9) is never asserted in any test file; a regression reverting the daily cap back to the pre-#551 Number.MAX_SAFE_INTEGER bug would pass every existing test unchanged. at hooks/useStudySession.test.ts:capUsedNotStranded mock / flexes-past-daily-cap test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:capUsedNotStranded mock / flexes-past-daily-cap test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F002 — severity 5 — tests

---

---

### Task #576: Fix tests: The regression tests explicitly requested for #538 (stranded-pause-blocks-backstop) and #541 (near-d

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The regression tests explicitly requested for #538 (stranded-pause-blocks-backstop) and #541 (near-due-interleaving) were never added to hooks/useStudySession.test.ts, by either the Wave 1 remediation stream or Wave 2. No test in the current suite regresses either specific fix. at hooks/useStudySession.test.ts:stranded-pause-blocks-backstop / near-due-interleaving regression tests:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:stranded-pause-blocks-backstop / near-due-interleaving regression tests:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F015 — severity 5 — tests

---

---

### Task #584: Fix tests: This pre-existing test only proves the outer setQueue dedup filter catches a duplicate; it does not 

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This pre-existing test only proves the outer setQueue dedup filter catches a duplicate; it does not exercise the inner loop-level check at all, a gap the test's own inline comment admits. A regression that removed the inner check would not be caught by this test. at hooks/useStudySession.test.ts:never duplicates a near-due card already in the queue test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:never duplicates a near-due card already in the queue test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F023 — severity 4 — tests

---

---

### Task #572: Fix tests: Uses toBeLessThanOrEqual(3) instead of toBe(3) for a test named respects the limit parameter

**File:** tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Uses toBeLessThanOrEqual(3) instead of toBe(3) for a test named respects the limit parameter. This passes even if the slice returned 0 or 1 cards instead of the correct 3. at tests/srsStore.test.ts:respects the limit parameter test:351.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/srsStore.test.ts:respects the limit parameter test:351
- [ ] Audit passes: bash scripts/deep-audit.sh tests/srsStore.test.ts

**Source:** Audit finding F011 — severity 5 — tests

---

---

