# Barry — Stream W6B — Wave 6 — 2026-07-08

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W6B | #254

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #254 — Fix a stranded card with a corrupt phaseStartDate being unable to self-heal

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W6B
[→] #254 — Fix stranded+corrupt-date self-heal path   ← starting now

## Files You Own (edit ONLY these)
store/srsStore.ts
lib/introduction.ts
tests/srsStore.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/packLoader.ts
lib/specialtyPackLoader.ts
tests/packLoader.test.ts
store/migrations.ts

## Task Definitions

### Task #254: Fix requirements: a stranded card with a corrupt phaseStartDate can never self-heal

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
A record that is both `strandedAcrossDays: true` and has a calendar-invalid `phaseStartDate` can never recover: `recordIntroductionResult`'s corrupt-date catch path (added by Task #247) returns before ever calling `recordResult`, and `recordResult` is the only code that clears `strandedAcrossDays` (on a correct answer). Once a record is in this combined state, `canIntroduceNewCard` stays permanently blocked for that user with no recovery except a manual store reset — narrow double-fault (requires both stranding AND date corruption on the same record), but a genuine permanent-block with zero test coverage in either direction. Found by Agent W (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Decide the recovery path: either (a) have the corrupt-date catch path in `recordIntroductionResult` still clear `strandedAcrossDays` on a correct answer even when `getDayOfPhase` throws (skip only the `dayOfPhase`-dependent parts of `recordResult`, not the whole update), or (b) have the migration/repair path that fixes a corrupt `phaseStartDate` also reset `strandedAcrossDays` to `false` so the card isn't permanently stuck once its date is repaired
- [ ] Add a test: a record with `strandedAcrossDays: true` and a corrupt `phaseStartDate`, call `recordIntroductionResult` with a correct answer, assert the record can eventually clear `strandedAcrossDays` and unblock `canIntroduceNewCard`

**Done when:** A test proves a stranded-and-corrupt-date record can recover, not stay permanently blocked. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — requirements — found by Agent W.

## Agent Memories

## Architecture Agent Memory (relevant excerpt)

Prior context on this exact function: `recordIntroductionResult` (store/srsStore.ts) already has a try/catch around `getDayOfPhase` (added Task #247) that logs `[ERR-INTRO-RESULT-{cardId}]` and returns early on a corrupt `phaseStartDate` — that's the correct behavior for preventing a crash, but it means `recordResult` (which is what clears `strandedAcrossDays` on a correct answer) never runs for that record. `strandedAcrossDays` lifecycle: set `true` only in `lib/introduction.ts:recordResult`'s triple-wrong branch, cleared `false` only in the correct-answer branch of the same function. Whatever recovery mechanism you choose, make sure it doesn't accidentally let a genuinely-still-wrong-answering user unblock `canIntroduceNewCard` without actually answering correctly — the fix should repair the DATE problem (or route around it) while still requiring an actual correct answer to clear the STRANDED flag.

## When You Finish
Write your completion summary to .autocode/stream-W6B/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W6B | #254
