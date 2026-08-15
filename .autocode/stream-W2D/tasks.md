# Stream W2D Task State

### Task #560: Fix tests: "keeps an estimate above the floor exact" test doesn't prove the floor exists

**File:** tests/pushDueEstimate.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This test (cardCount:9) passes identically whether the Math.max floor logic exists or is deleted, since 9 is greater than 6 either way; it does not prove the floor exists, only re-exercises pre-existing plural-formatting coverage. Deletion-test failure, Rule 18, and the same test line that empirically demonstrates Task #544's overflow bug.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/pushDueEstimate.test.ts:"keeps an estimate above the floor exact":107
- [ ] Audit passes: bash scripts/deep-audit.sh tests/pushDueEstimate.test.ts

**Source:** Audit finding F027 — severity 3 — tests

---
