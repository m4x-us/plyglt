# Stream W4B Task State

### Task #568: Fix code-quality: CLAUDE

**File:** CLAUDE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
CLAUDE.md's own Architecture section 1 entry for hooks/useStudySession.ts still describes the interrupt flex gate as canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER) -- stale relative to the actual Task #551 implementation, which replaced that unbounded call with INTERRUPT_FLEX_DAILY_MAX. docs/INTERRUPT_ARCHITECTURE.md is accurate; this project-root doc is not. at CLAUDE.md:hooks/useStudySession.ts architecture entry:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at CLAUDE.md:hooks/useStudySession.ts architecture entry:0
- [ ] Audit passes: bash scripts/deep-audit.sh CLAUDE.md

**Source:** Audit finding F007 — severity 2 — code-quality

---

---

### Task #581: Fix code-quality: The comment on INTERRUPT_FLEX_DAILY_MAX claims it bounds total same-day flex introductions and gives

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The comment on INTERRUPT_FLEX_DAILY_MAX claims it bounds total same-day flex introductions and gives a real cross-session ceiling with no store-layer change needed. This is false for the same reason described in F001: the value is checked once per session mount, not once per introduction, so it does not actually bound the total as claimed. at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX comment:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX comment:0
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F020 — severity 3 — code-quality

---

---

