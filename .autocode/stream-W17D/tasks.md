# Stream W17D Task State

### Task #426: Fix tests: purchasedAddOns-preservation-on-restore is only tested from an empty starting state

**File:** tests/seam_importRestore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
tests/seam_importRestore.test.ts:212-239,255-286's purchasedAddOns-preservation-on-restore guarantee is asserted only from an empty starting state restoring to []. No test seeds a non-empty purchasedAddOns before restoring a backup that includes a license. Deletion Test: change setEntitlement to a full-replace instead of shallow merge — every existing test still passes. at tests/seam_importRestore.test.ts:255.

**Acceptance Criteria:**
- [ ] A test seeds a non-empty purchasedAddOns, restores a backup with a license, and asserts purchasedAddOns is unchanged
- [ ] Deletion Test: a full-replace setEntitlement now fails this new test

**Source:** Audit finding F027 — severity 4 — tests

---

### Task #440: Fix security: purchasedAddOns-excluded-from-restore guarantee is enforced only by one call site's convention, not a mechanism

**File:** hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The promise "purchased add-ons cannot be restored from an unsigned backup" is enforced only by hooks/useExportImport.ts:readFile:81's manual destructuring choice (deliberately omitting purchasedAddOns), not by any type-level or runtime guard — a future caller writing `setEntitlement({...result.entitlement, licenseKey, instanceId})` would silently reintroduce unauthenticated add-on restoration. This is not hypothetical: a stray abandoned worktree found during this audit already demonstrates exactly this regression happening in a copy of the code. at hooks/useExportImport.ts:readFile:81.

**Acceptance Criteria:**
- [ ] The exclusion of purchasedAddOns from a restored backup is enforced by a type (e.g. an Omit<> type on the restore payload) or a runtime guard, not solely by which fields a call site happens to destructure
- [ ] Test: a naive full-spread restore call is prevented at compile time or caught at runtime, not silently allowed

**Source:** Audit finding F069 — severity 5 — security

---
