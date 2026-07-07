# Stream W1C — Batch 19 Remediation (Task #184)
**Date:** 2026-07-07
**Agent:** Charles
**Status:** COMPLETE
**Verification gate at close:** tsc=0 errors · 964/964 tests pass · lint=0 errors · `node -e "console.log(/^\d{4}-\d{2}-\d{2}$/.test('2026-13-45') && !isNaN(new Date('2026-13-45').getTime()))"` → `false`

## Tasks closed
- #184 — Fix two safety gaps in the SRS v3 migration (`store/migrations.ts` + `tests/migrations.test.ts`)

## What was done

### Fix 1 — Calendar-invalid date strings (e.g. `"2026-13-45"`)

Added `&& !isNaN(new Date(record.phaseStartDate).getTime())` and `&& !isNaN(new Date(record.introducedDate).getTime())` after each `DATE_RE.test()` call in the v3 migration.

`"2026-13-45"` passes `/^\d{4}-\d{2}-\d{2}$/` (month 13, day 45 each match `\d{2}`) but `new Date("2026-13-45")` is Invalid Date. Without the fix it became `phaseStartDate`, and `getDayOfPhase` returned `NaN` — silently hiding the card in every session forever.

### Fix 2 — Null record in introductions map

Added a null guard before accessing properties on each record:

```typescript
const record: Record<string, unknown> =
  rawRecord !== null && typeof rawRecord === "object"
    ? rawRecord as Record<string, unknown>
    : {};
```

A stored `null` entry caused `TypeError: Cannot read properties of null` when the IIFE accessed `record.phaseStartDate`. Zustand's persist middleware catches that TypeError and silently resets the entire store to defaults — wiping all SRS card history. The guard uses an empty object fallback so the IIFE reaches the today-fallback path and the null record gets a valid phaseStartDate without throwing.

Also changed the `introductions` cast from `Record<string, Record<string, unknown>>` to `Record<string, unknown>` so TypeScript doesn't fight the runtime null check.

### Tests added (two new `it()` blocks)
1. `"v2 → v3: null record does not throw and produces a valid phaseStartDate (Zustand data-loss guard)"` — covers Fix 2. Asserts `not.toThrow()` + valid YYYY-MM-DD output.
2. `"v2 → v3: calendar-invalid introducedDate (e.g. '2026-13-45') falls back to today, not preserved"` — covers Fix 1. Asserts result ≠ `"2026-13-45"`, is valid calendar date, and `introducedDate` field is not clobbered.

## Test count
- Before: 950
- After: 964 (+14 new tests across the session — 2 from this task)

## Debt entries logged: 0
## Carry-forward tasks generated: 0
