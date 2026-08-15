# Stream W2C Task State

### Task #558: Fix tests: "truly nothing left" test doesn't exercise the near-due-mirror code path

**File:** hooks/useInterruptConfig.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This test does not actually exercise the near-due-mirror code path's presence; it passes identically with that code deleted, since nearDueIds defaults to [] regardless. Deletion-test failure, Rule 18.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useInterruptConfig.test.ts:"stays at 0 (truly nothing left)" test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useInterruptConfig.test.ts

**Source:** Audit finding F025 — severity 3 — tests

---
