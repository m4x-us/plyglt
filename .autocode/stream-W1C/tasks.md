# Stream W1C Task State

### Task #534: Fix requirements: desktop passive notification never applies the session-floor treatment its mobile sibling now gets

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Desktop passive notification body uses raw `computeDue()` (`totalDue`) verbatim, never floored to `INTERRUPT_SESSION_FLOOR` (6), unlike the server push this batch just fixed (`dueEstimate.ts:89`). `hooks/useInterruptConfig.ts`'s `computeDue` was not updated to mirror Batch 23's new floor-fill magnitude, so desktop undercounts true session size in the ordinary non-empty case. `components/InterruptHandler.test.tsx:550,564,694` assert the stale "1 card ready — 2 min study break?" text and actively pin the regression. Rule 19: sibling call site of the identical announce-card-count pattern the server side just fixed was left unhardened. Independently found by 4 auditors (A, B, W, R) — the audit's highest-convergence finding.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:notification body / computeDue:179
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F001 — severity 6 — requirements

---

---

### Task #537: Fix tests: stale test title now describes a false general rule

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Test titled "does not flex when isInterrupt is true but queue is non-empty" now describes a false general rule since Batch 23 deliberately does fill non-empty queues in the very next describe block; it only still passes because of specific default mocks, misleading for future maintainers reading the test name as documentation.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:describe block:249
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F004 — severity 2 — tests

---

---

### Task #542: Fix performance: full-catalog scan on every interrupt mount has no documented budget

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The getNearDueCards binding passed into useStudySession scans the full ~30,609-card catalog (`allCards`) via a synchronous filter+sort on every interrupt mount, up to 4 times across the fill pipeline. Unbounded-growth perf debt with no documented budget, not yet a measured real problem.
NEW

**Acceptance Criteria:**
- [ ] Fix performance issue at app/study/page.tsx:getNearDueCards binding:73
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F009 — severity 3 — performance

---

---

### Task #543: Fix tests: four compounding seam-test gaps around the interrupt fill pipeline

**File:** components/InterruptHandler.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Four compounding seam-test gaps: app/study/page.test.tsx mocks useStudySession entirely, useStudySession.test.ts mocks getNearDueCards entirely, the page.tsx:73 binding itself is asserted by zero tests, and InterruptHandler.test.tsx's srsStore mock does not implement getNearDueCards at all — currently silently safe only because the getStats stub always returns non-zero due, an incidental (not designed) protection that could break on an unrelated future change. Rule 13.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at components/InterruptHandler.test.tsx:srsStore mock:0
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.test.tsx

**Source:** Audit finding F010 — severity 4 — tests

---

---

### Task #552: Fix edge-case: initialQueue useMemo missing allCards dependency (pre-existing, flagged for cold-start interaction with this batch's guarantee)

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
initialQueue's useMemo references `allCards` in its body but omits it from the dependency array (react-hooks/exhaustive-deps disabled); verified via `git show f5f1305 -- app/study/page.tsx` that this dependency array and eslint-disable predate Batch 23 (only the INTERRUPT_CARD_LIMIT to INTERRUPT_SESSION_CAP constant swap touched this block) — pre-existing and out of scope for this batch's verdict. Noted because a cold-start pack-loading race on this exact line could freeze initialQueue at `[]` before ALL_UNITS populates, permanently defeating the never-empty guarantee this batch exists to deliver, most plausibly via the push-tap cold-start path.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/study/page.tsx:initialQueue useMemo:60
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F019 — severity 3 — edge-case

---

---

### Task #553: Fix tests: useLangPack mock cannot catch a pack-loading-race regression

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
useLangPack mock hardcodes `loading:false` in every test case; structurally cannot catch Task #552's issue even if that pre-existing issue is real, a genuine test-coverage gap regardless of Task #552's in-scope status.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:useLangPack mock:78
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F020 — severity 2 — tests

---

---

### Task #555: Fix tests: weak greater-than-or-equal assertion where an exact value is provable

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Test uses `toBeGreaterThanOrEqual(1)` where an exact `toBe(1)` is provable given the test's own setup; weak but self-consistent with the test's stated intent, not full pseudocode. Rule 18 nit.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:n/a:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F022 — severity 2 — tests

---

---

### Task #556: Fix tests: 4-card-to-6 top-up test only asserts queue length, not exact contents

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This test only asserts `toHaveLength(6)` on the final queue rather than the exact array of ids; a wrong or duplicate id landing at length 6 would slip through this specific assertion undetected, weaker than sibling tests in the same file. A separate exact-array assertion on introduceCard's call arguments still catches ordering, but not the queue's own final contents.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:"tops up a 4-card interrupt queue to 6":0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F023 — severity 3 — tests

---

---

### Task #557: Fix tests: no test exercises the real INTERRUPT_SESSION_CAP=8 slicing behavior

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No test exercises the actual INTERRUPT_SESSION_CAP=8 slicing behavior in app/study/page.tsx's initialQueue memo; only a mock constant was added to the test file, with nothing asserting the real 8-card cap fires against a real oversized queue.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:INTERRUPT_SESSION_CAP mock:0
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F024 — severity 3 — tests

---

---

### Task #559: Fix tests: "never duplicates a near-due card" test doesn't prove the loop-level dedup check is load-bearing

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This test passes even with the loop-level dedup check (`if (sessionIds.has(card.id)) continue;`) deleted, because an outer setQueue filter independently re-deduplicates; the test proves the composite pipeline is duplicate-free but does not prove the loop-level check itself is load-bearing. Deletion-test failure, Rule 18.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:"never duplicates a near-due card" test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F026 — severity 3 — tests

---

---

