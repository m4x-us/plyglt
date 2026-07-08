# Derek — Stream W4D — Wave 4 — 2026-07-07

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W4D | #243 #244 #245

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #243 — Fix study_loop.test.ts never asserting masteryPct
2. /task #244 — Fix importBackup normalizeCardProgress fallback coverage
3. /task #245 — Fix AGENTS.md's Stop-the-Line list omitting .toBeGreaterThan(0)

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W4D
[✓] #243 — Fix study_loop masteryPct assertion   ← done
[→] #244 — Fix importBackup fallback coverage   ← starting now
[ ] #245 — Fix AGENTS.md Stop-the-Line list

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
tests/study_loop.test.ts
tests/importBackup.test.ts
AGENTS.md

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
tests/commitSession.test.ts
tests/useLangPack.test.ts
tests/packLoader.test.ts

## Task Definitions

### Task #243: Fix tests: study_loop.test.ts never asserts masteryPct

**File:** tests/study_loop.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
"getStats correctly counts due, learning, and mastered across a mixed unit" (tests/study_loop.test.ts:86-109) checks 4 of 5 `getStats` return fields; `masteryPct` (drives `MASTERY_GATE`, a BRAND.md-critical unlock threshold) is never asserted. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add an assertion on the exact expected `masteryPct` value for the test's mixed-unit fixture

**Done when:** The test asserts a specific `masteryPct` value, not just the other 4 fields. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — tests — found by Agent K.

---

### Task #244: Fix tests: importBackup normalizeCardProgress fallback coverage incomplete

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`normalizeCardProgress` fallback coverage (tests/importBackup.test.ts:106-141) forces only 2 of 7 `CardProgress` fallback branches (`stability`, `lapses`); `difficulty`, `retrievability`, `dueDate`, and `reps` fallback paths (lib/importBackup.ts:52-56) are untested. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add a test case per remaining fallback branch (`difficulty`, `retrievability`, `dueDate`, `reps`) with an invalid input value and an exact expected fallback assertion

**Done when:** All 7 `CardProgress` fallback branches have a dedicated test case with an exact expected value. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — tests — found by Agent K.

---

### Task #245: Fix code-quality: AGENTS.md's Stop-the-Line list omits .toBeGreaterThan(0)

**File:** AGENTS.md
**Complexity:** ⚡ Direct — 1 file, 1 line
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
AGENTS.md's Verification Gate grep (line ~39) bans 4 assertion patterns including `.toBeGreaterThan(0)`, but the adjacent Stop-the-Line Violations bullet list (line ~84) only mentions 3, omitting `.toBeGreaterThan(0)` — a parallel-list violation introduced by Task #227 itself, directly contradicting the rule stated one line above it in the same document ("Any parallel list/array that should be derived from a single source of truth"). Converged independently by Agents W and K.

**Acceptance Criteria:**
- [ ] Add `.toBeGreaterThan(0)` to the Stop-the-Line Violations bullet so it matches the Verification Gate grep pattern exactly

**Done when:** AGENTS.md's Stop-the-Line Violations bullet and Verification Gate grep pattern list the same 4 banned assertion patterns. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — converged independently by Agents W and K.

## Agent Memories

## QA Agent Memory (relevant excerpt)

### Test Framework
Vitest 4 with vi.mock, vi.fn, vi.spyOn. Test command: `npm test`. Coverage thresholds: lines=84, funcs=79, branches=81, stmts=82 — thresholds only ever increase.

### Key Test Files and What They Cover (relevant to this stream)
- `tests/importBackup.test.ts` — Task #227 already extended two field-assertion tests here to all 8 CardProgress fields (a different test than the one you're fixing — normalizeCardProgress's fallback branches). Follow the existing file's style: exact per-field `expect(...).toBe(...)` assertions, no existence-only checks.
- `tests/study_loop.test.ts` — Task #227 already pinned the FSRS stability constant (3.1262) exactly in this file. Your masteryPct assertion should follow the same "derive the exact expected value from the real formula, don't guess" discipline — read `lib/srs.ts`'s `getStats` implementation to compute the correct expected masteryPct for the existing mixed-unit fixture before writing the assertion.

### Central theme of this whole batch (read before writing any test)
Rule 16 (Enumerate Before You Assert) / Rule 18 (Test Falsifiability, the "B7 deletion test"): a test must fail if the specific production code path its name describes were broken or deleted. Apply the deletion test to every assertion you add.

### AGENTS.md editing note (Task #245)
This is a 1-line documentation fix — the Verification Gate section (~line 39) already has the correct 4-pattern grep; only the "Stop-the-Line Violations" bullet list near the bottom of the file needs the same 4th pattern added for consistency. Do not touch anything else in AGENTS.md.

## When You Finish
Write your completion summary to .autocode/stream-W4D/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W4D | #243 #244 #245
