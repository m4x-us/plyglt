# Stream W1A Completion — Adam — 2026-07-07 (Wave 1 — Task #179)

## Tasks closed: [#179]
## Tasks NOT completed: none
## Debt entries logged: 0
## Carry-forward tasks generated: 0

---

### #179 — Fix remaining behavior bugs and code quality gaps in lib/introduction.ts — COMPLETE

**F18 — Rule 2 header added:**
Added `DEPENDS ON` and `USED BY` comment block to `lib/introduction.ts` file header, documenting
dependency on `@/content/types` and usage by `store/srsStore.ts` and `hooks/useStudySession.ts`.

**F07 — MAX_APPEARANCES_BY_PHASE_DAY frozen and typed:**
Changed `export const MAX_APPEARANCES_BY_PHASE_DAY: Record<number, number> = { ... }` to
`export const MAX_APPEARANCES_BY_PHASE_DAY: Readonly<Record<number, number>> = Object.freeze({ ... })`.
An importer attempting to mutate this table now silently fails in non-strict mode and throws in strict mode.

**F06 — Named constants extracted:**
Added `export const GRADUATION_THRESHOLD = 15` and `export const CONSECUTIVE_WRONG_RESET = 3`.
Replaced all magic literals in `shouldGraduate` (1 site) and `recordResult` (2 sites) with these constants.
If thresholds change, one definition updates all call sites — no silent divergence possible.

**F11 — getDayOfPhase date validation:**
Added module-level `const DATE_RE = /^\d{4}-\d{2}-\d{2}$/` and a guard at the top of `getDayOfPhase`
that throws `[ERR-INTRO-DATE] getDayOfPhase: invalid date format — expected YYYY-MM-DD, got ...`
on any input that doesn't match the expected format. Previously, invalid input caused `NaN` to
propagate silently through `Math.max(1, NaN) → NaN`, `maxAppearancesToday(NaN) → 0`,
`shouldAppearToday → false`, causing the card to permanently disappear from the introduction queue.

**F19 — Ref ID on getNextCardType error:**
Changed `throw new Error("getNextCardType: available must not be empty")` to include the ref ID prefix
`[ERR-INTRO-EMPTY-POOL]`. The existing test uses substring matching so it still passes.

### Files modified
- `lib/introduction.ts` — all 5 fixes applied (header, Object.freeze, 2 constants, date validation, ref ID)
- `tests/introduction.test.ts` — added 3 new tests for malformed date strings (F11),
  1 new constant-value test block (GRADUATION_THRESHOLD=15, CONSECUTIVE_WRONG_RESET=3, freeze check)

### New tests added (964 total, up from 956)
1. `getDayOfPhase > throws [ERR-INTRO-DATE] when phaseStartDate is not YYYY-MM-DD`
2. `getDayOfPhase > throws [ERR-INTRO-DATE] when today is not YYYY-MM-DD`
3. `getDayOfPhase > throws [ERR-INTRO-DATE] on empty string inputs`
4. `GRADUATION_THRESHOLD / CONSECUTIVE_WRONG_RESET > GRADUATION_THRESHOLD is 15`
5. `GRADUATION_THRESHOLD / CONSECUTIVE_WRONG_RESET > CONSECUTIVE_WRONG_RESET is 3`
6. `GRADUATION_THRESHOLD / CONSECUTIVE_WRONG_RESET > MAX_APPEARANCES_BY_PHASE_DAY is frozen`

### Verification Gate (2026-07-07)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 964/964 pass (up from 956) ✓
- `npm run lint`: 0 errors (3 pre-existing warnings in off-limits files) ✓
- `grep -n "Object.freeze" lib/introduction.ts`: line 20 — MAX_APPEARANCES_BY_PHASE_DAY ✓
- `grep -n "GRADUATION_THRESHOLD\|CONSECUTIVE_WRONG_RESET" lib/introduction.ts`: lines 12, 15, 90, 116, 123 ✓
- Rule 2 header present at lines 3–5 ✓
