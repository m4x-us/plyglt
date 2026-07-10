# Stream W10B Task State

### Task #275: Fix code-quality: lib/packLoader.ts is 428 lines, over the 400-line service cap (Rule 1), despite two prior

**File:** lib/packLoader.ts
**Complexity:** 🔧 Full — 3+ files (bringing the file under the 400-line cap requires extracting further logic into a new module and updating every caller's imports, not an in-place edit)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/packLoader.ts is 428 lines, over the 400-line service cap (Rule 1), despite two prior extractions. at lib/packLoader.ts:N/A (file-level):428.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:N/A (file-level):428
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F015 — severity 3 — code-quality

---
