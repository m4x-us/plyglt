# Stream W24C Task State

### Task #492: Fix data-loss: validatePack's new blank-id dedup guard excludes blank-id cards from duplicate detection entirely

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The Task #480 `id.trim() === ""` guard excludes any card with `id: ""` or `id: "   "` from the `ids` Set before duplicate detection runs, so any number of cards sharing a blank id now produce ZERO errors from this specific loop — where previously two such cards would have been flagged as duplicates (as a blank-string entry in the "Duplicate card IDs" list). No check in this loop separately reports a missing/blank id as its own error (`validateCard` does, in a different function/loop, so the gap is not a total loss of signal, but this specific dedup check no longer flags blank-id collisions at all). at scripts/validatePack.ts (dedup loop).

**Acceptance Criteria:**
- [ ] Decide and implement: either track blank/invalid ids separately so N>=2 cards sharing a blank id are still flagged as a distinct "duplicate blank id" condition, or explicitly document why relying solely on validateCard's separate per-card check is sufficient
- [ ] Add a test with 3+ cards sharing a blank id, confirming the chosen behavior is intentional (either a specific error is emitted, or the design decision is asserted/documented)

**Source:** Cycle-10 audit finding F008 — severity 5.

---
