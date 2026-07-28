CLOSED: #472 #473
NOT_CLOSED: none

## #472 — fetchWithTimeout.test.ts pseudocode test fix

The "backstop timer does not fire" test only advanced fake timers past the timeout AFTER
`fetchWithTimeout` had already resolved, then asserted nothing threw. That proves nothing:
`Promise.race` attaches its own rejection handler to every promise in its array (including
the backstop) at race-call time, so even an uncleared backstop timer firing later becomes
an already-handled rejection with zero observable effect — no throw, no unhandled-rejection
warning. Deleting `finally`'s `clearTimeout(backstopTimeoutId!)` would not have failed this
test.

Rewrote it to spy on `globalThis.setTimeout`/`globalThis.clearTimeout` directly: two
independent timers are armed in `lib/fetchWithTimeout.ts`, in order — the abort timer
first, then the backstop's own timer — so `setTimeoutSpy.mock.results[1].value` is
specifically the backstop's returned id. The test asserts `clearTimeoutSpy` was called with
that exact id, which only happens if the `finally` block's `clearTimeout` call actually ran.

**Deletion Test performed and reverted (mandated by this task's own acceptance criteria):**
temporarily removed `clearTimeout(backstopTimeoutId!)` from `lib/fetchWithTimeout.ts`'s
`finally` block, confirmed the rewritten test fails
(`expected "clearTimeout" to be called with arguments... Number of calls: 1` — only the
abort timer's clearTimeout ran), then restored the line. Confirmed via `git diff` — empty —
before moving on. All 6 tests in the file pass with the fix in place.

## #473 — vitest.config.ts scripts/ coverage exclusion

Chose the "narrow the exclude, don't keep the blanket one" path (acceptance criteria's first
option), not the "document why it stays fully excluded" fallback — coverage still passes
comfortably with the narrower exclude, so there was no need to fall back.

Investigated all three files under `scripts/`:
- **`scripts/validatePack.ts`** — already guards its CLI section behind
  `const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? "").href` (its
  own line ~200), specifically so its exported functions (`validateCard`, `validateUnit`,
  `validatePack`) are safely importable in a test process without triggering
  `process.exit()`. `tests/validatePack.test.ts` already does exactly this. No reason for
  this file to stay excluded.
- **`scripts/exportPack.ts`** and **`scripts/checkCardIds.ts`** — both run unconditional
  top-level side effects (real file writes via `writeFileSync`/`readFileSync`,
  `process.argv` reads, `process.exit()` calls) with NO `isMainModule`-style guard and NO
  exported pure functions to test in isolation. Importing either directly in a test file
  would execute real file I/O and kill the vitest worker via `process.exit()` — not just
  fail an assertion. Giving them real coverage would require the same guard-and-extract
  refactor `validatePack.ts` already has, which is out of this task's single-file scope.

Changed `vitest.config.ts`'s `coverage.exclude` from the blanket `"scripts"` entry to
`"scripts/exportPack.ts"` and `"scripts/checkCardIds.ts"` specifically, with an inline
comment explaining why those two (and only those two) stay excluded. Ran the full coverage
suite: `scripts/validatePack.ts` now shows real coverage (60.33%/67.76%/100%/64.03% —
lower than its file average since large chunks of its CLI-argument-handling branches aren't
exercised by the existing unit tests, but non-zero and real). The AGGREGATE thresholds
(lines 84/funcs 79/branches 81/stmts 82) still pass comfortably with it counted:
89.32%/90.32%/84.94%/91.77% actual.

One transient false alarm during verification: a coverage run showed
`tests/featureFlags.test.ts` failing with a coverage-directory collision
("Something removed the coverage directory... ENOENT") — this was a concurrent-run
artifact from another window running vitest at the same moment (this repo has several
parallel Wave 21 streams active), not a real failure. Re-ran in isolation moments later —
28/28 tests passed cleanly, and the full coverage run then completed with exit code 0.

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` (full suite) — 66 files, 1418 tests, all passed.
- `npx vitest run --coverage` — thresholds all exceeded with `scripts/validatePack.ts` now
  counted (lines 91.77/funcs 90.32/branches 84.94/stmts 89.32 vs. 84/79/81/82 required).
- `npm run lint` — zero errors (3 pre-existing warnings, unrelated files).
- Existence-only-assertion grep — clean on `tests/fetchWithTimeout.test.ts`.

Debt entries logged: 0
Carry-forward tasks generated: 0 (noted inline in vitest.config.ts's comment instead: giving
`scripts/exportPack.ts`/`scripts/checkCardIds.ts` real coverage would need the same
guard-and-extract refactor already done for `validatePack.ts`, if their coverage is ever
specifically needed)
