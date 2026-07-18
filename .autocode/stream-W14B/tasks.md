# Stream W14B Task State

### Task #384: Fix data-loss: v2->v3 purchasedAddOns migration validates against a mutable live flag, not a purchase-time record

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The v2->v3 purchasedAddOns filter validates each stored code against the CURRENT, mutable isSpecialtyPackCode(item) result rather than a historical record of what was purchasable at the time of purchase. If a specialty pack ships ready:true, a user purchases it, and the pack later reverts to ready:false (deprecation or rollback), the next migration run for that user silently drops the paid purchase record with no warning logged anywhere. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[3]:164.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[3]:164
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F008 — severity 5 — data-loss

---

### Task #388: Fix code-quality: Task #357's deferral rationale no longer matches the test file it cites

**File:** store/entitlementStore.ts + tests/entitlement.test.ts
**Complexity:** 🔧 Full — 2 files, requires a product decision: since the stated blocking reason (tests calling purchaseAddOn with licenseType:"free") no longer holds, re-evaluate whether the Pro gate can now actually be implemented at the store layer, or fix the comment to state the real current blocker (if any) — not a mechanical doc edit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The Task #357 deferral comment states a store-level Pro gate "would break tests/entitlement.test.ts (off-limits) which calls purchaseAddOn with licenseType:'free'" — verified false against the current file: every purchaseAddOn call site now runs under a beforeEach setting licenseType:"subscription" (a Wave 13 change). A companion comment in the test file itself ("purchaseAddOn requires a Pro subscription (gate added by parallel stream)") is also factually wrong — no such gate exists. The deferral's own stated blocking reason no longer matches the file it cites, risking a future engineer accepting a stale rationale instead of re-evaluating whether the gate can now be implemented. at store/entitlementStore.ts:purchaseAddOn:278.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:purchaseAddOn:278
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F012 — severity 5 — code-quality

---

### Task #390: Fix error-handling: parseBackup checks data.entitlement only by truthiness, unlike the stricter data.srs check on the same line

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
data.entitlement is checked only by truthiness while data.srs on the same line gets a strict shape check (typeof, non-null, non-array). A backup with entitlement:"corrupted" or entitlement:5 passes this guard and silently defaults every entitlement field instead of the backup being rejected the way equally-malformed srs input would be. at lib/importBackup.ts:parseBackup:66.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/importBackup.ts:parseBackup:66
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F014 — severity 5 — error-handling

---

### Task #394: Fix async: specialty-pack load in flight during deactivation can re-populate memCache with stale entitlement

**File:** store/entitlementStore.ts:clearEntitlement + lib/specialtyPackLoader.ts:loadSpecialtyPack
**Complexity:** 🔧 Full — 2 files, requires a real concurrency-control design (re-validate purchasedAddOns or a deactivation-generation counter inside _mergeFromJson immediately before merging, not just at loadSpecialtyPack's entry) — not a mechanical fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
A specialty-pack load in flight during deactivation takes purchasedAddOns as a one-time snapshot. If clearEntitlement's eviction completes and useLangPack's Task #362 re-seed effect re-populates memCache["it"] before the stale in-flight merge runs, the merge completes using pre-deactivation entitlement after purchasedAddOns has already been reset to []. Dormant only because the one registered specialty code has ready:false. at store/entitlementStore.ts:clearEntitlement:198.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:clearEntitlement:198
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F018 — severity 5 — async

---

### Task #385: Fix code-quality: clearSpecialtyCache's name overpromises — never touches memCache, needs 3 compensating comments elsewhere

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 10 violation. clearSpecialtyCache's name implies it clears specialty-pack cache state, but its body only resets loadedAddOns bookkeeping and the inFlight map — it never touches memCache, where the actual merged pack data lives. This gap is significant enough that three separate call sites carry compensating disclaimer comments warning readers not to assume the name's full scope (lib/specialtyPackLoader.ts:44 itself, and store/entitlementStore.ts's clearEntitlement twice). A name requiring three separate compensating comments to prevent misuse is a Rule 10 failure. at lib/specialtyPackLoader.ts:clearSpecialtyCache:47.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:clearSpecialtyCache:47
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F009 — severity 4 — code-quality

---

### Task #386: Fix code-quality: isPackUnlocked has no explicit-else branch for an out-of-union licenseType value

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 17c (validators enforce what they claim) gap. isPackUnlocked checks licenseType==="free" and licenseType==="subscription" but has no explicit branch for a LicenseType value outside those two — a third value falls through to unlockedPacks.some(...) with no defined behavior documented for that case. Currently unreachable via any live writer, but the function is not structurally exhaustive against its own declared union. at store/entitlementStore.ts:isPackUnlocked:131.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:isPackUnlocked:131
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F010 — severity 3 — code-quality

---

### Task #397: Fix error-handling: clearEntitlement test call sites invoke a rejectable Promise without await/catch

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts's clearEntitlement returns a Promise that can reject on eviction failure. Several call sites in tests/entitlement.test.ts invoke it without await or .catch; if an eviction genuinely failed in one of those tests, it would surface as an unhandled rejection. Only hooks/useLicenseActivation.ts's handleDeactivate awaits/catches it in production. at tests/entitlement.test.ts:1.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at tests/entitlement.test.ts:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F021 — severity 3 — error-handling

---

### Task #401: Fix code-quality: three module headers carry stale DEPENDS ON/USED BY claims

**File:** store/entitlementStore.ts + lib/importBackup.ts + store/migrations.ts
**Complexity:** ⚡ Direct — 3 files, no package boundary — kept Direct despite mechanically qualifying as Full (3 files) by /advance Complexity Audit: three independent one-line header edits, no shared logic or design decision
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts's DEPENDS ON header lists @/lib/featureFlags, which this file never imports. lib/importBackup.ts's USED BY header omits lib/exportBackup.ts, which imports CURRENT_BACKUP_VERSION, BackupSrs, and BackupEntitlement directly from it. store/migrations.ts's DEPENDS ON header omits isSpecialtyPackCode, which the file actually imports and uses. at store/entitlementStore.ts:module header:8.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:module header:8
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F025 — severity 3 — code-quality

---

