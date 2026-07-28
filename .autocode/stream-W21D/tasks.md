# Stream W21D Task State

### Task #472: Fix test-quality: fetchWithTimeout.test.ts's "backstop does not fire" test is pseudocode

**File:** tests/fetchWithTimeout.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The test "the backstop timer does not fire (no unhandled rejection) when fetch settles first" (line 76) claims to prove the backstop timer is inert after early settlement, but deleting the finally block's clearTimeout(backstopTimeoutId!) would NOT fail this test — Promise.race already attaches a rejection handler to the backstop promise at race-call time, so a later, uncleared rejection becomes an already-handled promise with no observable effect the test can detect. This is a Rule 18 (Test Falsifiability / B7) violation in a brand-new file authored this same wave specifically to close a prior test-quality gap. at tests/fetchWithTimeout.test.ts:76.

**Acceptance Criteria:**
- [ ] The test is rewritten to actually prove the timer was cleared — e.g. spy on clearTimeout, or use a mechanism that would observably fail if the timer fired uncleared
- [ ] Deletion Test: removing the finally block's clearTimeout(backstopTimeoutId!) now fails the rewritten test

**Source:** Cycle-7 audit finding F06 — severity 4 — convergence 2/8 (Agents K, V) — Rule 18 violation.

---

### Task #473: Fix CI structural gap: vitest.config.ts excludes scripts/ from coverage, hiding this batch's own validator logic from the Verification Gate

**File:** vitest.config.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
vitest.config.ts's coverage.exclude list includes "scripts" — meaning scripts/validatePack.ts's substantial new logic this batch (Task #459's prerequisites and unitCount/cardCount cross-checks) cannot move the Verification Gate's coverage percentages at all. This is structurally the same shape as cycle 6's own headline finding ("the gate doesn't scan what it claims to guard"), just inverted (scope too narrow rather than newly-widened-and-ignored). Not currently exploitable — lib/packTypes.ts's hasValidUnitsArray runtime guard independently enforces the same invariants — but the gate's green status says nothing about this batch's own new validator code. at vitest.config.ts:26.

**Acceptance Criteria:**
- [ ] scripts/ is removed from coverage.exclude, or a documented, deliberate reason is written for why it stays excluded
- [ ] If included: coverage thresholds re-verified to still pass with scripts/ counted (tests/validatePack.test.ts already exists and should cover the bulk of it)

**Source:** Cycle-7 audit finding F07 — severity 4 — convergence 1/8 (Agent W) — structural CI/coverage-gate risk, echoes cycle 6's own root cause.

---
