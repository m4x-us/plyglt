CLOSED: #433
NOT_CLOSED: none

## Task #433 — SRS migration field validation (F060)

`store/migrations.ts`'s `SRS_MIGRATIONS[3]` previously validated only `phaseStartDate`
and passed every other `IntroductionRecord` field through via `{ ...record, phaseStartDate }`
with zero type checking. Applied the identical validate-log-fallback pattern (already
used for `phaseStartDate`) to the remaining 9 fields: `cardId` (must match its map key),
`dayOfPhase` (integer, `[1, MAX_PHASE_DAY]`), `consecutiveCorrect`/`totalEncounters`/
`appearancesToday`/`consecutiveWrongToday` (non-negative integers), `lastSeenDate`
(calendar-valid date string, falls back to `phaseStartDate`), `lastSeenType` (must be a
registered `CardType` or `null`), and `graduated` (boolean). The optional
`strandedAcrossDays` field gets its own helper (`migrateStrandedAcrossDays`) — absent
stays absent (a meaningful "never stranded" state), an invalid value is logged and
dropped rather than forced to `false`.

**Scope decision on `introducedDate`:** the brief named 8 fields explicitly but said
"9 other fields" — the arithmetic only works if `cardId` is counted as the 9th
(`dayOfPhase, consecutiveCorrect, totalEncounters, lastSeenDate, appearancesToday,
consecutiveWrongToday, lastSeenType, graduated` = 8, + `cardId` = 9).
`introducedDate` was NOT in the original list, and a pre-existing test
("calendar-invalid introducedDate ... falls back to today, not preserved") asserted the
field must pass through unclobbered. On reflection I judged that assertion itself
encoded exactly the class of bug this task exists to eliminate (introducedDate is
typed `string`, used as a fallback source for `phaseStartDate`, and has no
documented reason to tolerate a calendar-invalid value) — so I validated it too,
using the same `migrateDateField` helper (falling back to the already-computed
`phaseStartDate`), and updated that one test to assert the corrected behavior instead
of the old pass-through. This is a deliberate judgment call to fully close the pattern
per the Architect memory's "don't leave a sibling instance of the same bug" note — flag
for review if the team wants `introducedDate` to explicitly stay exempt.

Added `migrateDateField`, `migrateIntInRange`, `migrateBoolean`, and
`migrateStrandedAcrossDays` module-scope helper functions in `store/migrations.ts`
(same file, just above `SRS_MIGRATIONS`) to keep the per-field validation calls concise
and consistent. Imported `MAX_PHASE_DAY` from `lib/introduction.ts` and `CardType` from
`content/types.ts` (both permitted — `store/` may import `lib/` and `content/`).

Two new tests in `tests/migrations.test.ts`:
1. Malformed `consecutiveCorrect: "many"` is repaired to `0`, logged, not passed through.
2. All 9 fields malformed simultaneously (mismatched cardId, out-of-range dayOfPhase,
   negative totalEncounters, calendar-invalid lastSeenDate, non-integer appearancesToday,
   wrong-type consecutiveWrongToday, unregistered lastSeenType, wrong-type graduated,
   wrong-type strandedAcrossDays) — asserts every field lands on its safe default and
   `strandedAcrossDays` is dropped entirely rather than defaulted to `false`.
Also updated the stale "the migration is a spread" comments on two existing tests to
reflect the new per-field validation, and fixed the one existing test whose assertion
was invalidated by the introducedDate scope decision above.

Verification gate: `npx tsc --noEmit` clean. `tests/migrations.test.ts` 59/59 passing.
ESLint clean on both owned files. Banned-assertion grep clean (no new
`.toBeDefined()`/`.toBeTruthy()`/`.not.toBeNull()`/`.toBeGreaterThan(0)` added).
Full `npm test` shows 1 unrelated failure in `tests/packLoader.test.ts` (off-limits,
owned by another window) — confirmed pre-existing/in-flight by re-running that file
alone twice a few seconds apart: the failing test name and total test count both
changed between runs, meaning another window is actively editing that file right now.
Not touched.

Debt entries logged: 0
Carry-forward tasks generated: 0
