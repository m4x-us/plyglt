# Charles — Stream W7C — Wave 7 — 2026-08-16

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W7C | #616

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

One task: tests/seam_studyLoop.test.ts's two 'page.tsx wiring' tests (search for 'page.tsx wiring' in the file) fail Rule 18's B7 test — despite their own docstrings claiming to 'reconstruct that exact page-level sequence,' both hand-copy the slice expression (`isInterrupt ? full.slice(0, INTERRUPT_SESSION_CAP) : full`) inline into the test body instead of importing/exercising app/study/page.tsx's real source. Deleting the real page.tsx line would not fail either test today.

Good news: Wave 6's #612 already extracted the relevant logic out of app/study/page.tsx into hooks/useStudyQueueSetup.ts (read-only reference for you — read it in full first) specifically so a test like this could import and exercise the real computation instead of hand-copying it. Rewrite both tests to import and call the real exported function(s) from hooks/useStudyQueueSetup.ts rather than reconstructing the expression inline. Verify with a live Deletion Test: after rewriting, temporarily change the real slice logic in hooks/useStudyQueueSetup.ts (e.g. change INTERRUPT_SESSION_CAP to a different number, or invert the isInterrupt condition) and confirm your rewritten tests now actually fail — then restore it. Note: hooks/useStudyQueueSetup.ts itself is off-limits to you (owned by no one this wave, but not in your file list — treat it as read-only reference; if the Deletion Test genuinely requires a temporary edit there to prove the point, do the edit, run the test, then revert it fully before finishing — do not leave it changed).

## Your Tasks (run in this exact order)
1. /task #616  — Fix tests: tests/seam_studyLoop.test.ts's two page.tsx wiring tests (lines 211, 270) fail Rule 18's B7 test: despite docstrings cla

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W7C
[→] #616 — Fix tests: tests/seam_studyLoop.test.ts's two page.tsx wiring tests (lines 211, 270) fail Rule 18's B7 test: despite docstrings cla   ← starting now

## Files You Own (edit ONLY these)
tests/seam_studyLoop.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel, or read-only reference)
hooks/useStudySession.test.ts
hooks/useStudySession.ts
store/srsStore.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
tests/pushDispatch.test.ts
tests/srsStore.test.ts
hooks/useStudyQueueSetup.ts (read-only reference — revert any temporary edit before finishing)

## Task Definitions

### Task #616

### Task #616: Fix tests: tests/seam_studyLoop.test.ts's two page.tsx wiring tests (lines 211, 270) fail Rule 18's B7 test: despite docstrings cla

**File:** tests/seam_studyLoop.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
tests/seam_studyLoop.test.ts's two page.tsx wiring tests (lines 211, 270) fail Rule 18's B7 test: despite docstrings claiming to 'reconstruct that exact page-level sequence,' both hand-copy the slice expression (isInterrupt ? full.slice(0, INTERRUPT_SESSION_CAP) : full) inline into the test body instead of importing/exercising app/study/page.tsx's real source. Deleting the real page.tsx line does not fail either test. Real coverage for that specific line exists separately in app/study/page.test.tsx's 'caps an oversized interrupt-mode queue' test, but these two specific tests are pseudocode per Rule 18. at tests/seam_studyLoop.test.ts:page.tsx wiring tests:211.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/seam_studyLoop.test.ts:page.tsx wiring tests:211
- [ ] Audit passes: bash scripts/deep-audit.sh tests/seam_studyLoop.test.ts

**Source:** Audit finding F011 — severity 4 — tests

---

## Verification Gate (run before writing completion.md)
- `npx tsc --noEmit` — zero errors
- `npm test` — all tests pass (other streams are editing other files concurrently; a failure
  in a file you did not touch is not yours to fix, but confirm via `git status` before assuming)
- `npm run lint` — zero errors
- `scripts/deep-audit.sh` does not exist in this repo (confirmed every prior wave) — the real
  Verification Gate above is the actual acceptance criterion for every task.
- For every NEW assertion you add, run the Deletion Test: temporarily revert the production fix
  and confirm your new test fails, then restore it and confirm it passes. State explicitly in
  your completion.md which tasks got a live Deletion Test vs. traced-by-hand verification.

IMPORTANT — do not run `git stash` on your own initiative. If `git status` looks messy or shows
changes you don't recognize, report it in your completion.md rather than resolving it yourself
with a repo-wide command.

## When You Finish
Write your completion summary to .autocode/stream-W7C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W7C | #616
