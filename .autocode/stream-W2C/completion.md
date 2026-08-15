CLOSED: #558
NOT_CLOSED: none

## Task #558 — "truly nothing left" test doesn't exercise the near-due-mirror code path

**File touched:** `hooks/useInterruptConfig.test.ts` (only file owned this wave)

**Root cause:** The original test set up `nearDueIds` only via `makeState`'s default (`[]`) —
never explicitly — and asserted `computeDue(...)` returns `0`. But `hooks/useInterruptConfig.ts`'s
near-due-mirror branch (the `getNearDueCards` loop that runs after the new-card flex check comes
up empty, lines ~92-99) ALSO produces `0` in that exact scenario when it runs and finds nothing.
Since both "branch present, finds nothing" and "branch deleted entirely" yield the identical `0`
result, a bare `toBe(0)` assertion cannot distinguish them — Rule 18 (Test Falsifiability)
failure: the test would pass unchanged if the near-due-mirror code were deleted outright.

**Fix:** Wrapped `getNearDueCards` in a `vi.fn()` spy for this one test (leaving `makeState`'s
shared behavior for every other test untouched) and added
`expect(getNearDueCardsSpy).toHaveBeenCalledWith(unit.cards, 1)` alongside the existing
`toBe(0)` result assertion. A call-based assertion can prove the branch executed even when its
effect on the return value is null in this specific scenario, which the numeric result alone
cannot.

Per the brief, a separate positive-case test proving the mirror actually fires when
`getNearDueCards` DOES return something was NOT added new — it already exists in this file
("counts a near-due card when nothing is due, nothing is new, and no untouched card exists
(Batch 23)", ~line 213) and was confirmed (via the deletion test below) to already fail when
the branch is removed.

**Deletion Test — manually verified, not just asserted:**
1. Temporarily replaced the near-due-mirror loop in `hooks/useInterruptConfig.ts` (lines
   ~92-99) with a comment (production file — reverted immediately after, not committed).
2. Re-ran `hooks/useInterruptConfig.test.ts`: 3 failures.
   - The rewritten "truly nothing left" test failed exactly as intended — `toBe(0)` still
     passed, but the new `toHaveBeenCalledWith` assertion failed (spy never called: "Number
     of calls: 0").
   - The two pre-existing positive-case tests ("counts a near-due card when nothing is due..."
     and "falls through to a near-due card when the flex introduction is blocked...") also
     failed, confirming the near-due mirror was already load-bearing for those, independent of
     this task's fix.
3. Restored `hooks/useInterruptConfig.ts` from the saved copy; re-ran the full file — all 16
   tests pass again.

**Prior Wave Changes note followed:** Used the same `makeState`/`flexIntroAllowed` mock pattern
Barry established in Wave 1 (Task #539) rather than inventing a new one — the fix only adds a
spy wrapper around the `getNearDueCards` function `makeState()` already returns, it doesn't
change `makeState`'s signature or default behavior for any other test.

**Verification gate — all green (whole repo, not just the owned file):**
- `npx tsc --noEmit` — clean
- `npm test` — 101 files, 1952 tests passed (one transient failure in
  `tests/pushDueEstimate.test.ts` observed mid-run, traced to a concurrent write from another
  window's off-limits-to-me edit on `supabase/functions/send-interrupt-notifications/dueEstimate.ts`
  — re-ran in isolation and then the full suite again afterward, both clean; not caused by and
  unrelated to this task's change)
- `npm run lint` — 0 errors
- `npm test -- --coverage` — exit 0, all four thresholds (lines=84, funcs=79, branches=81,
  stmts=82) met (actual: stmts 91.79%, branches 87.44%, funcs 90.96%, lines 93.23%)

**Note on `scripts/deep-audit.sh`:** does not exist in this repo (same finding as my Wave 1
stream, W1C) — substituted the real Verification Gate as the task's own acceptance criteria
instructed.

Debt entries logged: 0
Carry-forward tasks generated: 0

Charles is done.

— Charles | W2C | #558
