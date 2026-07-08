# Stream W6C — Wave 6 — Documentation Fix (#256)
**Date:** 2026-07-08
**Agent:** Charles
**Status:** COMPLETE
**Verification gate at close:** tsc=0 errors · 1024/1024 tests pass · lint=0 errors

## Tasks closed
- #256 — Fix stale migration comment in store/migrations.ts

## What was done

### #256 — Stale migration comment

The v2→v3 migration comment (lines 50-52) said:

> "an empty string or calendar-invalid date would produce NaN in getDayOfPhase and silently hide the card forever."

This described the pre-Task-#231 behavior. Task #231 hardened `lib/introduction.ts:getDayOfPhase` to throw `[ERR-INTRO-DATE]` on invalid input rather than returning NaN.

Updated the comment to:
1. Accurately describe the migration's `isCalendarValidDate` check as **defense-in-depth at the persistence boundary** — independent of getDayOfPhase's runtime behavior
2. State that getDayOfPhase now **throws** `[ERR-INTRO-DATE]` on invalid input (not returns NaN)
3. Explain that the migration guard ensures corrupt persisted dates never reach getDayOfPhase in the first place

New comment:
```
// Corrupt records missing both fields fall back to today's date and log an error.
// The isCalendarValidDate check below is defense-in-depth at the persistence boundary:
// getDayOfPhase now throws [ERR-INTRO-DATE] on invalid input rather than returning NaN;
// this guard ensures corrupt persisted dates never reach it.
```

No code changes — comment only. No test changes needed (the behavior being described is already tested; only the documentation was stale).

## Debt entries logged: 0
## Carry-forward tasks generated: 0
