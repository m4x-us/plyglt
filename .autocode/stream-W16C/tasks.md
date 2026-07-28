# Stream W16C Task State

### Task #433: Fix data-loss: SRS migration validates only phaseStartDate, leaving 9 other IntroductionRecord fields unchecked

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
store/migrations.ts's SRS_MIGRATIONS[3] (lines 88-99) only validates phaseStartDate (a calendar-format check); the other 9 fields of a persisted IntroductionRecord (dayOfPhase, consecutiveCorrect, totalEncounters, lastSeenDate, appearancesToday, consecutiveWrongToday, lastSeenType, graduated) pass through via `{...record, phaseStartDate}` with zero type checking. A record with consecutiveCorrect:"many" or totalEncounters:null survives migration untouched and reaches production arithmetic on those fields. AGENTS.md explicitly names "any function that can silently corrupt persisted user data" as a stop-the-line violation. at store/migrations.ts:SRS_MIGRATIONS[3]:88.

**Acceptance Criteria:**
- [ ] All 9 remaining IntroductionRecord fields are type/shape-validated during migration, with a logged fallback for invalid values (matching the existing phaseStartDate pattern)
- [ ] Test: a record with a malformed field (e.g. consecutiveCorrect as a string) is repaired, not passed through, during migration

**Source:** Audit finding F060 — severity 6 — data-loss

---
