CLOSED: #486
NOT_CLOSED: none

## Task #486 — numeric _version branch fractional/negative floor

Read the existing `isValidBackupVersionNumber(v) => isFinite(v) && v > 0` predicate and its
comment (landed Task #485, Wave 24) before touching anything, per the brief's explicit
instruction to extend rather than duplicate it. Confirmed the finding live before writing any
code: `parseBackup({_version:1.5,...})` and `parseBackup({_version:-0.0001,...})` both
returned `ok:true` prior to this change, matching Agent W's audit finding exactly.

Extended the shared predicate to `isFinite(v) && Number.isInteger(v) && v > 0` — one change,
in the one place both the string and numeric `_version` branches already delegate to, rather
than adding a second, parallel `Number.isInteger` check at either call site. Updated the
predicate's comment to explain why: Task #479's own inline comment claimed the numeric branch
was given "the identical isFinite gap" fix as the string branch and that this closed the gap;
it actually ported only `isFinite`, not the accompanying shape constraint the string branch's
digits-only regex (`/^\d+$/`) gets for free. This is the third occurrence of the same "one of
two structurally-identical branches fixed, twin left open" pattern this predicate exists to
eliminate by construction rather than by continuing to patch each branch separately.

**String-branch symmetry — verified, not assumed (per acceptance criteria):** ran a live
`npx tsx` sweep before writing tests, confirming `_version: "1.5"` (string) was already
rejected by the pre-existing digits-only regex — no decimal point is syntactically
representable, so the string branch was already correct on this axis. Added a dedicated test
(`"string branch already rejects fractional _version values symmetrically — no code change
needed there"`) asserting this explicitly rather than leaving it as an unverified assumption
in this completion note.

Live-verified via `npx tsx` against the real module (absolute path) both before and after the
fix:
- Before: numeric `1.5` → `ok:true`, numeric `-0.0001` → `ok:true` (matching the finding)
- After: both → `ok:false` with the generic error; numeric `-1` (regression check from #485)
  still `ok:false`; happy path (`2` / `"2"`) still `ok:true`
- Extended symmetry sweep (values `[0, -1, -2, 1, 2, 3, 999, -Infinity, Infinity, 0.5, 1.5,
  -0.0001, -0]`, each tried as both number and string) — every value agrees between branches
  after the fix, including the two fractional values that were the one remaining
  disagreement documented as "intentional, deferred" in Wave 24's completion note.

Added 3 tests under a new `Task #486` describe block in `tests/importBackup.test.ts`:
`_version: 1.5` (number) rejected, `_version: -0.0001` (number) rejected, `_version: "1.5"`
(string) rejected. Per the acceptance criteria, did not duplicate the `-1`/`0` cases — those
remain covered by Task #485's existing tests and were re-confirmed passing, not re-asserted.

**Deletion Test performed by hand:** backed up `lib/importBackup.ts`, reverted the predicate
to bare `isFinite(v) && v > 0` (no `Number.isInteger`), re-ran the file's test suite. Exactly
1 of the 3 new tests failed (`_version: 1.5`), as expected — the `-0.0001` test correctly kept
passing even with the revert, since a negative fractional value is already caught by the
pre-existing `v > 0` floor regardless of integer-ness, so it does not exercise the
`Number.isInteger` guard specifically. This confirmed the `1.5` test is the one that actually
proves the fix, and that the `-0.0001` test is a valid regression guard against the floor
check rather than redundant. Restored from backup; re-ran the full file — 64/64 passing.

## Verification

Full gate green: `tsc --noEmit` clean, `npm test` 1449/1449 passing (whole repo, 66 files),
`npm run lint` 0 errors (3 pre-existing warnings in `app/page.tsx` and
`hooks/useExportImport.ts`/`.test.ts` — files this stream doesn't own), coverage above every
threshold (stmts 89.81%, branches 85.89%, funcs 90.4%, lines 92.03%), Verification Gate
banned-assertion grep clean. No cross-stream instability hit this run.

Debt entries logged: 0
Carry-forward tasks generated: 0 (the `isValidBackupVersionNumber` predicate now enforces
finiteness, integer-ness, and positivity in one place for both branches — no further known
gaps in this validation path).
