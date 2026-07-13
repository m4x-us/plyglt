# Stream W12D Task State

### Task #312: Fix security: parseBackup validates unlockedPacks against isValidPackCode but filters purchasedAddOns on

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
parseBackup validates unlockedPacks against isValidPackCode but filters purchasedAddOns only to string type, no isSpecialtyPackCode check. setEntitlement spreads every property in data including purchasedAddOns. A hand-edited backup JSON imported through the live Settings import UI can inject any string into purchasedAddOns with zero validation and zero receipt check. Violates Rule 17b. at lib/importBackup.ts:parseBackup:122.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/importBackup.ts:parseBackup:122
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F018 — severity 8 — security

---

---

### Task #311: Fix tests: Uses .toBeDefined()/.toBeGreaterThan(0) on deterministic mocked values with no existence-c

**File:** hooks/useLangPack.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Uses .toBeDefined()/.toBeGreaterThan(0) on deterministic mocked values with no existence-check comment. AGENTS.md's Verification Gate greps only tests/, which does not reach co-located hooks/*.test.ts or components/*.test.tsx, so this batch's UI/hook test additions are exempt from the project's test-quality gate. at hooks/useLangPack.test.ts:test suite:83.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useLangPack.test.ts:test suite:83
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.test.ts

**Source:** Audit finding F017 — severity 6 — tests

---

---

### Task #314: Fix tests: This seam test's beforeEach unconditionally mocks invoke to return true; deleting the rece

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
This seam test's beforeEach unconditionally mocks invoke to return true; deleting the receipt-verification block inside purchaseAddOn does not change the test's outcome. The test's own name claims 'end-to-end' coverage, a specific falsifiable claim the assertions do not actually prove. at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F020 — severity 6 — tests

---

---

### Task #315: Fix tests: The same seam test's beforeEach also unconditionally mocks isSpecialtyPackCode to return t

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The same seam test's beforeEach also unconditionally mocks isSpecialtyPackCode to return true; deleting the code-validation branch inside purchaseAddOn likewise does not change the outcome. at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F021 — severity 4 — tests

---
