# Stream W19D Task State

### Task #450: Fix test-quality: EntitlementValidator.test.tsx has a test that doesn't prove its own name, plus banned assertions that evade the project's grep gate

**File:** components/EntitlementValidator.test.tsx, AGENTS.md
**Complexity:** ⚡ Direct — 2 files, no package boundary — fix the test + widen the gate's scan scope
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The test claiming to prove "mounts UpdateChecker as its invisible child" (line 178) asserts only expect(result).not.toBeNull(), which would pass regardless of what the component actually returns. Separately, two .toBeGreaterThan(0) assertions on Date.now()-stamped fields (lines 128, 164) carry no inline // existence-check: justification as AGENTS.md mandates — and because this file lives under components/, the repo's Verification Gate grep command (scoped to tests/ only) never catches it. This is a live instance of a gap already flagged as theoretical in a Batch 18 finding. at components/EntitlementValidator.test.tsx:128.

**Acceptance Criteria:**
- [ ] The "mounts UpdateChecker" test asserts the actual rendered output contains/is UpdateChecker, not just non-null
- [ ] Both .toBeGreaterThan(0) assertions get an inline // existence-check: justification comment, or are replaced with a value-specific assertion
- [ ] The Verification Gate's banned-assertion grep command in AGENTS.md is widened to scan every *.test.* file in the repo, not only files under tests/

**Source:** Audit finding F016 — severity 6 — test-quality/gate-blind-spot (compounds Audit finding F015 / Task #454, already merged into this task)

---

### Task #451: Fix documentation: security.md's own tracked S1/S3 findings are stale — both already resolved

**File:** .autocode/agents/security.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
security.md's "Open/Monitoring" section lists S1 (purchaseAddOn code validation) and S3 (deactivation-mid-load race) as open risks, but both are already resolved: S1 — store/entitlementAddOns.ts already validates via isSpecialtyPackCode as the first guard (Task #287); S3 — lib/specialtyPackLoader.ts's deactivationGuard already re-checks isStale twice (Task #394/#409). S2 in the same section was correctly updated to reflect its fix, but S1/S3 were not. S1's own cited location ("store/entitlementStore.ts:137") is additionally stale — that code moved to store/entitlementAddOns.ts under Task #412. at .autocode/agents/security.md:47.

**Acceptance Criteria:**
- [ ] S1 and S3 moved to "Resolved Findings" with the correct current file:line citations
- [ ] No behavior/code change — documentation only

**Source:** Audit finding F013 — severity 4 — documentation-staleness/audit-memory

---

### Task #452: Fix test-quality: a hollow #435 hydration test never advances timers far enough to invoke the code it claims to test

**File:** tests/storage.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The test "#435: does not reconcile when hydration finishes normally (no failsafe, no clobber risk)" would pass on deletion of the reconciliation code under test, because it never advances timers past HYDRATION_FAILSAFE_MS — the code under test is never actually invoked regardless of whether it exists. at tests/storage.test.ts:1.

**Acceptance Criteria:**
- [ ] The test advances fake timers to a point where the reconciliation logic would actually run if it existed, and the assertion demonstrably fails when that logic is deleted (Deletion Test)

**Source:** Audit finding F020 — severity 4 — test-quality/rule-18

---

### Task #453: Fix test-quality: useLicenseActivation.test.ts asserts lastValidated via expect.any(Number) instead of a value near Date.now()

**File:** hooks/useLicenseActivation.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The "ok path..." test asserts lastValidated via expect.any(Number) instead of a value near Date.now() — a wrong implementation that passes the literal 0 (the value used by the unrelated backup-restore path) would still satisfy this assertion. Contrast with hooks/useExportImport.test.ts's sibling test, which correctly pins the exact literal. at hooks/useLicenseActivation.test.ts:47.

**Acceptance Criteria:**
- [ ] The assertion pins a value near Date.now() (fake timers or a bounded range check), not expect.any(Number)
- [ ] Deletion Test: passing a literal 0 for lastValidated now fails this test

**Source:** Audit finding F012 — severity 4 — test-quality/rule-18

---
