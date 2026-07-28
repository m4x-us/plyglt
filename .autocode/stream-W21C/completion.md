CLOSED: #470 #471
NOT_CLOSED: none

## Task #470 — generationGuard.ts sibling-doc contradiction (F04, Rule 23)

Documentation only, no behavior change. Fixed the two sibling files that still
contradicted Wave 20's corrected `lib/generationGuard.ts` header:
- `lib/basePackLoader.ts:78-79`: "that file's adoption is a tracked carry-forward" →
  "that file's adoption is complete (Task #394/#447/#456), not a carry-forward."
- `tests/generationGuard.test.ts:1-4`: rewrote the file-header comment to name all three
  real current consumers (basePackLoader, specialtyPackLoader, entitlementAddOns) and
  state the adoptions are complete, removing "via carry-forward" entirely.

Per the acceptance criteria's explicit instruction, grepped the whole repo for
"carry-forward" before closing. Remaining hits are: `lib/generationGuard.ts`'s own header
(already correct — states "none is a carry-forward"), `.autocode/agents/architect.md`
(an unrelated topic — lib/storage.ts's useIsHydrated race, not the GenerationGuard
adoption claim), and a set of `.autocode/` stream completion/task/brief logs and
`.autocode/agents/cto.md` audit entries — these are historical, immutable records of past
findings/decisions (correctly written in past tense), not living documentation making a
current-state claim, so they're not instances of this defect class and were left
untouched. No fourth code/test file makes the stale claim.

## Task #471 — TRUTHY_FLAG_VALUES "1" untested (F05, Rule 16 LIVE violation)

Confirmed the gap: `lib/featureFlags.ts`'s `TRUTHY_FLAG_VALUES = ["true", "1"]` (Task #462)
was never exercised with `"1"` in any test — only `"true"` was covered.

Added two tests to `tests/featureFlags.test.ts`:
1. `specialtyPacks` (default-OFF) with env `"1"` → `true`. This is the actually
   Deletion-Test-discriminating case: removing `"1"` from `TRUTHY_FLAG_VALUES` makes `"1"`
   fall through to `defaultEnabled=false`, and this test correctly fails.
2. `interruptEngine` (default-ON) with env `"1"` → `true`, satisfying the acceptance
   criteria's literal "for both a default-off and default-on flag" wording. Documented
   honestly in the test's own comment that this second assertion is NOT independently
   Deletion-Test-discriminating for the `"1"` entry specifically — a default-on flag's
   fallthrough default is already `true`, so removing `"1"` wouldn't break it (this is
   structurally unavoidable: an explicit truthy signal can only be behaviorally
   distinguished from "no signal, use default" when the default itself is false). It
   still guards against a different regression (e.g. `"1"` incorrectly resolving to
   `false` via a broken/reordered truthy check).

Verified the Deletion Test exactly as instructed: temporarily removed `"1"` from
`TRUTHY_FLAG_VALUES` in `lib/featureFlags.ts` (not an owned file this wave, but not
off-limits either — reverted immediately, `git diff` confirmed zero net change), reran
the test file, confirmed the `specialtyPacks` test failed (`expected false to be true`)
while the `interruptEngine` test — as predicted — still passed, then restored the fix and
reconfirmed all 28 tests green.

Verification: `npx tsc --noEmit` clean on owned files (two unrelated pre-existing/
concurrent errors in off-limits files — `tests/specialtyPackMerge.test.ts`,
`lib/specialtyPackLoader.ts` — confirmed via `git status` as other windows' in-flight
work, not touched). ESLint clean. Combined run of `tests/generationGuard.test.ts` +
`tests/featureFlags.test.ts`: 31/31 passing. No banned pseudocode assertions added.

Debt entries logged: 0
Carry-forward tasks generated: 0
