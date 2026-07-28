# Barry — Stream W21B — Wave 21 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Barry | W21B | #469

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Your task is the single highest-convergence finding of cycle 7 — 5 of 8 independent
reviewers, using 5 different methods, all flagged this exact gap. Read store/entitlementCrossTabSync.ts
in full before writing tests — it's a small file (97 lines) but its concurrency logic
(dedup, requeue, throw-recovery) needs deliberate test design, not just a quick smoke test.

## Your Tasks
1. /task #469 — Fix test-coverage: store/entitlementCrossTabSync.ts has no dedicated test file for its concurrency-safety logic

STATUS BOARD RULE — MANDATORY: After completing the task, print your status board:

Barry — W21B
[✓] #469 — entitlementCrossTabSync.ts dedicated test file   ← done

## Files You Own (edit ONLY these)
tests/entitlementCrossTabSync.test.ts (new file)

(store/entitlementCrossTabSync.ts itself is read-only reference — you are only adding a
test file, not editing the module under test.)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/importBackup.ts
tests/importBackup.test.ts
scripts/validatePack.ts
tests/validatePack.test.ts
lib/basePackLoader.ts
tests/generationGuard.test.ts
tests/featureFlags.test.ts
tests/fetchWithTimeout.test.ts
vitest.config.ts

## Task Definition

### Task #469: Fix test-coverage: store/entitlementCrossTabSync.ts has no dedicated test file for its concurrency-safety logic

**File:** tests/entitlementCrossTabSync.test.ts (new)
**Complexity:** ⚡ Direct — 1 new file, single-scope addition
**Blocked by:** Nothing
**Priority:** P2

**What:**
No test file in the repo imports store/entitlementCrossTabSync.ts by name. Its 72.72%/62.5% stmt/branch coverage is 100% incidental fallout from entitlementStore's own tests. The dedup-in-flight path (Task #304), the requeue-after-in-flight-settles path (Task #347, lines ~68), and the synchronous-throw catch-recovery path (Task #363, lines ~79-83) — the exact concurrency-safety guarantees this module's own header comment claims — are never directly exercised by any test. The same wave's Task #461 gave a structurally identical sibling extraction (lib/specialtyPackMerge.ts) a full dedicated test file specifically because it was flagged "highest-risk"; this module, carrying comparable concurrency-safety logic, did not get the same treatment.

**Acceptance Criteria:**
- [ ] tests/entitlementCrossTabSync.test.ts exists, calling createCrossTabSync directly with a fake rehydrate function
- [ ] Covers: concurrent/rapid storage events while a rehydrate is in flight (the requeue path — assert triggerRehydrate is called again after the in-flight one settles, not dropped), and a rehydrate() that throws synchronously (assert rehydrateInFlight resets to allow a subsequent call, rather than locking permanently)
- [ ] Existing indirect coverage via tests/entitlement.test.ts / tests/entitlementStoreEventWiring.test.ts is not duplicated, only supplemented — read both files first to see what's already covered (basic key-matching only)

Suggested test design: fake `rehydrate` as a `vi.fn()` you control the resolution timing of (e.g. returning a manually-resolved Promise) so you can assert calls-in-progress vs. queued calls precisely. For the throw-recovery path, make `rehydrate` throw synchronously on one call and resolve normally on the next, asserting the module recovers rather than staying locked.

**Source:** Cycle-7 audit finding F03 — severity 5 — convergence 5/8 (highest convergence this cycle) — LIVE, this sync mechanism runs in production web builds today.

## When You Finish
Write your completion summary to .autocode/stream-W21B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #469
NOT_CLOSED: none

(Or `CLOSED: none` / `NOT_CLOSED: #469 — [reason]` if incomplete.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W21B | #469
