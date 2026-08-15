# Stream W3C Task State

### Task #567: Fix edge-case: getNewCards filters only on FSRS progress and prerequisites, never checking introductions[card

**File:** store/srsStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
getNewCards filters only on FSRS progress and prerequisites, never checking introductions[card.id] -- unlike lib/srs.ts's selectQualifyingNewCard, which the real session-open fill logic actually uses and which explicitly excludes cards with an existing IntroductionRecord. hooks/useInterruptConfig.ts's computeDue reads getNewCards at both the normal-cap and flex-fallback checks: a card mid-intensive-phase that already met today's appearance quota but has no FSRS progress yet still satisfies getNewCards, so computeDue can fire an interrupt for content the real fill logic will refuse to introduce. at store/srsStore.ts:getNewCards:180.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at store/srsStore.ts:getNewCards:180
- [ ] Audit passes: bash scripts/deep-audit.sh store/srsStore.ts

**Source:** Audit finding F006 — severity 5 — edge-case

---

---

### Task #569: Fix edge-case: onStudyMore is gated only on !isGlobal, which is also true for isInterrupt sessions

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
onStudyMore is gated only on !isGlobal, which is also true for isInterrupt sessions. For an interrupt session allCards is the full cross-unit catalog and buildQueue is called with globalMode=false (interleaving up to SESSION_NEW_LIMIT=15 brand-new cards) with no INTERRUPT_SESSION_CAP slice applied to the result, unlike the initialQueue construction which does slice. A user finishing a normal 6-8 card interrupt session and tapping Study more can get a session of 15+ new cards with no interrupt-specific limit applied. No test in app/study/page.test.tsx exercises onStudyMore or asserts on buildQueue's call arguments. at app/study/page.tsx:onStudyMore handler:116.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/study/page.tsx:onStudyMore handler:116
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F008 — severity 7 — edge-case

---

---

### Task #583: Fix code-quality: A code comment claims getNearDueCards is called up to 4x per mount

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
A code comment claims getNearDueCards is called up to 4x per mount. This is false: it is called exactly once per useStudySession mount. The 4x figure conflates a different function entirely, computeDue's per-unit loop in hooks/useInterruptConfig.ts, with a number that matches neither function's actual call count. at app/study/page.tsx:Task #542 comment on getNearDueCards:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/study/page.tsx:Task #542 comment on getNearDueCards:0
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F022 — severity 3 — code-quality

---

---

### Task #571: Fix tests: Uses toBeGreaterThanOrEqual(1) instead of toBe(1) for a test named introduces exactly one new card

**File:** tests/seam_studyLoop.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Uses toBeGreaterThanOrEqual(1) instead of toBe(1) for a test named introduces exactly one new card. This passes even if multiple cards were introduced in a single mount, which would violate the one-new-card-per-day cap the feature exists to enforce. at tests/seam_studyLoop.test.ts:introduces exactly one new card test:44.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/seam_studyLoop.test.ts:introduces exactly one new card test:44
- [ ] Audit passes: bash scripts/deep-audit.sh tests/seam_studyLoop.test.ts

**Source:** Audit finding F010 — severity 5 — tests

---

---

