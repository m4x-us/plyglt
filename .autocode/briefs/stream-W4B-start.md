# Barry — Stream W4B — Wave 4 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W4B | #568 #581

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Both your tasks are "make a doc/comment accurately describe the CURRENT code" — and the code
changed in Wave 3 (already merged to main). Read `hooks/useStudySession.ts`'s current mount
effect and `lib/queue.ts`'s current `INTERRUPT_FLEX_DAILY_MAX` definition FIRST (both
read-only reference for you this wave) before writing either fix — do not describe the
pre-Wave-3 mechanism.

## Your Tasks (run in this exact order)
1. /task #568  — Fix code-quality: CLAUDE.md's architecture entry for useStudySession.ts is stale
2. /task #581  — Fix code-quality: lib/queue.ts's INTERRUPT_FLEX_DAILY_MAX comment overclaims

KEY FACT FROM WAVE 3 (already merged, read the real code to confirm): the daily flex ceiling
is now enforced via a live, per-iteration `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`
call inside the `while` loop's own condition — not a single check computed once before the
loop starts (that was the bug; it's fixed now). Both your tasks should describe THIS
mechanism, not the old one.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W4B
[→] #568 — Fix code-quality: CLAUDE.md stale entry   ← starting now
[ ] #581 — Fix code-quality: lib/queue.ts comment overclaim

## Files You Own (edit ONLY these)
CLAUDE.md
lib/queue.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
hooks/useStudySession.test.ts
tests/srsStore.test.ts
docs/INTERRUPT_ARCHITECTURE.md
hooks/useStudySession.ts (read-only reference — already fixed in Wave 3)
store/srsStore.ts (read-only reference)

## Task Definitions

### Task #568: Fix code-quality: CLAUDE.md's architecture entry is stale

**File:** CLAUDE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
CLAUDE.md's own Architecture section 1 entry for hooks/useStudySession.ts still describes the interrupt flex gate as canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER) -- stale relative to the actual Task #551 implementation, which replaced that unbounded call with INTERRUPT_FLEX_DAILY_MAX. docs/INTERRUPT_ARCHITECTURE.md is accurate; this project-root doc is not.

As of Wave 3 (Task #562), the mechanism changed AGAIN — it's no longer even a single
`canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` call before the loop; it's now
re-evaluated inside the while loop's own condition, per iteration. Update CLAUDE.md's
`hooks/useStudySession.ts` bullet to describe the CURRENT (post-Wave-3) mechanism accurately.
Also note in that same bullet that the never-empty backstop (previously described in this
same CLAUDE.md entry, referencing Task #533) was deleted entirely in Wave 3 (Task #565) — the
existing CLAUDE.md prose about "A final Task #533 backstop preserves the original
never-completely-empty guarantee..." is now false and needs updating or removing.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at CLAUDE.md:hooks/useStudySession.ts architecture entry:0
- [ ] Audit passes: real Verification Gate (tsc, npm test, npm run lint) — `scripts/deep-audit.sh` does not exist in this repo

**Source:** Audit finding F007 — severity 2 — code-quality

---

### Task #581: Fix code-quality: lib/queue.ts's INTERRUPT_FLEX_DAILY_MAX comment overclaims

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The comment on INTERRUPT_FLEX_DAILY_MAX claims it bounds total same-day flex introductions and gives a real cross-session ceiling with no store-layer change needed. This is false for the same reason described in F001: the value is checked once per session mount, not once per introduction, so it does not actually bound the total as claimed.

This is now FIXED by Wave 3's Task #562 — the per-iteration recheck means the comment's claim is now TRUE, it just needs to describe the actual mechanism (checked inside the while loop, per introduction) rather than the old, now-inaccurate "no store-layer change needed, checked once" framing (which was itself describing the buggy behavior as if it were correct). Rewrite the comment to accurately describe the current, correct enforcement.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX comment:0
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F020 — severity 3 — code-quality

---

## When You Finish
Write your completion summary to .autocode/stream-W4B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W4B | #568 #581
