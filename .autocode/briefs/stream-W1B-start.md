# Barry — Stream W1B — Wave 1 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W1B | #535 #538 #539 #541 #547 #551 #554 #561

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #535  — Fix code-quality: two independent INTERRUPT_SESSION_FLOOR=6 literals have no mechanical sync guard
2. /task #547  — Fix code-quality: 8-card ceiling comment's arithmetic is wrong
3. /task #538  — Fix requirements: #533 never-empty backstop bypasses the stranded-pause invariant
4. /task #551  — Fix requirements: no daily ceiling on flex-introduced new cards across multiple same-day interrupts
5. /task #561  — Fix code-quality: 6-card floor is not an unconditional guarantee when the near-due pool is empty
6. /task #541  — Fix edge-case: near-due over-fetch heuristic is not a mathematically proven bound
7. /task #539  — Fix requirements: computeDue's flex-fallback can promise a stranded-blocked new card
8. /task #554  — Fix edge-case: sync cards merge can silently overwrite a just-recorded local review

Note the order above groups #535/#547 (lib/queue.ts constants/comments) first since #551 and #561
both reference the same file's constants, then #538/#551/#561/#541 (all hooks/useStudySession.ts,
same mount effect — do them together, in this order, since #538 and #551 touch overlapping logic
in the fill loop and #561 is a documentation-only note about the same loop you'll already be
looking at), then #539 (hooks/useInterruptConfig.ts — the identical stranded-pause bug as #538,
just in the sibling fire-gate function, fix it the same way), then #554 (hooks/useSync.ts, fully
unrelated pre-existing issue, do it last).

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W1B
[✓] #535 — Fix code-quality: two independent INTERRUPT_SESSION_FLOOR=6 literals   ← done
[→] #547 — Fix code-quality: 8-card ceiling comment's arithmetic is wrong   ← starting now
[ ] #538 — Fix requirements: #533 never-empty backstop bypasses the stranded-pause invariant
[ ] #551 — Fix requirements: no daily ceiling on flex-introduced new cards
[ ] #561 — Fix code-quality: 6-card floor is not an unconditional guarantee
[ ] #541 — Fix edge-case: near-due over-fetch heuristic is not a mathematically proven bound
[ ] #539 — Fix requirements: computeDue's flex-fallback can promise a stranded-blocked new card
[ ] #554 — Fix edge-case: sync cards merge can silently overwrite a just-recorded local review

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
hooks/useStudySession.ts
hooks/useInterruptConfig.ts
hooks/useInterruptConfig.test.ts
lib/queue.ts
hooks/useSync.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
supabase/functions/send-interrupt-notifications/dueEstimate.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/types.ts
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
hooks/useStudySession.test.ts
app/study/page.tsx
app/study/page.test.tsx

Note on hooks/useStudySession.test.ts: it is owned by Charles's stream this wave (bundled there to
avoid a separate file conflict), NOT yours. #538/#541/#551/#561 are all production-code fixes in
hooks/useStudySession.ts that will very likely need new/updated tests in hooks/useStudySession.test.ts
to prove the fix (e.g. #538's stranded-pause fix needs a test proving the backstop now respects the
pause; #551's daily-cap fix needs a test asserting the cap holds across multiple sessions). Do NOT
edit hooks/useStudySession.test.ts yourself. Instead, in your completion.md, write exactly what test
case each of #538/#541/#551 needs (test name, setup, exact expected assertion) so the next wave can
add it. hooks/useInterruptConfig.test.ts, by contrast, is yours — edit it freely for #539.

## Task Definitions

### Task #535: Fix code-quality: two independent INTERRUPT_SESSION_FLOOR=6 literals have no mechanical sync guard

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Two independent `INTERRUPT_SESSION_FLOOR=6` literals exist (`lib/queue.ts:21` and `supabase/functions/send-interrupt-notifications/dueEstimate.ts:87`), synced only by a comment instruction, with no test asserting equality between them. AGENTS.md names a hardcoded value that should be derived from a single source of truth as a stop-the-line pattern.

Since the Deno server function cannot import from `lib/`, a shared constant is not possible. Instead add a mechanical sync guard: a Vitest test (in `tests/` — pick a location that already imports both, e.g. alongside `tests/pushDueEstimate.test.ts`, or a new small `tests/interruptFloorSync.test.ts`) that imports `INTERRUPT_SESSION_FLOOR` from `lib/queue.ts` and from `supabase/functions/send-interrupt-notifications/dueEstimate.ts` (this repo already imports Deno-only files directly into Vitest — see `tests/pushDueEstimate.test.ts:1-7` for the exact import pattern) and asserts they are equal. Do the same for `INTERRUPT_SESSION_CAP` once Adam's stream (Task #544, running in parallel) adds a ceiling constant to `dueEstimate.ts` — if that constant does not exist yet when you reach this task, note it in your completion.md as a follow-up rather than blocking on it.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_SESSION_FLOOR const:21
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F002 — severity 4 — code-quality

---

### Task #547: Fix code-quality: 8-card ceiling comment's arithmetic is wrong

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Comment claims the 8-card ceiling is "approximately the top of the 45-90s window at 8-15s/card", which is arithmetically false by the file's own numbers: 8 cards times 15s/card equals 120 seconds, 33% beyond the stated 90-second ceiling; only true at roughly 11.25s/card, a figure never stated. Fix the comment to state the real math honestly (e.g. "8 cards at 8-15s/card is 64-120s — the ceiling trades a slightly longer worst-case session for never truncating a backlog day's content mid-session" or whatever the real justification is — do not just narrow the range to make the arithmetic trivially true if that's not actually why 8 was chosen; check `.autocode/tasks.md`'s Batch 23 entry for the real owner-ratified reasoning behind the 8-card ceiling before rewriting).

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_SESSION_CAP comment:23
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F014 — severity 2 — code-quality

---

### Task #538: Fix requirements: #533 never-empty backstop bypasses the stranded-pause invariant

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The final never-completely-empty backstop (`if (sessionIds.size === 0) introduceNext();`) calls `introduceNext()` with no `canIntroduceNewCard` check of any kind, bypassing `strandedAcrossDays` entirely; contradicts BRAND.md's wrong-answer-rules table (new-card introductions pause until the stranded card stabilizes). Confirmed pre-existing from Task #533, not newly introduced by Batch 23, but Batch 23's wider interrupt fill surface makes this path newly more reachable in production, and no test covers the stranded+empty-near-due combination.

Fix: gate the backstop's `introduceNext()` call the same way the flex while-loop above it is gated — check `strandedPauseClear` (or equivalent) before calling it. If the pause blocks it AND `sessionIds.size === 0`, the session genuinely has nothing to show — decide with Max (or note the tradeoff explicitly in your completion.md) whether that's acceptable (matches BRAND.md's pause rule taking priority) or whether a different, non-new-card fallback is needed. Do not silently keep the current bypass.

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount effect Task #533 backstop:159
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F005 — severity 6 — requirements

---

### Task #551: Fix requirements: no daily ceiling on flex-introduced new cards across multiple same-day interrupts

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
`canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER)` disables the daily aggregate new-card cap for the rest of the day (`store/srsStore.ts:312-319`'s `introducedTodayCount>=maxPerDay` check effectively never trips), not just for the current session; across multiple interrupt sessions in one day with a persistently empty near-due pool (the default state for any new user with zero FSRS reviews), up to INTERRUPT_SESSION_MAX_NEW(3) new cards can be flex-introduced in EVERY session that day with no cross-session ceiling, directly contradicting BRAND.md's "one new card introduced per day at steady state" framing for the exact new-user population this feature targets first.

Fix by replacing `Number.MAX_SAFE_INTEGER` with a real, reasoned daily ceiling (e.g. a new constant like `INTERRUPT_FLEX_DAILY_MAX` in `lib/queue.ts` — you also own that file this stream) — decide a sensible value with the BRAND.md science already in the file's comments (Cowan ~4 chunks is a PER-SESSION limit; a reasonable per-DAY ceiling needs its own justification, e.g. 2x or 3x the per-session cap, or a fixed number like 6-9/day). Do not just pick an arbitrary number — write the reasoning in the code comment the way `lib/queue.ts`'s existing constants do. `store/srsStore.ts`'s `canIntroduceNewCard` is NOT in your file list (Rule 3 layer boundary — store/ is a peer, not owned by this stream); if you need it changed, note the exact change needed in your completion.md instead of editing it directly, since another stream/wave may need to coordinate that store-layer change with its own callers.

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount effect isInterrupt fill loop:135
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F018 — severity 6 — requirements

---

### Task #561: Fix code-quality: 6-card floor is not an unconditional guarantee when the near-due pool is empty (expectation-alignment note, matches ratified spec)

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The 6-card floor is not an unconditional guarantee: when the near-due pool is empty and INTERRUPT_SESSION_MAX_NEW(3) is hit, a session ships with exactly 3 cards, not 6. This was confirmed during audit to match BRAND.md's own ratified hedge ("never more than 3 per session... until the pipeline refills") — NOT a functional defect. This task is a documentation-only fix: add a one-line code comment directly above the fill loop clarifying that the floor is a target, not an unconditional guarantee, so a future reader doesn't mistake it for a bug (as several audit agents initially did). Do not change any logic for this task.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mount effect isInterrupt fill loop:136
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F028 — severity 2 — code-quality

---

### Task #541: Fix edge-case: near-due over-fetch heuristic is not a mathematically proven bound

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The near-due over-fetch heuristic (`INTERRUPT_SESSION_FLOOR + sessionIds.size`) is not a mathematically proven bound if already-included cards are interleaved rather than clustered at the front of `getNearDueCards`' sorted pool; untested edge case, low real-world likelihood. Fix by over-fetching a provably-sufficient amount instead: request the full remaining catalog size (or a generous fixed multiple, e.g. `2 * (INTERRUPT_SESSION_FLOOR - sessionIds.size) + sessionIds.size`) rather than a heuristic that assumes overlaps cluster at the front, OR add a `while` loop that keeps fetching in batches until the floor is reached or the pool is exhausted (mirroring the pattern the new-card `while` loop above it already uses). Prefer the simplest correct fix.

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mount effect near-due fill:147
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F008 — severity 3 — edge-case

---

### Task #539: Fix requirements: computeDue's flex-fallback can promise a stranded-blocked new card

**File:** hooks/useInterruptConfig.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
computeDue's zero-supply flex-fallback (lines 60-73) sets `newCardDue=1` via a raw `getNewCards()` check with no `canIntroduceNewCard`/`strandedAcrossDays` check at all; `getNewCards` (store/srsStore.ts:180-187) only filters on FSRS progress and prerequisites, never on introduction-pause state. This lets computeDue fire an interrupt promising new-card content during a stranded pause that useStudySession's own normal-cap path (line 129, `canIntroduceNewCard(today)`) would refuse to honor. CLAUDE.md's own documentation ("gated on the stranded-pause check") is accurate only for the useStudySession while-loop, not this caller.

Fix: import `useSRSStore` state's `canIntroduceNewCard` (already available via `state` in this function — see how `state.canIntroduceNewCard(today)` is already called a few lines above) and check it (with an appropriately large `maxPerDay`, mirroring `hooks/useStudySession.ts`'s `strandedPauseClear` pattern from Task #538 — read that fix once Adam/you land it, for consistency) before setting `newCardDue=1` in the flex-fallback branch. This is the exact same bug as #538, just in the sibling fire-gate function — fix it the same way for consistency (Rule 22 — sibling call sites of the same pattern must get the same treatment).

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useInterruptConfig.ts:computeDue flex-fallback branch:60
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useInterruptConfig.ts

**Source:** Audit finding F006 — severity 5 — requirements

---

### Task #554: Fix edge-case: sync cards merge can silently overwrite a just-recorded local review (pre-existing, out of Batch 23 scope)

**File:** hooks/useSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Cards merge can silently overwrite a just-recorded local review with stale server data in a specific race window; file not touched by Batch 23's diff and unrelated caller-context code, flagged as informational only, out of scope for Batch 23's own verdict but promoted as a real task since it was found during this audit.

The race: `runSyncNow` snapshots `pendingEvents` before `uploadReviewEvents`/`downloadReviewEvents`; a review recorded via `commitSession` → `enqueueReviewEvent` AFTER that snapshot but before `downloadReviewEvents` resolves gets correctly queued for the NEXT sync, but the current sync's `set()` at line 104 still unconditionally overwrites `s.cards[cardId]` with the (now-stale) server-derived value for that card, silently regressing FSRS state until the next sync corrects it. Fix: when merging the downloaded `patch` into `s.cards`, skip any `cardId` that has a `pendingEvents` entry newer than the just-downloaded data for that card (or simpler: skip any cardId still present in `pendingEvents` at merge time, matching the "trust local over stale-remote for anything not yet uploaded" principle). Add a regression test proving a card reviewed mid-sync is NOT overwritten by the sync's own merge.

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useSync.ts:cards merge:104
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useSync.ts

**Source:** Audit finding F021 — severity 2 — edge-case

---

## Agent Memories

## Architect Agent Memory (first 150 lines)
# Architecture Agent Memory — plyglt

## Stack
Next.js 16.2.9, React 19, Zustand 5, Tauri 2 (desktop + web). TypeScript throughout.

## Layer Structure (dependencies flow strictly down)
- `hooks/` — Custom React hooks. Own session management contract.
- `store/` — Zustand stores. Imports from lib/. hooks/ never gets edited BY store/ files and vice versa in this architecture — hooks/ composes store/, store/ never imports hooks/.
- `lib/` — Pure utilities. No React, no Zustand imports. Must NEVER import from store/, hooks/, components/, app/.

## Introduction Engine — directly relevant to your #538/#539/#551 tasks
`lib/introduction.ts` is pure. `canIntroduceNewCard` lives in `store/srsStore.ts` (NOT your file list this
wave — do not edit it, note needed changes in completion.md). BRAND.md: "Wrong across multiple days →
new card introductions pause until this one stabilizes" — this is `strandedAcrossDays`, cleared only by a
correct answer. Prior history in this codebase: this exact invariant (F10 in this file's own older notes)
was originally missing entirely and had to be added — you are now fixing the SECOND and THIRD generation
of the same bug class recurring in sibling call sites (the #533 backstop, and computeDue's flex-fallback).
This is a known recurring pattern for this codebase — when you fix #538, explicitly grep for every other
call site of `introduceCard`/`selectQualifyingNewCard` in the diff area to make sure you haven't missed a
fourth sibling.

## When You Finish
Write your completion summary to .autocode/stream-W1B/completion.md. The file
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
  Specifically list: what test cases hooks/useStudySession.test.ts needs for #538/#541/#551
  (Charles's stream or Wave 2 will add these — be precise: test name, setup, expected assertion)
  Any needed store/srsStore.ts change for #551 (canIntroduceNewCard daily-cap logic) — describe
  exactly what should change there for a future wave/stream to pick up.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W1B | #535 #538 #539 #541 #547 #551 #554 #561
