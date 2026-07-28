# Stream W18B Task State

### Task #438: Fix async: clearEntitlement flips entitlement state before specialty-content eviction completes

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts:clearEntitlement:203-234's synchronous set({...}) flips licenseType to "free" and clears purchasedAddOns/unlockedPacks BEFORE the specialty-content eviction (Promise.all(...evictPack...), resetSpecialtyLoadState()) has run. Any code reading memCache directly during that window still serves previously-merged specialty content — entitlement state and cached data are observably inconsistent for the eviction's I/O duration. at store/entitlementStore.ts:clearEntitlement:203.

**Acceptance Criteria:**
- [ ] Entitlement state and memCache eviction complete atomically from any external observer's perspective (e.g. eviction awaited before the state flip, or a documented/tested acceptable window)
- [ ] Test: a read of memCache during clearEntitlement's in-flight eviction does not return already-cleared-should-be-inaccessible specialty content

**Source:** Audit finding F065 — severity 4 — async

---

### Task #412: Fix code-quality: store/entitlementStore.ts is 431 lines, over Rule 1's 400-line service cap

**File:** store/entitlementStore.ts
**Complexity:** 🔧 Full — extract a cohesive slice (e.g. specialty/add-on actions) to a sibling module
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts is 431 lines, over Rule 1's 400-line service cap, and was not present in .autocode/debt.md as tracked debt — an untracked Rule 1 violation on the most security-relevant store in the codebase. at store/entitlementStore.ts:module:1.

**Acceptance Criteria:**
- [ ] File split so no resulting file exceeds 400 lines, following the same extraction pattern used for lib/packLoader.ts → lib/basePackLoader.ts
- [ ] All existing tests pass unchanged
- [ ] CLAUDE.md updated with the new module's role

**Source:** Audit finding F009 — severity 4 — code-quality

---

### Task #423: Fix code-quality: license-key length check hardcoded instead of a named constant

**File:** hooks/useLicenseActivation.ts, store/entitlementStore.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
hooks/useLicenseActivation.ts:25 hardcodes `key.length > 200` inline with a comment instead of a named constant, while store/entitlementStore.ts:78's RECEIPT_TOKEN_MAX_LENGTH=200 explicitly mirrors this same rule for the parallel receipt-token check — inconsistent application of the named-constant rule. AGENTS.md lists any hardcoded string/number that belongs in a named constant as a stop-the-line violation. at hooks/useLicenseActivation.ts:handleActivate:25.

**Acceptance Criteria:**
- [ ] A shared or mirrored named constant (e.g. LICENSE_KEY_MAX_LENGTH) replaces the inline 200
- [ ] Both constants live in one obvious place or explicitly cross-reference each other

**Source:** Audit finding F024 — severity 4 — code-quality

---
