# Charles — Stream W6C — Wave 6 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W6C | #623 #624

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

Both your tasks are in the Deno edge-function directory supabase/functions/send-interrupt-notifications/. Read dispatch.ts and dueEstimate.ts in full, plus their existing tests, before starting.

**#623 first** (severity 5, product-shape decision): Batch 23 removed the server's zero-card skip (`skippedNoCards`), so a genuinely fully-caught-up Pro user — 0 due, 0 near-due, 0 new content anywhere, an expected steady-state outcome of the product working correctly — now receives a recurring, contentless 'Cards ready' push every interval indefinitely. This contradicts BRAND.md's stress-free/no-pressure principle (the interrupt engine should never feel like a burden) and creates real notification-fatigue/uninstall risk. This needs a genuine product decision, not just a mechanical fix — reasonable options: (a) reintroduce a zero-estimate skip, but smarter than the original (the original was removed because the server's estimate is a documented LOWER BOUND that can't see client-only introduction-cadence content, so a naive zero-skip caused real interrupts to be silently dropped for the exact 'flex will fill this' scenario Batch 23 exists to serve); (b) keep sending, but throttle the FREQUENCY of contentless notifications specifically (e.g. only the first N in a row, or one per day, distinct from the normal interval); (c) something else you judge better after reading dispatch.ts's own comment explaining why the skip was removed in the first place (search for 'skippedNoCards' and the surrounding reasoning). Whatever you choose, document the reasoning as clearly as the existing comments in this file do, and make sure your fix doesn't reintroduce the original bug (silently dropping interrupts the client-side flex mechanism could actually serve).

**#624 next** (severity 4): the FLOOR/CAP constants (INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP) are duplicated between the Node client (lib/queue.ts, read-only reference — do not edit) and this Deno edge function (dueEstimate.ts), guarded against drift only by tests/interruptFloorSync.test.ts's test-suite assertion — not a deploy-time guard. If the edge function is ever deployed independently of a full `npm test` run, the two copies could silently diverge with no build-time signal. Investigate whether this project has any deploy script or CI step for Supabase Edge Functions (check package.json scripts, .github/workflows/, and any supabase/ config for a deploy command) that could be made to depend on this test passing first. If a real deploy-time guard is feasible within your scope, add it. If it genuinely isn't (e.g. deploys happen via the Supabase CLI/dashboard outside this repo's CI entirely), document that limitation clearly in a comment on the constants themselves rather than leaving the gap silently unacknowledged — this is a legitimate case where the honest answer may be 'accepted risk, here's why,' not a code change.

## Your Tasks (run in this exact order)
1. /task #623  — Fix requirements: supabase/functions/send-interrupt-notifications - removing the server's zero-card skip (Batch 23 removed skippedNoCards
2. /task #624  — Fix code-quality: FLOOR/CAP constants (INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP equivalents) are duplicated between the Node client c

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W6C
[→] #623 — Fix requirements: supabase/functions/send-interrupt-notifications - removing the server's zero-card skip (Batch 23 removed skippedNoCards   ← starting now
[ ] #624 — Fix code-quality: FLOOR/CAP constants (INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP equivalents) are duplicated between the Node client c

## Files You Own (edit ONLY these)
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/dueEstimate.ts
tests/pushDispatch.test.ts
tests/pushDueEstimate.test.ts
tests/interruptFloorSync.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel, or read-only reference)
app/study/page.test.tsx
app/study/page.tsx  (read-only reference — Adam's stream owns this)
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
hooks/useInterruptConfig.test.ts
hooks/useInterruptConfig.ts  (read-only reference — Adam's stream owns this)
hooks/useStudySession.test.ts
hooks/useStudySession.ts  (read-only reference — Adam's stream owns this)
lib/interruptGate.test.ts
lib/storage.ts  (read-only reference — Barry's stream is redesigning this)
tests/storage.test.ts

## Task Definitions

### Task #623

### Task #623: Fix requirements: supabase/functions/send-interrupt-notifications - removing the server's zero-card skip (Batch 23 removed skippedNoCards

**File:** supabase/functions/send-interrupt-notifications
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
supabase/functions/send-interrupt-notifications - removing the server's zero-card skip (Batch 23 removed skippedNoCards per this session's own documentation) means a genuinely fully-caught-up Pro user now receives a recurring, contentless 'Cards ready' push every interval indefinitely. This directly contradicts BRAND.md's stress-free/no-pressure principle and creates real notification-fatigue and uninstall risk for real users who have nothing to review - reachable today for any Pro user who reaches zero due content, an expected steady-state outcome of the product working correctly. at supabase/functions/send-interrupt-notifications:dispatch (zero-card skip removed, server side):1.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications:dispatch (zero-card skip removed, server side):1
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications

**Source:** Audit finding F018 — severity 5 — requirements

---

### Task #624

### Task #624: Fix code-quality: FLOOR/CAP constants (INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP equivalents) are duplicated between the Node client c

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
FLOOR/CAP constants (INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP equivalents) are duplicated between the Node client codebase and the Deno edge function, guarded against drift only by a test-suite assertion, not a deploy-time guard. If the edge function is ever deployed independently of a full test-suite run, the two copies can silently diverge with no build-time signal. at supabase/functions/send-interrupt-notifications/dueEstimate.ts:FLOOR/CAP constants (Node/Deno duplication):120.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:FLOOR/CAP constants (Node/Deno duplication):120
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F019 — severity 4 — code-quality

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
with a repo-wide command — a prior wave (B2 audit round 1) lost 8 units of another agent's
uncommitted work this exact way.

If your task requires a design decision the brief flags as "your judgment" or notes as a
possible carry-forward/coordination item (because the real fix would require editing an
off-limits file owned by another stream this wave), explain your reasoning and decision clearly
in completion.md — do not silently pick an option without stating why, and do not edit an
off-limits file to "just finish it."

## When You Finish
Write your completion summary to .autocode/stream-W6C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W6C | #623 #624
