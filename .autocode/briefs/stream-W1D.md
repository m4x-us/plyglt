# Stream W1D Brief — /advance Wave 1 — 2026-06-26

## Your Role
You are a child CTO executing Wave 1, Stream D of a parallel /advance session.
Work exclusively on the files listed in "Files You Own". MUST NOT modify any other file.

## STREAM_ID
Your STREAM_ID is: W1D
Your stream's tasks.md has been pre-populated at `.autocode/stream-W1D/tasks.md`.

## Execution Order
Run in this exact order (blockers first):

1. Skill({ skill: "task", args: "#010" })  — Fix NFC normalization in checkAnswer (lib/srs.ts)
2. Skill({ skill: "task", args: "#012" })  — Fix stability clamping — add upper bound in scheduleCard
3. Skill({ skill: "task", args: "#072" })  — Delete app/decks/ empty directory
4. Skill({ skill: "task", args: "#073" })  — Ratchet vitest.config.ts coverage thresholds

**Note:** Task #073 MUST run last — it ratchets coverage thresholds and must be applied after any tests added by earlier tasks in this stream have been verified to pass.

## Files You Own (edit ONLY these)
lib/srs.ts
app/decks/  (delete this directory entirely)
vitest.config.ts
tests/srs.test.ts  ← add tests for #010 and #012

## Off-Limits Files (DO NOT MODIFY — owned by other streams this wave)
hooks/useLangPack.ts                  (W1A)
lib/langRegistry.ts                   (W1A)
lib/packLoader.ts                     (W1A)
tests/packLoader.test.ts              (W1A)
tests/langRegistry.test.ts            (W1A)
tests/useLangPack.test.ts             (W1A)
lib/tauri.ts                          (W1B)
components/InterruptHandler.tsx       (W1B)
store/srsStore.ts                     (W1B)
app/study/page.tsx                    (W1B)
lib/constants.ts                      (W1B)
tests/srsStore.test.ts                (W1B)
lib/importBackup.ts                   (W1C)
app/settings/page.tsx                 (W1C)
lib/entitlement.ts                    (W1C)
store/entitlementStore.ts             (W1C)
components/EntitlementValidator.test.tsx  (W1C)
tests/entitlement.test.ts             (W1C)

## Task Definitions

### Task #010 | Fix NFC normalization — change NFD+strip to NFC in checkAnswer
**Severity:** 7 | **File(s):** `lib/srs.ts:225-229`
**DoD Tier:** 2

The `normalize()` closure inside `checkAnswer` (lines 225-229) uses `.normalize("NFD").replace(/[̀-ͯ]/g, "")` — NFD decomposition followed by diacritic stripping. This is the wrong transformation for exact matching: it causes "caffè" typed correctly to strip its accent and match "caffe", accepting imprecise input as correct. Correct behaviour: use `.normalize("NFC")` to canonicalize Unicode without stripping diacritics. Diacritic-tolerant matching (for when the user omits accents) is a separate, additive feature gated by `diacriticTolerant` (added in #011, which is in Wave 2).

**Changes required:**
1. `lib/srs.ts:225-229` — in the `normalize` closure, change `.normalize("NFD").replace(/[̀-ͯ]/g, "")` to `.normalize("NFC")`. Remove the diacritic-stripping regex entirely from `normalize`.
2. `lib/srs.ts:218-251` — add `diacriticTolerant?: boolean` to the `options` parameter type. Add a separate `normalizeStripped(s: string)` helper (private to the function scope) that applies NFC first, then strips diacritics — used only when `diacriticTolerant` is true.
3. Update the matching loop (lines 238-250): if `diacriticTolerant`, also compare `normalizeStripped(t)` against `normalizeStripped(a)` etc. A stripped match should return `"close"` not `"correct"` (missing accent = close, not exact).

**Test required (write first):**
- `tests/srs.test.ts` — add:
  - `checkAnswer("caffè", ["caffè"])` returns `"correct"` (NFC exact match).
  - `checkAnswer("caffe", ["caffè"])` returns `"wrong"` by default (no diacriticTolerant).
  - `checkAnswer("caffe", ["caffè"], { diacriticTolerant: true })` returns `"close"`.
  - `checkAnswer("caffè", ["caffè"], { diacriticTolerant: true })` returns `"correct"` (exact still preferred).

**Done condition:** Tests above pass. `grep -n "NFD" lib/srs.ts` returns zero hits. Verification gate green.

---

### Task #012 | Fix stability clamping — add upper bound in scheduleCard
**Severity:** 7 | **File(s):** `lib/srs.ts:177`
**DoD Tier:** 2
**Complexity: Direct**

`scheduleCard()` at line 177 clamps stability with `Math.max(0.1, S)` — a lower bound only. Without an upper bound, extreme FSRS inputs (very high stability values after many correct reviews) can produce stability values above 36500 days (100 years), causing `nextInterval()` to return astronomically large integers that overflow date arithmetic.

**Changes required:**
1. `lib/srs.ts:177` — change:
   ```ts
   stability: Math.max(0.1, S),
   ```
   to:
   ```ts
   stability: Math.max(0.001, Math.min(36500, S)),
   ```
   Note: lower bound also tightened from 0.1 to 0.001 to match FSRS spec (0.1 day = 2.4 hours is too coarse for same-session relearning cards).
2. `lib/srs.ts:54-58` — `nextInterval()` currently has no upper bound. Add `Math.min(36500, ...)` wrapper around the final interval value before the `Math.round`.

**Test required (write first):**
- `tests/srs.test.ts` — add:
  - After scheduling a card with impossibly high stability (e.g. inject `stability: 999999`), `scheduleCard(card, "easy").stability` is `≤ 36500`.
  - `nextInterval(999999)` returns `≤ 36500`.
  - `scheduleCard(card, "again").stability` is `≥ 0.001`.

**Done condition:** Tests above pass. `grep -n "Math.max(0.1" lib/srs.ts` returns zero hits. Verification gate green.

---

### Task #072 | architecture | severity 3
**What:** Delete `app/decks/` empty directory
**Why:** Empty directories confuse future agents and maintainers. Owner confirmed: delete it. If a Decks feature is later planned, it gets a real task and a stub page at that time.
**File:** `app/decks/` (entire directory)
**Severity:** 3 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — directory has no files, no routes, no imports.
**Test required (write first):** `grep -r "app/decks" --include="*.ts" --include="*.tsx" . | grep -v node_modules` should return zero hits before and after.
**Done condition:** `ls app/decks 2>/dev/null` returns non-zero (directory does not exist). Verification gate green.
**Owner:** Architecture Agent

---

### Task #073 | tests | severity 3
**What:** Ratchet `vitest.config.ts` coverage thresholds to match current actual coverage (SCTS Kaizen rule)
**Why:** SCTS Kaizen: coverage thresholds must only ever increase. Coverage improved to lines=85.37%, functions=80.82%, branches=80.23%, stmts=83.49%. Thresholds still at 2026-06-25 values (lines=81, funcs=75, branches=75, stmts=79). Safe new values: lines=84, functions=79, branches=79, statements=82 (actual minus 1.5% buffer).
**File:** `vitest.config.ts`
**Severity:** 3 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing (but should be applied after any task that adds tests in same batch)
**Risk:** Low — pure threshold increase; failing tests would have already failed at lower threshold.
**Test required (write first):** No new test needed. `npx tsc --noEmit && npm test` must pass after threshold change.
**Done condition:** `grep -n "lines.*84\|functions.*79\|branches.*79\|statements.*82" vitest.config.ts` returns hits. `npm test` passes. Verification gate green.
**Owner:** QA Agent

---

## Agent Memories

## Architect Agent Memory (first 100 lines)

agent: architect
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Blast-radius ranking — lib/srs.ts is the highest blast-radius file in the codebase:**
1. `lib/srs.ts` — 11 importers (this is your primary file — tread carefully)

**Layer structure context:**
- `lib/` — Pure utilities. `lib/srs.ts` implements the FSRS v4 algorithm.
- `content/types.ts` defines card types. `lib/srs.ts` defines the scheduling math.
- NO imports from `store/` or `hooks/` allowed in `lib/` (Rule 3).

**Open findings in your stream's files:**
- `lib/srs.ts:225-229` — NFD+strip normalization is wrong for exact matching. Should be NFC. The diacritic-stripping was incorrectly placed in the base normalize path — it belongs only in a separate `diacriticTolerant` branch.
- `lib/srs.ts:177` — Missing upper bound on stability. `Math.max(0.1, S)` with no ceiling allows stability >36500 days, overflowing date arithmetic.
- `lib/srs.ts:54-58` — `nextInterval()` also has no upper bound (companion fix needed with #012).
- `vitest.config.ts:15-18` — Functions coverage threshold set to actual-3%, explicitly permitting uncovered entitlement functions (S001-S003) to pass CI without error. (This is what Task #073 fixes.)
- `app/decks/` — empty directory, confusing to agents and maintainers.

**FSRS invariants to preserve:**
- Stability must be in `[0.001, 36500]` after clamping.
- Difficulty must be in `[1, 10]` (this is already enforced — do not change).
- `nextInterval()` must return integer days in `[1, 36500]`.
- Grade "again" must always produce the shortest interval and lowest stability — verify tests confirm this.
- `scheduleCard` with `grade: "again"` must produce `stability >= 0.001` (the new lower bound).

**Read Next.js docs in node_modules/next/dist/docs/ before touching any app/ file.**

## QA Agent Memory (first 100 lines)

agent: qa
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Test framework:** Vitest 4 with `vi.mock`, `vi.fn`, `vi.spyOn`. Config in `vitest.config.ts`.
**Test locations:** All tests live under `tests/` (flat, not co-located).
**Current test count:** 310 tests across 16 test files.
**Coverage baseline (2026-06-26):** stmts=83.49%, branches=80.23%, functions=80.82%, lines=85.37%.

**Coverage thresholds (current — pre Task #073):**
lines=81, funcs=75, branches=75, stmts=79

**Target thresholds for Task #073 (actual minus ~1.5% buffer):**
lines=84, functions=79, branches=79, statements=82

**IMPORTANT for Task #073:** Run `npm test` to get the FINAL coverage numbers AFTER all your stream's tests (#010, #012) are added. Then set thresholds to `actual - 1.5%` (floor to nearest integer). If coverage increased beyond the values above, set higher thresholds. Never set lower than the baseline.

**Key test file for this stream:**
- `tests/srs.test.ts` — existing SRS tests. Your tasks #010 and #012 add tests here.
- `vitest.config.ts` — Task #073 ratchets thresholds after all stream tests pass.

**Critical SRS paths:**
- `loadPack → buildQueue → rateCard → saveActiveSession` — the full study loop
- FSRS mathematical invariants over arbitrary inputs (difficulty ∈ [1,10], dueDate ≥ now for non-again, stability monotonicity)

**For Task #010 (NFC normalization):** The test must prove:
1. Correct accented input is accepted as CORRECT (not downgraded because accent was stripped).
2. Missing accent WITHOUT diacriticTolerant is WRONG (not silently accepted).
3. Missing accent WITH diacriticTolerant is CLOSE.
4. Exact match WITH diacriticTolerant is still CORRECT (exact beats stripped-match).

**For Task #012 (stability clamping):** The test must prove the invariant holds at extreme values — inject `stability: 999999` and verify output is bounded. Also verify the lower bound is now 0.001 (not 0.1).

## Done When
All 4 tasks complete when each Skill({ skill: "task" }) call confirms done-when met.
Write your completion summary to `.autocode/stream-W1D/completion.md`:

```
Tasks closed: [list task numbers that reached COMPLETE status]
Tasks NOT completed: [list task number + done-when condition that failed]
Debt entries logged: [count of rows appended to your .autocode/stream-W1D/debt.md]
Carry-forward tasks generated: [count of new ### Task # blocks added to your tasks.md]
```
