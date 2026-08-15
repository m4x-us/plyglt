# Derek — Stream W2D — Wave 2 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W2D | #560

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #560  — Fix tests: "keeps an estimate above the floor exact" test doesn't prove the floor exists

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W2D
[→] #560 — Fix tests: "keeps an estimate above the floor exact" test doesn't prove the floor exists   ← starting now

## Files You Own (edit ONLY these)
tests/pushDueEstimate.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/study/page.tsx
tests/seam_studyLoop.test.ts
docs/INTERRUPT_ARCHITECTURE.md
hooks/useInterruptConfig.test.ts

## Prior Wave Changes — Read Before Starting
Wave 1 (Tasks #544/#545, Adam's stream) already fixed the underlying bug this test was supposed to
catch. `buildNotificationPayload` in `supabase/functions/send-interrupt-notifications/dueEstimate.ts`
now clamps `announced` to `Math.min(Math.max(estimate.cardCount, INTERRUPT_SESSION_FLOOR), INTERRUPT_SESSION_CAP)`
— so a `cardCount:9` input is now clamped DOWN to 8 (INTERRUPT_SESSION_CAP), not passed through
unchanged as "9 cards ready" like before. This means the specific input value the existing test
uses (9) NO LONGER demonstrates "value above the floor stays exact" — 9 is now itself clamped.
Also: `buildNotificationPayload` special-cases `cardCount === 0` entirely now (returns `"Cards ready"`
with no number, not a floored "6 cards ready") — read Adam's completion.md
(`.autocode/stream-W1A/completion.md`) for the full before/after. Both of these mean your task's
originally-described fix ("cardCount:9 passes identically whether the floor exists or not") is
now testing against CODE THAT HAS CHANGED — re-verify the actual current behavior before writing
your fix, don't assume the task description's code snippets are still accurate.

## Task Definitions

### Task #560: Fix tests: "keeps an estimate above the floor exact" test doesn't prove the floor exists

**File:** tests/pushDueEstimate.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing (was semantically blocked on Tasks #544/#545, both COMPLETE as of Wave 1)
**Priority:** P3
**Status:** OPEN

**What:**
This test (cardCount:9) passes identically whether the Math.max floor logic exists or is deleted,
since 9 is greater than 6 either way; it does not prove the floor exists, only re-exercises
pre-existing plural-formatting coverage.

Given Wave 1's fix (see "Prior Wave Changes" above), first re-run the existing test suite
(`npm test -- pushDueEstimate`) and read the CURRENT test file to see what Adam's stream already
changed here — his completion.md says he "updated/added tests for the clamp + zero-case wording,"
so some of this task's original gap may already be partially closed. Your job: verify with a fresh
Deletion Test (temporarily comment out the `Math.min(...)` clamp, rerun the suite, confirm which
specific test(s) fail) whether a test now genuinely proves BOTH the floor (low values get raised to
6) AND the ceiling (high values get capped to 8) as exact, provable assertions — not just that SOME
test exists near this behavior. If a gap remains (e.g. no test proves an in-range value like 7
passes through completely unchanged, which is the actual "does the floor/ceiling leave the middle
alone" proof this task's title implies), add it. If Wave 1 already fully covers this with genuinely
falsifiable tests, say so explicitly in your completion.md with the specific test names and why
each passes the Deletion Test, rather than adding a redundant one.

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/pushDueEstimate.test.ts:"keeps an estimate above the floor exact":107
- [ ] Audit passes: bash scripts/deep-audit.sh tests/pushDueEstimate.test.ts (this script does not
      exist in this repo — substitute the real Verification Gate: `npx tsc --noEmit`, `npm test`, `npm run lint`)

**Source:** Audit finding F027 — severity 3 — tests

---

## Agent Memories

## QA Agent Memory (relevant excerpt)
Rule 18 (Test Falsifiability): every test must name the specific wrong implementation it catches.
A test whose input value is unaffected by the logic under test proves nothing about that logic.

## When You Finish
Write your completion summary to .autocode/stream-W2D/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If closed: `NOT_CLOSED: none`. If not: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W2D | #560
