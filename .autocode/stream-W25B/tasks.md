# Stream W25B Task State

### Task #489: Fix code-quality: entitlementCrossTabSync's Task #482 comment justifies keeping dead code via a generality the file's own header disclaims

**File:** store/entitlementCrossTabSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Task #488 (COMPLETE)
**Priority:** P3
**Status:** OPEN

**What:**
The module header states this module is "USED BY: store/entitlementStore.ts ONLY" and warns that calling it twice for the same store key duplicates listeners. The Task #482 comment justifies leaving the dead reject-branch in place by citing possible future reuse of this module "with a non-Zustand or differently-configured rehydrate function." A module whose own header discloses exactly one caller cannot justify unreachable code by invoking a generality its own header disclaims two paragraphs above. at store/entitlementCrossTabSync.ts (header block vs Task #482 inline comment).

**Acceptance Criteria:**
- [ ] Reconcile the header's single-caller claim with the doc comment's multi-caller justification
- [ ] No behavior change required unless Task #488 also changes something here

**Source:** Cycle-10 audit finding F005 — severity 5 — Rule 20 violation.

---

### Task #490: Fix code-quality: entitlementCrossTabSync's "confirmed with a live regression test" claim overstates what the cited test actually proves

**File:** store/entitlementCrossTabSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Task #488 (COMPLETE)
**Priority:** P3
**Status:** OPEN

**What:**
The Task #482 doc comment states the dead-branch claim is "confirmed with a live regression test." The cited test exercises only one failure injection (`getItem` rejects, no `onRehydrateStorage`); zustand's actual catch-all also applies to `migrate()` throwing, `merge()` throwing, and `setItem()` re-persist rejecting, none of which the test triggers. at store/entitlementCrossTabSync.ts (Task #482 comment block).

**Acceptance Criteria:**
- [ ] Narrow the doc comment's claim to name specifically which failure path the cited test covers
- [ ] If Wave 24's Task #488 rewrite already lists both tested failure sources by name and no longer makes a blanket claim, this may already be substantively closed — confirm explicitly rather than rewriting an already-accurate comment

**Source:** Cycle-10 audit finding F006 — severity 4.

---
