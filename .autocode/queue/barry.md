---
status: done
agent: barry
stream: W2B
wave: 2
---

# Barry — Stream W2B — Wave 2 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W2B | #540

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #540  — Fix code-quality: INTERRUPT_ARCHITECTURE.md not updated for Batch 23's contract change

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W2B
[→] #540 — Fix code-quality: INTERRUPT_ARCHITECTURE.md not updated for Batch 23's contract change   ← starting now

## Files You Own (edit ONLY these)
docs/INTERRUPT_ARCHITECTURE.md

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/study/page.tsx
tests/seam_studyLoop.test.ts
hooks/useInterruptConfig.test.ts
tests/pushDueEstimate.test.ts

## Prior Wave Changes — Read Before Starting
Wave 1 (this same batch) landed the exact contract change this doc needs to describe. Read the
real diffs before writing anything — do not describe the batch from tasks.md's summary alone,
the summary is now stale relative to Wave 1's fixes:

- `lib/queue.ts` — INTERRUPT_SESSION_FLOOR=6, INTERRUPT_SESSION_MAX_NEW=3, INTERRUPT_SESSION_CAP=8,
  and (new in Wave 1) INTERRUPT_FLEX_DAILY_MAX = INTERRUPT_SESSION_MAX_NEW * 3 = 9 (Task #551 — a
  real cross-session daily ceiling on flex-introduced new cards, replacing the old unbounded
  Number.MAX_SAFE_INTEGER).
- `supabase/functions/send-interrupt-notifications/dueEstimate.ts` — buildNotificationPayload now
  clamps to [FLOOR, CAP] (Task #544, was floor-only before), and handles a genuinely zero estimate
  with an honest "Cards ready" (no fabricated number) body instead of always claiming 6 (Task #545).
  Also exports INTERRUPT_SESSION_CAP=8 now (previously only FLOOR existed there).
- `supabase/functions/send-interrupt-notifications/types.ts` — DispatchSummary gained
  `sentWithZeroEstimate: number` (Task #550), restoring the observability the removed
  `skippedNoCards` field used to provide — describe what field REPLACED skippedNoCards, not just
  that it was removed.
- `hooks/useStudySession.ts` — the Task #533 never-empty backstop is now gated on the same
  stranded-pause check as the rest of the fill loop (Task #538) — a stranded pause + empty
  near-due pool can now leave a session genuinely empty, a deliberate product decision (BRAND.md's
  pause invariant takes priority). Document this explicitly — it's a real behavior change from
  what the batch originally shipped.
- `hooks/useInterruptConfig.ts` — computeDue's flex-fallback is now gated the same way (Task #539).

Read `git log --oneline -5` and `git show <wave-1-commit-sha> --stat` to see the exact commit if
useful — Wave 1 committed as "/advance wave 1: close 24 tasks, 3 streams (Batch 23)".

## Task Definitions

### Task #540: Fix code-quality: INTERRUPT_ARCHITECTURE.md not updated for Batch 23's contract change

**File:** docs/INTERRUPT_ARCHITECTURE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing (was semantically blocked on Task #550, COMPLETE as of Wave 1)
**Priority:** P3
**Status:** OPEN

**What:**
docs/INTERRUPT_ARCHITECTURE.md was not updated to describe the new 6-card floor, 3-new-card cap,
8-card ceiling, or the removed skippedNoCards field, despite this batch materially changing the
interrupt content-delivery contract the doc exists to describe.

Add a section (or extend the existing one covering the interrupt content-supply floor) describing,
accurately, the CURRENT state after both Wave 1 and the original Batch 23 shipment (see "Prior Wave
Changes" above for what actually changed — describe reality, not the original ratified spec text
verbatim, since two things changed since that spec was written): the client-side floor/cap/daily-cap
system in lib/queue.ts and hooks/useStudySession.ts, the server-side clamp+honest-zero-case in
dueEstimate.ts, and the sentWithZeroEstimate observability field in types.ts/dispatch.ts. Keep it
consistent in tone with the rest of the document (this repo already has real architecture docs for
comparison — read the existing file's own style before writing).

**Acceptance Criteria:**
- [ ] Fix code-quality issue at docs/INTERRUPT_ARCHITECTURE.md:n/a:0
- [ ] Audit passes: bash scripts/deep-audit.sh docs/INTERRUPT_ARCHITECTURE.md (this script does not
      exist in this repo — substitute the real Verification Gate: `npx tsc --noEmit`, `npm test`, `npm run lint`)

**Source:** Audit finding F007 — severity 2 — code-quality

---

## When You Finish
Write your completion summary to .autocode/stream-W2B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If closed: `NOT_CLOSED: none`. If not: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W2B | #540
