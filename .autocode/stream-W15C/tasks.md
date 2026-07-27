# Stream W15C Task State

### Task #393: Fix tests: seam_importRestore.test.ts's own stated scope (entitlement restore) has zero actual coverage

**File:** tests/seam_importRestore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This file's own header states its purpose is covering the backup-restore path end-to-end, but grep for licenseKey/instanceId/purchasedAddOns/setEntitlement across the file returns nothing — the entitlement-restore branch has zero seam coverage despite being squarely within this test file's stated scope. at tests/seam_importRestore.test.ts:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/seam_importRestore.test.ts:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/seam_importRestore.test.ts

**Source:** Audit finding F017 — severity 4 — tests

---

