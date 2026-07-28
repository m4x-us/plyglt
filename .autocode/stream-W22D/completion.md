CLOSED: #477
NOT_CLOSED: none

## #477 — parseBackup version-mismatch message quality

Attempted (and shipped) the precise fix rather than the documented-tradeoff fallback.

**Root cause:** Task #467 closed a real gap (a truthy non-number `_version` silently bypassed
the newer-version rejection entirely) by folding `typeof data._version !== "number"` into
the same combined shape-check that rejects malformed `srs`/`entitlement`, sending EVERY
non-number `_version` — including a plausible future-version string like `"999"` — to the
generic "missing required fields" message. That regressed message quality for exactly the
scenario #467's own rationale cited as the motivating case.

**Fix (lib/importBackup.ts):** split the `_version` string case out of the combined shape
guard entirely, checked right after the `srs`/`entitlement` shape check:
- `typeof data._version === "string"` → `Number(data._version)`; if that's not `NaN` and
  is `> CURRENT_BACKUP_VERSION`, return the SAME specific "newer version... update plyglt"
  message the numeric case already produces (using the parsed number for display). Any
  other string (non-numeric, or numeric but not actually newer) falls through to the
  generic message — a numeric string that ISN'T newer doesn't deserve special treatment
  either, since real backups never serialize `_version` as a string at all.
- Every other non-number shape (object, array, boolean) still falls through to the
  original combined generic-message guard, unchanged from #467's behavior.
- The numeric `_version` path (falsy check + `> CURRENT_BACKUP_VERSION` check) is otherwise
  untouched.

**Tests (tests/importBackup.test.ts):** rewrote the #467 test that had locked in the
generic message for `_version: "999"` to instead assert the specific message with the
parsed value (`backup v999`); added two new tests — a numeric string ≤
`CURRENT_BACKUP_VERSION` still gets the generic message (not a false "newer version"
claim), and a non-numeric string (`"not-a-version"`) also gets the generic message. Kept
the existing object/array/boolean test (renamed only for clarity) — those still get the
generic message unchanged, satisfying the acceptance criteria's second bullet directly.

**Deletion Test performed and reverted:** temporarily short-circuited the new specific-message
branch's condition to `false && ...` in `lib/importBackup.ts`, confirmed the new
`"999"` test fails (`expected` the specific message, `received` the generic one), then
reverted. Confirmed via `git diff` that the restored file matches my intended fix exactly
(no leftover `false &&`).

One transient flake during verification: an isolated `tests/importBackup.test.ts` run
briefly reported 48/48 instead of 50/50 with no visible failures — a `grep -c "  it("` count
confirmed all 50 `it()` blocks are still present in the file, and re-running moments later
(likely past a concurrent parallel-window test run) showed 50/50 cleanly. Not a real
regression.

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` (full suite) — 66 files, 1428 tests, all passed.
- `npx vitest run --coverage` — thresholds all exceeded (lines 92/funcs 90.34/branches
  85.77/stmts 89.79 vs. 84/79/81/82 required).
- `npm run lint` — zero errors (3 pre-existing warnings, unrelated files).
- Existence-only-assertion grep — clean on `tests/importBackup.test.ts`.

Debt entries logged: 0
Carry-forward tasks generated: 0
