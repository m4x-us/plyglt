CLOSED: #479 #481 #483
NOT_CLOSED: none

All three tasks touch the exact same ~30-line `_version` validation block in `parseBackup`,
so I implemented them together in one coherent rewrite (per the brief's own sequencing
guidance) rather than three separate mechanical edits to the same lines, then verified each
one's specific acceptance criteria independently.

## Task #479 — isNaN vs isFinite in both _version branches

The string branch (Task #477, prior wave) used `!isNaN(parsedVersion)` — `Number("Infinity")
=== Infinity` and `isNaN(Infinity)` is `false`, so a string `_version:"Infinity"` reached the
newer-version branch and produced "backup vInfinity...update plyglt". Confirmed live (per the
brief's explicit request) that `isFinite()` alone is NOT sufficient either: `Number("0x10") ===
16`, which IS finite, so a hex string would silently coerce to a plausible-looking version
number. The actual fix needed a strict digits-only pattern (`/^\d+$/`) checked BEFORE any
numeric coercion — rejecting hex, exponential, and fractional strings by construction, not by
inspecting the coerced result — with `isFinite()` kept as defense in depth against an
absurdly long all-digit string overflowing to `Infinity` on coercion (e.g. 400 nines).

The sibling NUMERIC branch had the identical gap, undetected until this cycle: a raw
`_version: 1e400` in hand-edited JSON parses to `Infinity` (`typeof "number"`) via
`JSON.parse` itself, no string involved — `!data._version` alone only catches 0/NaN (both
falsy), not `±Infinity` (both truthy). Added `isFinite()` to that branch's guard too.

Verified live via `npx tsx`: ran all 11 scenarios from both tasks in one script (string
Infinity, JSON `1e400` literal, hex string, two fractional strings, numeric `-Infinity`,
boundary-equal/lower/higher strings, numeric higher/valid) before writing any test, then
re-ran after the fix to confirm every one now behaves as expected. Verified the Deletion
Test by hand for this task specifically: reverted just the isFinite/digit-pattern checks
back to the old `isNaN`-only logic, confirmed exactly the 5 new #479 tests fail, restored
from a backup copy.

## Task #481 — string-_version acceptance path

Weighed the two framings the audit gave: I judged the "real functional regression" framing
correct over "intentional design," since nothing about a string `"2"` vs a number `2` changes
what version is actually being claimed — rejecting one and accepting the other has no
principled justification, just an accident of which branch happened to check for it. Chose
the symmetric-acceptance option: a valid, non-newer numeric-looking string now falls through
into the exact same success path a numeric `_version` would, rather than the pre-#481 code
unconditionally returning the generic error after the newer-version check failed regardless
of whether the version was actually fine.

This directly reverses the behavior of an existing test from a prior wave ("#477: a
numeric-string _version that is NOT newer... still gets the generic message") — updated it
in place with the new expected behavior and a comment explaining why, rather than leaving a
stale test asserting the old, now-intentionally-wrong behavior. Added a second test for a
numeric string strictly LOWER than `CURRENT_BACKUP_VERSION` (not just the boundary-equal
case), per the acceptance criteria. Verified the Deletion Test by hand: reverted the
fall-through to an unconditional generic-error return, confirmed both new/updated tests fail,
restored from a backup copy.

## Task #483 — dedupe parseBackup message strings

Extracted `GENERIC_BACKUP_ERROR` (a constant) and `newerVersionError(version)` (a helper
function, since the message needs an interpolated value) near the file's other module-level
constants. Every one of the 3 (now-consolidated-to-1-literal) generic-error call sites and
2 (now-consolidated-to-1-template) newer-version call sites uses these. Confirmed via grep
that the literal message strings now appear exactly once each in the whole file (inside
their own constant/function definition). No behavior change — the full existing test suite
plus this stream's other 2 tasks' new tests all pass unmodified against the refactored code
(verified together since #479/#481 required rewriting the same lines anyway).

## Verification

Full gate green: `tsc --noEmit` clean, `npm test` 1437/1437 passing (whole repo), `npm run
lint` 0 errors (3 pre-existing warnings in files this stream doesn't own), coverage above
every threshold (stmts 89.81%, branches 85.83%, funcs 90.36%, lines 92.02%), Verification
Gate banned-assertion grep clean. No cross-stream instability hit this run.

Debt entries logged: 0
Carry-forward tasks generated: 0
