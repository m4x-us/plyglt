# Stream W6C Task State

### Task #256: Fix documentation-trust: stale migration comment describes a NaN failure mode that no longer exists

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`store/migrations.ts`'s v2→v3 migration comment (lines ~50-52) describes "an empty string or calendar-invalid date would produce NaN in getDayOfPhase and silently hide the card forever" — describing `getDayOfPhase`'s pre-hardening behavior. `lib/introduction.ts:getDayOfPhase` (changed in this same batch, Task #231) no longer returns NaN on invalid input — it throws `[ERR-INTRO-DATE]`. The comment documents a failure mode this same batch already eliminated at the source and was never updated to say so. Found by Red Agent R (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Update the migration's comment to describe the current guard (the migration's own `isCalendarValidDate` check exists as defense-in-depth at the persistence boundary, independent of `getDayOfPhase`'s now-throwing behavior at the runtime boundary) rather than describing the old NaN-propagation failure mode as if it's still what `getDayOfPhase` does

**Done when:** The comment accurately describes current behavior, not the pre-Task-#231 NaN-propagation failure mode. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — documentation-trust — found by Red Agent R.
