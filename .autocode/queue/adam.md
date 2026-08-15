---
status: done
agent: adam
stream: W4A
wave: 4
---

# Adam — Stream W4A — Wave 4 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W4A | #563 #576 #584 #572

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

This is Wave 4 of Batch 23's remediation. Wave 3 (already merged to main) fixed the
production bugs these tests are meant to guard — read the CURRENT state of
`hooks/useStudySession.ts` and `store/srsStore.ts` (both off-limits to you this wave, but
read-only inspection is fine and necessary) before writing any test, since the fixes changed
shape from what the original findings described.

## Your Tasks (run in this exact order)
1. /task #563  — Fix tests: no test can detect the daily-cap overshoot (#562's bug — now fixed in Wave 3, verify a regression test exists or is still needed)
2. /task #576  — Fix tests: #538/#541 regression tests were never added — the backstop code they'd test was DELETED in Wave 3, not fixed
3. /task #584  — Fix tests: near-due-card dedup test only proves the outer filter, not the inner loop check
4. /task #572  — Fix tests: srsStore.test.ts's "respects the limit parameter" test uses a weak bound instead of an exact value

IMPORTANT CONTEXT FROM WAVE 3 (read `hooks/useStudySession.ts`'s current state, and Adam's
own Wave 3 completion note reproduced below, before starting #563/#576):

> #562 — the per-iteration daily-cap recheck: `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`
> is now called directly inside the `while` loop's condition (not once before it). The old
> `flexIntroAllowed` local variable no longer exists.
> #563 (Wave 3 stream's own note): "my #562 fix already ships with its own dedicated
> regression test ('stops flexing new cards the moment canIntroduceNewCard flips false
> mid-batch...') — #563 may already be satisfied; worth checking before writing a duplicate."
> #565 — the never-empty backstop was DELETED entirely (not made reachable) — Wave 3 judged
> it was still dead code after the #562 fix and removed it rather than leave misleading
> "safety net" code in place.
> #576 (Wave 3 stream's own note): "any #538/#541 regression test that asserted on the
> backstop's behavior specifically needs updating to reflect it no longer exists as a
> distinct code path (the near-due fill and flex loop are now the only fill mechanisms)."

Given this: for #563, first check `hooks/useStudySession.test.ts` for the test Adam's Wave 3
stream added for #562 — if it genuinely proves the daily cap is enforced per-iteration (not
just per-session), #563 may already be closed; verify with a Deletion Test before deciding
whether to add anything new. For #576, since the backstop no longer exists, a literal
"stranded-pause-blocks-backstop" test doesn't make sense anymore — the #538 concern (does a
stranded pause correctly block ALL new-card introduction during an interrupt session, not
specifically "the backstop") is still valid and should be tested against the current code
shape (the flex while-loop, since that's the only introduction path left). The #541
(near-due-interleaving) concern is separate and still applies as originally described — check
whether Wave 3's own new tests already cover it (Adam's Wave 3 stream mentioned adding tests
for #562/#573/#574 but not explicitly #541's interleaving scenario).

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W4A
[→] #563 — Fix tests: daily-cap overshoot test   ← starting now
[ ] #576 — Fix tests: #538/#541 regression tests (backstop deleted, retarget)
[ ] #584 — Fix tests: inner-loop dedup check untested
[ ] #572 — Fix tests: weak bound instead of exact value

## Files You Own (edit ONLY these)
hooks/useStudySession.test.ts
tests/srsStore.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
CLAUDE.md
lib/queue.ts
docs/INTERRUPT_ARCHITECTURE.md
hooks/useStudySession.ts (read-only reference — production file, already fixed in Wave 3)
store/srsStore.ts (read-only reference — production file, already fixed in Wave 3)

## Task Definitions

### Task #563: Fix tests: no test can detect the daily-cap overshoot

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No test in the suite can detect the F001 overshoot. The canIntroduceNewCard mock (capUsedNotStranded) is a pure function of its own call arguments only and returns the same answer regardless of how many cards were already introduced earlier in the same render. INTERRUPT_FLEX_DAILY_MAX's actual value (9) is never asserted in any test file; a regression reverting the daily cap back to the pre-#551 Number.MAX_SAFE_INTEGER bug would pass every existing test unchanged.

NOTE: Wave 3 already fixed the underlying #562 bug and its own stream reported adding a dedicated regression test. Check first whether that test already satisfies this finding (run a Deletion Test: temporarily revert the `while` loop's per-iteration check back to a single pre-loop check, confirm the existing test fails). Only add a new test if a real gap remains.

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:capUsedNotStranded mock / flexes-past-daily-cap test:0
- [ ] Audit passes: real Verification Gate (tsc, npm test, npm run lint) — `scripts/deep-audit.sh` does not exist in this repo

**Source:** Audit finding F002 — severity 5 — tests

---

### Task #576: Fix tests: #538/#541 regression tests never added

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The regression tests explicitly requested for #538 (stranded-pause-blocks-backstop) and #541 (near-due-interleaving) were never added to hooks/useStudySession.test.ts, by either the Wave 1 remediation stream or Wave 2. No test in the current suite regresses either specific fix.

NOTE: the "backstop" this originally referred to was DELETED in Wave 3 (see the context note above the task list) — do not write a test targeting code that no longer exists. Retarget: write a test proving a stranded pause correctly blocks ALL new-card introduction during an interrupt session via whatever mechanism currently implements that (the flex while-loop's `canIntroduceNewCard` check). For #541 (near-due-interleaving — a scenario where already-in-session cards are interleaved rather than clustered in the near-due pool, and the fill should still reach the floor), check whether Wave 3 already added equivalent coverage before writing a duplicate.

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:stranded-pause-blocks-backstop / near-due-interleaving regression tests:0
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F015 — severity 5 — tests

---

### Task #584: Fix tests: near-due dedup test only proves the outer filter

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This pre-existing test only proves the outer setQueue dedup filter catches a duplicate; it does not exercise the inner loop-level check at all, a gap the test's own inline comment admits. A regression that removed the inner check would not be caught by this test.

NOTE: Charles's Wave 3 stream (W3C) reported this may already be resolved — check `hooks/useStudySession.test.ts` for a test proving the inner loop-level check specifically (distinct from the outer setQueue filter) before writing a new one.

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:never duplicates a near-due card already in the queue test:0
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F023 — severity 4 — tests

---

### Task #572: Fix tests: weak bound instead of exact value

**File:** tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Uses toBeLessThanOrEqual(3) instead of toBe(3) for a test named "respects the limit parameter". This passes even if the slice returned 0 or 1 cards instead of the correct 3.

Charles's Wave 3 stream added a new `!introMap[card.id]` filter to `store/srsStore.ts`'s `getNewCards` (Task #567) — read the current implementation before changing this test's expected value, since the exact count of cards satisfying "limit parameter respected" may now differ depending on this test's fixture data (whether any of its fixture cards have `introductions` entries). Change `toBeLessThanOrEqual(3)` to `toBe(3)` (or whatever the genuinely correct exact count is, given the current getNewCards implementation and this test's specific fixture).

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/srsStore.test.ts:respects the limit parameter test:351
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F011 — severity 5 — tests

---

## Agent Memories

## QA Agent Memory (relevant excerpt)
Rule 18 (Deletion Test): before adding a test, check whether an existing test already
satisfies the same falsifiability requirement — duplicating coverage is waste, but silently
skipping a genuine gap because "it looks similar" is worse. When in doubt, run the Deletion
Test on the existing test first.

## When You Finish
Write your completion summary to .autocode/stream-W4A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful — for each task, state explicitly
whether you found existing Wave 3 coverage already sufficient or had to add something new.

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W4A | #563 #576 #584 #572
