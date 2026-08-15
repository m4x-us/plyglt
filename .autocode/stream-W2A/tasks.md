# Stream W2A Task State

### Task #536: Fix tests: no seam test wires the real Batch 23 fill pipeline end-to-end

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No seam test wires the real app/study/page.tsx through the real useStudySession into the real store/srsStore.ts getNearDueCards/canIntroduceNewCard/introduceCard end-to-end; every layer of Batch 23's new fill pipeline is unit-tested in isolation only. Rule 13 seam-test gap.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.tsx:StudyInner:73
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F003 — severity 4 — tests

---
