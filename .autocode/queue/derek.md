---
status: done
stream: W8D
wave: 8
---

# Derek — Stream W8D — Wave 8 — 2026-08-16

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W8D | #638 #642

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

Two small, independent, low-severity fixes in the Deno edge-function directory.

**#638 first (severity 2).** `buildNotificationPayload` (dueEstimate.ts) logs a negative `estimate.cardCount` via `console.error` but still clamps and announces '6 cards ready' — the code's own comment says this path isn't reachable by any caller today. Decide whether a small correctness improvement is worth it (e.g. throwing, or returning a distinct error-shaped payload the caller can detect) given it's genuinely unreachable, or whether strengthening the existing defensive comment to be more precise about why is the proportionate fix for a severity-2 item — use your judgment, document the reasoning either way.

**#642 next (severity 3).** In dispatch.ts, if `recordGateFired` fails after a zero-estimate send, the widened 24h gate is never actually written, but the send is still counted as successful — the next dispatch cycle can re-select the same user sooner than the documented 'at most once per day' guarantee. This mirrors an existing, already-accepted pattern in the same function for the non-zero-estimate case (`recordGateFired` failure there is already logged as a distinct concern, not folded into `failed`) — read that existing handling first. Decide whether the same accepted-tradeoff framing applies here too (document it explicitly, matching the existing pattern) or whether this specific case deserves a real retry/summary-field addition given it undermines a user-facing guarantee (the daily notification-fatigue fix) rather than just cross-device visibility. Use your judgment; whichever you choose, make sure the reasoning is as explicit as this file's existing comments.

## Your Tasks (run in this exact order)
1. /task #638  — Fix requirements: A negative estimate.cardCount is logged via console.error but still clamped to INTERRUPT_SESSION_FLOOR and announced as
2. /task #642  — Fix async: If recordGateFired fails after a zero-estimate send, the widened 24h ZERO_ESTIMATE_GATE_MINUTES gate is never actually w

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W8D
[→] #638 — Fix requirements: A negative estimate.cardCount is logged via console.error but still clamped to INTERRUPT_SESSION_FLOOR and announced as   ← starting now
[ ] #642 — Fix async: If recordGateFired fails after a zero-estimate send, the widened 24h ZERO_ESTIMATE_GATE_MINUTES gate is never actually w

## Files You Own (edit ONLY these)
supabase/functions/send-interrupt-notifications/dueEstimate.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
tests/pushDueEstimate.test.ts
tests/pushDispatch.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel, or read-only reference)
.autocode/debt.md
app/study/page.test.tsx
app/study/page.tsx
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
hooks/useInterruptConfig.test.ts
hooks/useStudySession.test.ts
hooks/useStudySession.ts
lib/storage.ts
tests/storage.test.ts

## Task Definitions

### Task #638

### Task #638: Fix requirements: A negative estimate.cardCount is logged via console.error but still clamped to INTERRUPT_SESSION_FLOOR and announced as

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
A negative estimate.cardCount is logged via console.error but still clamped to INTERRUPT_SESSION_FLOOR and announced as '6 cards ready' rather than surfaced as an error state. The code's own comment documents this path as not reachable by any caller today. at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:166.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:166
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F012 — severity 2 — requirements

---

### Task #642

### Task #642: Fix async: If recordGateFired fails after a zero-estimate send, the widened 24h ZERO_ESTIMATE_GATE_MINUTES gate is never actually w

**File:** supabase/functions/send-interrupt-notifications/dispatch.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
If recordGateFired fails after a zero-estimate send, the widened 24h ZERO_ESTIMATE_GATE_MINUTES gate is never actually written, but the send is still counted as successful. The very next dispatch cycle can then re-select the same user sooner than the documented 'at most once per day on a zero estimate' guarantee. at supabase/functions/send-interrupt-notifications/dispatch.ts:dispatch send handler:101.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at supabase/functions/send-interrupt-notifications/dispatch.ts:dispatch send handler:101
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dispatch.ts

**Source:** Audit finding F016 — severity 3 — async

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
Write your completion summary to .autocode/stream-W8D/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W8D | #638 #642
