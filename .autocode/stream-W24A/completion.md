CLOSED: #485
NOT_CLOSED: none

## Task #485 — _version 0/negative string-vs-number asymmetry

Confirmed the finding live before touching any code: Task #481's "symmetric acceptance"
comment claimed both serializations of the same nominal version are treated identically,
but this was false for `0` and negative integers. Two DIFFERENT accidental mechanisms had
been implying "positive" in each branch: the numeric branch used `!data._version` (JS
truthiness — rejects exactly `0`, but not `-1`/`-2`/etc., which are truthy), while the
string branch used a digits-only regex (`/^\d+$/`, which can't syntactically represent a
negative number at all, so `"-1"` was rejected for a reason unrelated to its actual value).
The two implicit floors disagreed in both directions: string `"0"` was accepted while
numeric `0` was rejected; numeric `-1` was accepted while string `"-1"` was rejected.

Fixed by extracting one shared predicate, `isValidBackupVersionNumber(v)` — `isFinite(v) &&
v > 0` — used by both branches, so there is exactly one place that decides what counts as a
plausible positive version number. Per the brief's explicit instruction, did NOT add a
`Number.isInteger` check to this predicate — a fractional numeric `_version` like `1.5` is
Task #486's separate, already-tracked gap, deliberately left open for that follow-up
(confirmed live: `_version: 1.5` (number) is still accepted while `_version: "1.5"` (string)
is still rejected by the digits-only regex — an intentional, documented remaining
asymmetry, not an oversight).

Verified live via `npx tsx` before writing any test: ran a symmetry sweep across `[0, -1,
-2, 1, 2, 3, 999, -Infinity, Infinity, 0.5, 1.5, -0]`, each value tried both as a number and
as its string form. Confirmed every value in #485's stated scope now agrees between the two
branches (including `-0`, not named in the finding but swept anyway since the brief asked
for agreement on "every input, not just the examples named"); confirmed the two fractional
values are the only remaining disagreement, exactly matching Task #486's deferred scope —
positive proof the fix is neither too narrow nor accidentally over-reaching into the next
task's territory.

Added a dedicated test block covering the finding's 4 named scenarios (`0`, `"0"`, `-1`,
`"-1"`) plus a direct symmetry-property test (loops a value list, asserts both
serializations produce the identical `ok` result, with a descriptive failure message naming
which value disagreed) — proving the general property, not just the specific spot-checked
inputs. Verified the Deletion Test by hand: reverted the shared predicate to bare
`isFinite(v)` (no floor), confirmed 4 of 5 new tests fail (the reverted floor makes both
branches wrongly ACCEPT `0`/`-1`, and the symmetry-sweep test's failure message correctly
named the surviving `-1`-vs-`"-1"` disagreement caused by the regex's syntactic — not
semantic — negative-number handling), then restored from a backup copy and re-verified all
61 tests in the file pass.

## Verification

Full gate green: `tsc --noEmit` clean, `npm test` 1446/1446 passing (whole repo), `npm run
lint` 0 errors (3 pre-existing warnings in files this stream doesn't own), coverage above
every threshold (stmts 89.81%, branches 85.88%, funcs 90.4%, lines 92.03%), Verification
Gate banned-assertion grep clean. No cross-stream instability hit this run.

Debt entries logged: 0
Carry-forward tasks generated: 0 (Tasks #486/#487 are already tracked by the audit that
produced this finding — not duplicating them here. The shared `isValidBackupVersionNumber`
predicate is deliberately shaped so #486 can extend it in one place, e.g. by adding
`Number.isInteger(v)`, rather than needing to re-touch both branches again.)
