# Stream W6B Task State

### Task #254: Fix requirements: a stranded card with a corrupt phaseStartDate can never self-heal

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
A record that is both `strandedAcrossDays: true` and has a calendar-invalid `phaseStartDate` can never recover: `recordIntroductionResult`'s corrupt-date catch path (added by Task #247) returns before ever calling `recordResult`, and `recordResult` is the only code that clears `strandedAcrossDays` (on a correct answer). Once a record is in this combined state, `canIntroduceNewCard` stays permanently blocked for that user with no recovery except a manual store reset — narrow double-fault (requires both stranding AND date corruption on the same record), but a genuine permanent-block with zero test coverage in either direction. Found by Agent W (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Decide the recovery path: either (a) have the corrupt-date catch path in `recordIntroductionResult` still clear `strandedAcrossDays` on a correct answer even when `getDayOfPhase` throws (skip only the `dayOfPhase`-dependent parts of `recordResult`, not the whole update), or (b) have the migration/repair path that fixes a corrupt `phaseStartDate` also reset `strandedAcrossDays` to `false` so the card isn't permanently stuck once its date is repaired
- [ ] Add a test: a record with `strandedAcrossDays: true` and a corrupt `phaseStartDate`, call `recordIntroductionResult` with a correct answer, assert the record can eventually clear `strandedAcrossDays` and unblock `canIntroduceNewCard`

**Done when:** A test proves a stranded-and-corrupt-date record can recover, not stay permanently blocked. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — requirements — found by Agent W.
