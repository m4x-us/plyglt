# Barry — Stream W8B — Wave 8 — 2026-08-16

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W8B | #629 #634 #630 #636 #640 #639

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

All 6 of your tasks are in hooks/useStudySession.ts. Read the whole file in full before starting — it's grown large (546 lines) across 7 remediation waves, and you'll be trimming it as part of this wave (#630) after adding real new logic (#629, #634) — so understand the current shape fully before either adding to it or extracting from it.

**#629 first (severity 7, the real bug).** The mount-fill effect has no awareness of `resumeDecision` at all — it runs its full fill pass (real `introduceCard` writes consuming daily/flex budget, near-due padding, `setQueue`) even when a resumable session is about to be offered via `StudyResumePrompt`. Since an interrupt session's `sessionKey` is always the empty string, ANY incomplete prior interrupt session (app closed, navigated away, or the existing snooze flow, none of which call `clearActiveSession`) matches ANY subsequent interrupt session. Whether the user then accepts or declines the resume prompt, the apply-resume effect unconditionally overwrites `queue` — discarding the fill pass's work — but the `introduceCard()` writes already happened and are never undone, silently burning real `INTERRUPT_FLEX_DAILY_MAX` budget on content the user never saw, which can deny a LATER real interrupt that same day its own flex fill. Design a fix: the cleanest approach is likely to have the mount-fill effect check whether a resumable session is pending (via `peekResumableSession()`, already imported) BEFORE running its fill logic, and skip the fill entirely if one is pending — the resume flow will supply its own queue/content once resolved, so a fresh fill pass for a session that's about to be superseded serves no purpose. Think through the ordering carefully: does `resumeDecision`'s own resolution effect need to run and settle BEFORE the mount-fill effect checks it, given both are gated on the same `[hydrated]` dependency and fire on the same render? Consider whether `peekResumableSession()` alone is sufficient (checking for the SAME condition the resume-decision effect checks) or whether you need to key off `resumeDecision` itself. Write a real regression test: a matching resumable session exists, assert `introduceCard` is NOT called and no fill happens. Live Deletion Test: revert your fix, confirm the new test fails with the fill running anyway.

**#634 next (severity 6).** The apply-resume effect (separate from the mount-fill effect — a different code path, do this as a distinct fix) has three branches (`accepted && resumedQueue`, `declined`, `null`) but none for `accepted` with a null `resumedQueue` — reachable via a narrow race where the resumable session expires between the 'pending' read and the 'accepted' read. In that gap, `sessionStartedAtRef` stays at its initial 0 and `queue`/`pos`/counters never reset — a silent no-op 'Resume' click. Add a fourth branch (or fold into the existing `declined`-like fallback) that handles this case sensibly — likely: treat it the same as `declined` (start a fresh session from `initialQueue`) since there's nothing left to resume, with a clarifying comment on why. Add a regression test for this exact race.

**#630 next (severity 3).** Now that #629/#634 have landed, extract hooks/useStudySession.ts back under the 400-line services cap. A large share of the excess is unconsolidated, paragraph-by-paragraph inline comments citing ~15 different task numbers, duplicating material that already lives in docs/INTERRUPT_ARCHITECTURE.md section 10 (read-only reference — do not edit it, that's Wave 9's deferred #631). Consider condensing the longest inline comments to a short pointer + one-line summary, and/or extracting a cohesive piece of logic (e.g. the mount-fill effect's fill-mechanics as its own hook, following the `useStudyQueueSetup.ts`/`studyDoneScreenProps.ts` precedent from Wave 6) — use your judgment on which approach gets furthest under cap with the least risk. Verify zero behavior change via full test-suite parity.

**#636 next (severity 3).** Two of the three Task #617 CAP-guard regression tests ('still introduces...below CAP' and part of 'does not apply the CAP guard to non-interrupt sessions') pass under realistic narrower mutations of the guard clause, not just its full deletion. The underlying guard itself is confirmed correct — this is purely about strengthening the tests' own falsifiability. Tighten both so a narrower, realistic mutation (e.g. changing `<` to `<=`, or removing just the `!isInterrupt ||` sub-clause) actually fails them.

**#640 next (severity 2).** The Task #619 comment (near the mount-fill effect's flex loop) states 'up to INTERRUPT_SESSION_MAX_NEW (3) introduceCard calls... plus the 1 normal-cap call below,' implying up to 4 total — but `introducedIds` is shared between the normal-cap call and the flex loop's own limit, so the real max is 3, never 4. Fix the comment's wording.

**#639 last (severity 2, do after #640).** Task #619's async write-ordering risk (accepted debt, unchanged) is documented only in that inline comment with no entry in a durable ledger. Create `.autocode/debt.md` if it doesn't exist yet (check first — per this project's own convention, other accepted-debt items should already reference a debt.md; if none exists, use a simple table: date | area | description | severity | status), and add an entry for Task #619's risk, referencing the corrected comment location from #640.

## Your Tasks (run in this exact order)
1. /task #629  — Fix requirements: The mount-fill effect never checks resumeDecision or calls peekResumableSession() before running its fill logic (introdu
2. /task #634  — Fix edge-case: The apply-resume effect has three branches (accepted&&resumedQueue, declined, null) but no branch for resumeDecision==='
3. /task #630  — Fix code-quality: hooks/useStudySession.ts is 546 lines, well over the 400-line services cap (Rule 1). This file is the center of all 7 re
4. /task #636  — Fix tests: Two of the three Task #617 CAP-guard regression tests - 'still introduces a normal-cap new card into an interrupt sessio
5. /task #640  — Fix code-quality: The Task #619 comment states up to 3 flex plus 1 normal-cap introduceCard calls can happen in one pass, implying up to 4
6. /task #639  — Fix code-quality: Task #619's async write-ordering risk (accepted as debt in round 4, unchanged this round) is documented only in this inl

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W8B
[→] #629 — Fix requirements: The mount-fill effect never checks resumeDecision or calls peekResumableSession() before running its fill logic (introdu   ← starting now
[ ] #634 — Fix edge-case: The apply-resume effect has three branches (accepted&&resumedQueue, declined, null) but no branch for resumeDecision==='
[ ] #630 — Fix code-quality: hooks/useStudySession.ts is 546 lines, well over the 400-line services cap (Rule 1). This file is the center of all 7 re
[ ] #636 — Fix tests: Two of the three Task #617 CAP-guard regression tests - 'still introduces a normal-cap new card into an interrupt sessio
[ ] #640 — Fix code-quality: The Task #619 comment states up to 3 flex plus 1 normal-cap introduceCard calls can happen in one pass, implying up to 4
[ ] #639 — Fix code-quality: Task #619's async write-ordering risk (accepted as debt in round 4, unchanged this round) is documented only in this inl

## Files You Own (edit ONLY these)
hooks/useStudySession.ts
hooks/useStudySession.test.ts
.autocode/debt.md

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel, or read-only reference)
app/study/page.test.tsx
app/study/page.tsx
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
hooks/useInterruptConfig.test.ts
lib/storage.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/dueEstimate.ts
tests/pushDispatch.test.ts
tests/pushDueEstimate.test.ts
tests/storage.test.ts

## Task Definitions

### Task #629

### Task #629: Fix requirements: The mount-fill effect never checks resumeDecision or calls peekResumableSession() before running its fill logic (introdu

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The mount-fill effect never checks resumeDecision or calls peekResumableSession() before running its fill logic (introduceCard calls consuming real daily/flex budget, near-due padding, setQueue). For interrupt sessions, unitId is always the empty string, so any incomplete prior interrupt session's sessionKey matches any subsequent interrupt session - reachable via ordinary app close, navigation away, or the existing snooze flow, none of which call clearActiveSession. When resumeDecision resolves to 'pending', the apply-resume effect later overwrites the fill pass's queue via setQueue(resumedQueue) or setQueue(initialQueue) regardless of the user's accept/decline choice, but the introduceCard() calls the fill pass already made are never undone - silently burning real INTERRUPT_FLEX_DAILY_MAX budget on introductions the user never saw. This can cause a later, real interrupt that same day to be denied a flex fill it should have received, directly undermining BRAND.md's '6-10 interrupts every day, never fewer' commitment. No test sets up a pending resumable session alongside the fill pass. at hooks/useStudySession.ts:mount-fill effect:200.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount-fill effect:200
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F003 — severity 7 — requirements

---

### Task #634

### Task #634: Fix edge-case: The apply-resume effect has three branches (accepted&&resumedQueue, declined, null) but no branch for resumeDecision==='

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The apply-resume effect has three branches (accepted&&resumedQueue, declined, null) but no branch for resumeDecision==='accepted' with a null resumedQueue. Reachable via a narrow race where peekResumableSession() returns a valid session on one read (setting resumeDecision to 'accepted') and null shortly after (the resumable session expires between the pending and accepted reads). In that gap, sessionStartedAtRef stays at its initial value (0, epoch) and queue/pos/counters never reset - the user's 'Resume' click becomes a silent no-op, with session.startedAt: 0 potentially persisted on the next rating. at hooks/useStudySession.ts:apply-resume effect:482.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:apply-resume effect:482
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F008 — severity 6 — edge-case

---

### Task #630

### Task #630: Fix code-quality: hooks/useStudySession.ts is 546 lines, well over the 400-line services cap (Rule 1). This file is the center of all 7 re

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
hooks/useStudySession.ts is 546 lines, well over the 400-line services cap (Rule 1). This file is the center of all 7 remediation waves in this batch, yet unlike its two siblings in the same batch (app/study/page.tsx extracted to 149 lines via Task #612; store/srsStore.ts extracted to 368 lines via Task #613) it was never extracted. A large share of the excess is unconsolidated, paragraph-by-paragraph inline comment accretion citing roughly 15 different task numbers, duplicating material that already has a dedicated home in docs/INTERRUPT_ARCHITECTURE.md section 10. at hooks/useStudySession.ts:module-level (whole file):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:module-level (whole file):1
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F004 — severity 3 — code-quality

---

### Task #636

### Task #636: Fix tests: Two of the three Task #617 CAP-guard regression tests - 'still introduces a normal-cap new card into an interrupt sessio

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Two of the three Task #617 CAP-guard regression tests - 'still introduces a normal-cap new card into an interrupt session below INTERRUPT_SESSION_CAP' and part of 'does not apply the CAP guard to non-interrupt sessions' - pass under realistic, narrower mutations of the guard clause, not just the full guard's deletion. The underlying CAP guard itself was independently manually traced and confirmed correct by four agents, so this is a pure test-quality gap with no live defect behind it. at hooks/useStudySession.test.ts:CAP-guard regression tests:632.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:CAP-guard regression tests:632
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F010 — severity 3 — tests

---

### Task #640

### Task #640: Fix code-quality: The Task #619 comment states up to 3 flex plus 1 normal-cap introduceCard calls can happen in one pass, implying up to 4

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The Task #619 comment states up to 3 flex plus 1 normal-cap introduceCard calls can happen in one pass, implying up to 4 total. In the actual code, introducedIds is shared between the normal-cap call and the flex loop's own MAX_NEW limit, so the real maximum is 3 total, never 4. A minor comment-precision nit, not a functional bug. at hooks/useStudySession.ts:mount-fill effect (Task #619 comment):291.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mount-fill effect (Task #619 comment):291
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F014 — severity 2 — code-quality

---

### Task #639

### Task #639: Fix code-quality: Task #619's async write-ordering risk (accepted as debt in round 4, unchanged this round) is documented only in this inl

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Task #619's async write-ordering risk (accepted as debt in round 4, unchanged this round) is documented only in this inline code comment, with no corresponding entry in .autocode/debt.md. This project's own convention calls for accepted debt to live in a durable ledger, not only in a comment that can be lost if the surrounding code is later refactored. at hooks/useStudySession.ts:mount-fill effect (Task #619 comment):291.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mount-fill effect (Task #619 comment):291
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F013 — severity 2 — code-quality

---

## Verification Gate (run before writing completion.md)
- `npx tsc --noEmit` — zero errors
- `npm test` — all tests pass (other streams are editing other files concurrently; a failure
  in a file you did not touch is not yours to fix, but confirm via `git status` before assuming)
- `npm run lint` — zero errors
- `scripts/deep-audit.sh` does not exist in this repo (confirmed every prior wave) — the real
  Verification Gate above is the actual acceptance criterion for every task.
- For every NEW assertion you add, run the Deletion Test: temporarily revert the production
  fix and confirm your new test fails, then restore it and confirm it passes. State explicitly
  in your completion.md which tasks got a live Deletion Test vs. traced-by-hand verification.

IMPORTANT — do not run `git stash` on your own initiative. If `git status` looks messy or
shows changes you don't recognize, report it in your completion.md rather than resolving it
yourself with a repo-wide command.

This wave includes several tasks that ask for a genuine design decision (not a mechanical
fix). Explain your reasoning clearly in completion.md — do not silently pick an option
without stating why.

## When You Finish
Write your completion summary to .autocode/stream-W8B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W8B | #629 #634 #630 #636 #640 #639
