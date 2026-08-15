---
status: done
agent: adam
stream: W1A
wave: 1
---

# Adam — Stream W1A — Wave 1 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W1A | #544 #545 #546 #548 #549 #550

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #544  — Fix requirements: server push floor has no matching ceiling — overstates card count on backlog days
2. /task #545  — Fix requirements: server push overstates card count on a brand-new user's first interrupt
3. /task #546  — Fix code-quality: doc comment overclaims the client's floor as an unconditional guarantee
4. /task #548  — Fix code-quality: doc comment hedges the exhaustion case but not the overflow case
5. /task #549  — Fix code-quality: dispatch.ts header comment not revisited despite increased send volume
6. /task #550  — Fix code-quality: removed skippedNoCards field loses observability into fabricated-floor sends

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W1A
[✓] #544 — Fix requirements: server push floor has no matching ceiling   ← done
[→] #545 — Fix requirements: server push overstates card count on a brand-new user's first interrupt   ← starting now
[ ] #546 — Fix code-quality: doc comment overclaims the client's floor as an unconditional guarantee
[ ] #548 — Fix code-quality: doc comment hedges the exhaustion case but not the overflow case
[ ] #549 — Fix code-quality: dispatch.ts header comment not revisited despite increased send volume
[ ] #550 — Fix code-quality: removed skippedNoCards field loses observability into fabricated-floor sends

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
supabase/functions/send-interrupt-notifications/dueEstimate.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/types.ts
tests/pushDueEstimate.test.ts
tests/pushDispatch.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
hooks/useStudySession.ts
hooks/useStudySession.test.ts
hooks/useInterruptConfig.ts
hooks/useSync.ts
lib/queue.ts
app/study/page.tsx
app/study/page.test.tsx

## Task Definitions

### Task #544: Fix requirements: server push floor has no matching ceiling — overstates card count on backlog days

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
buildNotificationPayload floors the announced count at INTERRUPT_SESSION_FLOOR(6) via Math.max but applies no ceiling; on any backlog day where cardCount exceeds INTERRUPT_SESSION_CAP(8), the push announces more cards than the client session (capped at 8 in app/study/page.tsx) can ever deliver. Empirically demonstrated by the shipped test tests/pushDueEstimate.test.ts:107-112 (cardCount:9 producing body "9 cards ready"), reachable by any real user with a backlog above 8, including the vacation-return scenario BRAND.md explicitly names.

Fix by clamping `announced` between INTERRUPT_SESSION_FLOOR and INTERRUPT_SESSION_CAP (both currently `6` in this file and `8` in `lib/queue.ts` — `lib/queue.ts` cannot be imported into this Deno function, so re-declare the ceiling as a local constant the same way INTERRUPT_SESSION_FLOOR is already re-declared here, with a comment pointing at `lib/queue.ts`'s `INTERRUPT_SESSION_CAP` as the source of truth to keep in sync — see Task #545/#546/#548 which touch the same doc comments; do them together in this stream, in order, since #545/#546/#548 all sit in the same paragraph you'll be editing for #544).

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:89
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F011 — severity 7 — requirements

---

### Task #545: Fix requirements: server push overstates card count on a brand-new user's first interrupt

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
For a genuinely zero-history new Pro signup (near-due pool empty by definition, no FSRS reviews yet), buildNotificationPayload still announces "6 cards ready" unconditionally, but the real session (useStudySession.ts mount effect, owned by Barry's stream — do not edit it, this is client-side and out of your file ownership) delivers at most INTERRUPT_SESSION_MAX_NEW(3) cards via flex-introduction, or 0 in a fully-exhausted edge case — reachable on 100% of new Pro users' first interrupt, the exact opposite-direction divergence from Task #544.

This is the hardest task in your stream: the server has no visibility into the client's real fill-source availability (near-due pool size, catalog exhaustion) since none of that syncs server-side (see the module's own doc comment on `computeDueEstimate`). Do not try to make the server omniscient. The honest fix is almost certainly a wording change: soften the announced-count claim for the true-zero-estimate case (e.g. only floor to 6 when `estimate.cardCount > 0`, and use a different, honestly-worded body for the literal-zero case — a session with truly zero synced history is exactly the case BRAND.md's own accepted-tradeoff language already covers: "the client fills the session"; the notification body should not claim a specific number it cannot back). Coordinate this decision with Task #546/#548's doc-comment fixes — write the corrected paragraph once and reference it from all three.

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:89
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F012 — severity 7 — requirements

---

### Task #546: Fix code-quality: doc comment overclaims the client's floor as an unconditional guarantee

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Doc comment states as settled fact "the client guarantees every interrupt session holds at least INTERRUPT_SESSION_FLOOR cards", contradicted by the client's own test (hooks/useStudySession.test.ts, "stops at the catalog's edge without padding duplicates when supply runs out below the floor") which proves the client itself accepts sub-floor sessions as correct. Doc-comment overclaim, root cause distinct from the functional defects in F011/F012 (Tasks #544/#545) — fix the wording (e.g. "targets at least... catalog and daily-cap permitting" instead of "guarantees"), not the code, unless #544/#545's fixes change what's actually true.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:module doc comment:71
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F013 — severity 3 — code-quality

---

### Task #548: Fix code-quality: doc comment hedges the exhaustion case but not the overflow case

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The doc comment's "the session the tap opens genuinely holds at least that many cards (catalog permitting)" hedges only the too-few (exhaustion) case; it never acknowledges the too-many (overflow) case documented in Task #544, a second distinct doc-accuracy gap in the same paragraph. Fix in the same editing pass as #546 — you'll likely rewrite this whole comment block once, covering both directions honestly, rather than patching it twice.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:module doc comment:79
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F015 — severity 3 — code-quality

---

### Task #549: Fix code-quality: dispatch.ts header comment not revisited despite increased send volume

**File:** supabase/functions/send-interrupt-notifications/dispatch.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
dispatch.ts's sequential-processing header comment was not revisited despite this diff structurally increasing dispatch volume by removing the zero-estimate skip. Update the header comment (top of the file, describing why processing is sequential not Promise.all) to acknowledge that every gated-eligible token now proceeds through claimToken/send (no zero-estimate short-circuit anymore) — the design rationale still holds, but the comment currently reads as if written before that changed.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dispatch.ts:module header comment:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dispatch.ts

**Source:** Audit finding F016 — severity 2 — code-quality

---

### Task #550: Fix code-quality: removed skippedNoCards field loses observability into fabricated-floor sends

**File:** supabase/functions/send-interrupt-notifications/types.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Removing the zero-estimate skip (and the skippedNoCards field) removes the only signal distinguishing "sent because of real content" from "sent because the floor fabricated a number"; the two materially different `sent` outcomes can no longer be distinguished in any future dispatch summary or observability dashboard, and the only kill switch (PUSH_DISPATCH_ENABLED) is all-or-nothing.

Add a new counter field to `DispatchSummary` (in this file) that distinguishes a real-content send from a floored/fabricated-count send — e.g. `sentWithZeroEstimate: number` — incremented in `dispatch.ts`'s `sendAndRecord` (do NOT edit dispatch.ts yourself if you can avoid it — you own dispatch.ts too in this stream, so this is fine, just keep it to a one-line increment) when `estimate.cardCount === 0` at send time. Update `tests/pushDispatch.test.ts` accordingly. This directly informs how you should scope docs/INTERRUPT_ARCHITECTURE.md's description in Task #540 later (Barry's/Charles's streams don't own that doc — it's deferred to Wave 2 once your #550 lands, since #550 → #540 is a real dependency).

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/types.ts:skippedNoCards field removal:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/types.ts

**Source:** Audit finding F017 — severity 3 — code-quality

---

## Agent Memories

## Architect Agent Memory (first 150 lines)
# Architecture Agent Memory — plyglt

## Stack
Next.js 16.2.9, React 19, Zustand 5, Tauri 2 (desktop + web). TypeScript throughout.

## Layer Structure (dependencies flow strictly down)
- `app/` — Next.js routes. LIMIT: ≤150 lines.
- `components/` — React UI components.
- `hooks/` — Custom React hooks.
- `store/` — Zustand stores.
- `lib/` — Pure utilities. No React, no Zustand imports. Must NEVER import from store/, hooks/, components/, app/.

## Relevant standing rule for this stream
Rule 22 (Whole-Operation Consistency): a flag/guard/floor/ceiling change must hold across every sibling surface that reports the same fact — you are fixing exactly this class of gap (the server push's floor has no ceiling, and its doc comments overclaim). When you fix the ceiling in #544, re-check #546/#548's comment text against what the code ACTUALLY does after your fix, not what it did before — do not let the comment overclaim in a new way (Rule 23: a fix must not recreate its own defect class).

Full architect.md is at .autocode/agents/architect.md if you need more context — this file's history includes prior "doc comment drifted from code" incidents (see "STALE CLAUDE.md" entries) that follow the identical pattern you're fixing now.

## When You Finish
Write your completion summary to .autocode/stream-W1A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content —
the orchestrator's consolidation step and its reconciliation check both parse these two
lines mechanically, not the prose below them:

CLOSED: #[NUM] #[NUM] #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason] | #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`. Every
task number assigned to this stream must appear in exactly one of the two lines — never
omit a task number from both.)

After those two lines, write whatever prose detail is useful — this part is free-form and
is not mechanically parsed, so include as much as helps the next wave or Max's review:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]
  [architecture decisions, root causes, anything the next stream touching these files needs]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W1A | #544 #545 #546 #548 #549 #550
