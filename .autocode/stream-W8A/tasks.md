# Stream W8A Task State

### Task #263: Fix security: clearEntitlement resets purchasedAddOns to [] but never calls clearSpecialtyCache()/clearS

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
clearEntitlement resets purchasedAddOns to [] but never calls clearSpecialtyCache()/clearSpecialtyPacksForLang(). A license deactivation mid-session leaves already-merged specialty content fully accessible in memCache for the rest of the session; loadedAddOns never resyncs with the store. at store/entitlementStore.ts:clearEntitlement:111.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:clearEntitlement:111
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F003 — severity 7 — security

---

### Task #286: Fix requirements: purchaseAddOn's name and its own comment imply a verified purchase-recording function; the

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
purchaseAddOn's name and its own comment imply a verified purchase-recording function; the implementation has no Promise return, no payment token, no verification, and has zero production callers anywhere, even as a stub. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F026 — severity 5 — requirements

---

### Task #288: Fix async: Zustand's persist middleware writes localStorage from in-memory state at call time, not me

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Zustand's persist middleware writes localStorage from in-memory state at call time, not merged against the on-disk value. Two browser tabs racing on purchaseAddOn for different specialty codes causes the second tab's write to silently overwrite and drop the first tab's purchase. at store/entitlementStore.ts:purchaseAddOn (Zustand persist):140.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:purchaseAddOn (Zustand persist):140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F028 — severity 6 — async

---

### Task #264: Fix async: Two race conditions: same-code concurrent loads both pass loadedAddOns.includes before eit

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Two race conditions: same-code concurrent loads both pass loadedAddOns.includes before either pushes (duplicate merge); cross-code concurrent loads sharing a base language each read the base pack independently after their own await, and whichever memCache.merge() resolves last silently discards the other's merge while getLoadedAddOns() reports both as loaded. No locking, mutex, or CAS exists anywhere in this module. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F004 — severity 7 — async

---

### Task #265: Fix security: sha256 verification is skipped entirely, with no fail-closed else branch, when manifest?.p

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
sha256 verification is skipped entirely, with no fail-closed else branch, when manifest?.packs?.[lang] is absent for the requested specialty code. Arbitrary content is parsed and merged into the base pack's in-memory cache with zero integrity check. at lib/specialtyPackLoader.ts:loadSpecialtyPack:45.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:45
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F005 — severity 8 — security

---

### Task #290: Fix code-quality: The file header claims 'Pure functions only - no React, no Zustand', but loadSpecialtyPack

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The file header claims 'Pure functions only - no React, no Zustand', but loadSpecialtyPack performs fetch() I/O, console.error() side effects, and mutates module-level loadedAddOns via push/splice/length-reset. at lib/specialtyPackLoader.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F030 — severity 3 — code-quality

---
