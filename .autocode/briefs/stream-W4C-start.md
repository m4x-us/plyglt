# Charles — Stream W4C — Wave 4 — 2026-07-07

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W4C | #237 #238 #239

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #237 — Fix commitSession's "atomicity" test not testing atomicity
2. /task #238 — Fix useLangPack.test.ts's error-message enumeration omitting base_pack_not_loaded
3. /task #239 — Add packLoader stale-cache fallback semantic-corruption test

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W4C
[✓] #237 — Fix commitSession atomicity test   ← done
[→] #238 — Fix useLangPack discriminant coverage   ← starting now
[ ] #239 — Add packLoader corruption test

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
tests/commitSession.test.ts
tests/useLangPack.test.ts
tests/packLoader.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/srsStore.ts
lib/introduction.ts
store/migrations.ts
tests/srsStore.test.ts
app/study/page.tsx
content/types.ts
lib/langRegistry.ts
lib/language.ts
lib/entitlement.ts
tests/study_loop.test.ts
tests/importBackup.test.ts
AGENTS.md

## Task Definitions

### Task #237: Fix tests: commitSession's "atomicity" test doesn't test atomicity

**File:** tests/commitSession.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
"all three slices are consistent — no partial application" (tests/commitSession.test.ts:36-47) claims to prove `commitSession`'s atomic single-`set()`-call contract (documented in store/srsStore.ts:72-74) but only checks final-state values. It would pass identically if `commitSession` made three sequential `set()` calls instead of one. `tests/seam_studyLoop.test.ts:93-129` already has the correct pattern (subscribe + snapshot-count) for the sibling `rateCardAndSaveSession` function — the same pattern was not applied here. Found independently by Agents K and V.

**Acceptance Criteria:**
- [ ] Rewrite the test to subscribe to the store and assert exactly 1 snapshot fires for a single `commitSession` call, matching the pattern already used in `tests/seam_studyLoop.test.ts`

**Done when:** The rewritten test would fail if `commitSession` were changed to call `set()` more than once. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — tests — converged independently by Agents K and V.

---

### Task #238: Fix tests: useLangPack.test.ts's error-message enumeration omits base_pack_not_loaded

**File:** tests/useLangPack.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
The `RAW_DISCRIMINANTS`/`EXPECTED_MESSAGES` enumeration added by Task #227 (tests/useLangPack.test.ts:84-103) omits `base_pack_not_loaded` — 1 of 5 `LoadPackResult` error discriminants (defined lib/packTypes.ts:41-46, copy in hooks/useLangPack.ts:18) is never tested. A Rule 16 enumeration gap in a fixture explicitly built to enumerate all discriminants. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add `base_pack_not_loaded` to `RAW_DISCRIMINANTS` and its exact expected copy to `EXPECTED_MESSAGES`

**Done when:** All 5 `LoadPackResult` error discriminants are covered by the enumeration test. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — tests — found by Agent K.

---

### Task #239: Fix tests: packLoader stale-cache fallback has no semantic-corruption test

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
No test in tests/packLoader.test.ts exercises syntactically-valid-but-semantically-malformed cached JSON (e.g. non-array `units`) reaching the offline stale-cache-fallback path (lib/packLoader.ts:210-235). That path skips the shape validation the happy-path download branch performs, so a truncated/corrupted cache write (plausible per the file's own atomic-write comment) could leak an invalid `Pack` as `ok:true`. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add a test that seeds a cached pack with a non-array `units` field, forces the offline-fallback path, and asserts the result is either rejected or validated before being returned

**Done when:** A test with semantically-malformed cached JSON asserts the stale-cache fallback path does not silently return an invalid Pack as `ok:true`. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — tests — found by Agent K.

## Agent Memories

## QA Agent Memory (relevant excerpt)

### Test Framework
Vitest 4 with vi.mock, vi.fn, vi.spyOn. @testing-library/react for hook tests.
Test command: `npm test`. Coverage: `npm test -- --coverage`.
Coverage thresholds: lines=84, funcs=79, branches=81, stmts=82. Thresholds only ever increase — never lower.

### Key Test Files and What They Cover (relevant to this stream)
- `tests/packLoader.test.ts` — includes Task #152 "specialty pack merge path" describe block: 3 tests (happy path merge, base_pack_not_loaded, idempotent) that fail if isReadySpecialtyPack block is removed. Your #239 test should sit alongside the existing offline-fallback describe block, following the same mocking style already in the file.
- `tests/seam_studyLoop.test.ts` — has the correct atomicity-proving pattern (subscribe + snapshot-count) at lines 93-129 for `rateCardAndSaveSession`. Your #237 fix should mirror this exact pattern for `commitSession`.

### Known Test Quality Pattern in This Codebase (read before writing any test)
This entire batch's central theme is Rule 16 (Enumerate Before You Assert) / Rule 18 (Test Falsifiability, the "B7 deletion test"): a test must fail if the specific production code path its name describes were broken or deleted. Before finishing any of your 3 tasks, apply the deletion test yourself: would this assertion still pass if the fix were reverted? If yes, it's pseudocode — rewrite it.

### Recently Resolved (Task #227, same day) — for context only, do not re-touch
- AGENTS.md's grep gate now checks 4 weak-assertion patterns (toBeDefined/toBeTruthy/not.toBeNull/toBeGreaterThan(0)) — zero unjustified instances remain repo-wide as of this morning. Don't introduce new ones in your test additions.

## When You Finish
Write your completion summary to .autocode/stream-W4C/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W4C | #237 #238 #239
