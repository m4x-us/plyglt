# Stream W9B Task State

### Task #287: Fix edge-case: purchaseAddOn never validates its code argument against isSpecialtyPackCode; unregistered

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
purchaseAddOn never validates its code argument against isSpecialtyPackCode; unregistered or malformed strings can be injected and persist forever in purchasedAddOns, and no removal path exists anywhere in the codebase. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F027 — severity 5 — edge-case

---

### Task #285: Fix security: purchaseAddOn is an unconditional array-append with no payment, license, or receipt check

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
purchaseAddOn is an unconditional array-append with no payment, license, or receipt check of any kind, reachable by any code path since it is a plain exported store action. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F025 — severity 6 — security

---
