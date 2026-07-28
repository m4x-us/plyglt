CLOSED: #456 #458 #459
NOT_CLOSED: none

## Task #456 — stale security.md/generationGuard.ts citations (F2/F11)

Documentation only, no behavior change. Verified current line numbers myself rather than
trusting the brief's quoted ones (per the brief's own warning):
- `store/entitlementAddOns.ts`'s `isSpecialtyPackCode(code)` guard is at line **127**
  (brief's context said 96 — the security.md file itself already said 96, both stale;
  corrected to 127).
- `lib/specialtyPackLoader.ts`'s `createGenerationGuard()` call is at line **68** (matches
  brief). The two `isStale(entryGeneration)` checks that used to live at lines 122/177 have
  moved entirely to `lib/specialtyPackMerge.ts:64` and `:119` (Task #447's extraction) —
  updated security.md's S3 note to cite the new file and lines, and to mention #447.
- `lib/generationGuard.ts`'s header claimed `specialtyPackLoader.ts` adoption was "tracked
  as a carry-forward" — false; updated to list all three real current consumers
  (`basePackLoader.ts`, `specialtyPackLoader.ts`/`specialtyPackMerge.ts`,
  `entitlementAddOns.ts`) and state the adoption is complete.

## Task #458 — useLangPack hydration-timeout residual bug (F4, P1)

Root cause: Task #442 gated `unpurchasedSpecialty`'s computation on
`(entitlementHydrated || hydrationGraceExpired)`, which correctly prevented a false-positive
during ORDINARY slow hydration (self-corrects if real data arrives before the grace timer
fires). But once `hydrationGraceExpired` genuinely fires — because hydration is slow OR
because it never resolves at all (e.g. `storage.getItem` rejects forever, an existing
documented failure mode) — the repair effect unconditionally called `setTargetLangCode(targetLang)`,
permanently overwriting a genuinely-owned specialty code in `localStorage` based on
`purchasedAddOns` still reading its pre-hydration default (`[]`). The existing code comment
even already articulated this exact risk ("a grace-expired read is a fallback to store
defaults, not confirmed data") without the code actually acting on it.

Fix: the `unpurchasedSpecialty` branch of the repair effect now only calls
`setTargetLangCode` when `entitlementHydrated` is true (a confirmed read). When it's false
(grace-expired fallback), the in-memory `targetLang` still falls back to the base language
for that render/session (so the UI never hangs on a doomed specialty request), but nothing
is written to storage — logged under a new `ERR-LANGPACK-ADDON-UNCONFIRMED` ref-ID instead
of the misleading `ERR-LANGPACK-ADDON-UNOWNED`. The unrelated "unrecognised/corrupt code"
branch (not an entitlement-confidence question) still persists unconditionally, unchanged.

Added one test to `hooks/useLangPack.test.ts` (file not explicitly granted or off-limits
this wave — added since the fix's home file, `hooks/useLangPack.ts`, is owned by me and the
acceptance criteria requires a test) forcing hydration that never resolves (not merely
slow, unlike the sibling `#442`/"self-heals after a late hydration" tests already in that
file) and asserting `localStorage` is never overwritten, even after advancing fake timers
far past the grace period. Manually ran the Deletion Test: reverting the `!entitlementHydrated`
guard makes the new test fail (the unconfirmed-log assertion fails first, then the persist
assertion would too) — confirmed, then restored.

## Task #459 — validatePack.ts sync with hasValidUnitsArray (F5, P1)

Read `lib/packTypes.ts`'s `hasValidUnitsArray` directly (read-only reference, not owned)
and confirmed both named divergences:
1. `validateCard` had no counterpart for `card.prerequisites` (optional, but when present
   must be an array of strings) — added the identical check, rejecting a truthy non-array
   value like `"c0"` that would otherwise pass CI and crash `lib/srs.ts`'s unguarded
   `.every()` at runtime.
2. `validatePack` never validated `unitCount`/`cardCount` against the real array lengths —
   added both cross-checks (declared `unitCount` must equal `units.length`; declared
   `cardCount` must equal the real total cards summed across all units), matching
   `hasValidUnitsArray`'s exact logic.

To satisfy the acceptance criteria's regression-test requirement, exported
`validateCard`/`validateUnit`/`validatePack` (previously module-private) and gated the
CLI-executing bottom section behind an `isMainModule` check
(`import.meta.url === pathToFileURL(process.argv[1]).href`) so the file can be imported
by a test without its `process.exit()` calls firing. This is a mechanical prerequisite for
testability, not a functional change to the CLI itself — verified the real CLI still works
unchanged against both shipped pack files (`public/packs/it.json` — 63 units/3680 cards,
`public/packs/es.json` — 12 units/593 cards — both pass).

Created `tests/validatePack.test.ts` (no prior test file existed for `scripts/`) with 14
tests covering both divergences plus a sanity check on the unchanged `validateUnit`. Ran
the Deletion Test for both new checks by temporarily disabling each (`if (false)` guard),
confirming the relevant tests fail, then restored — confirmed clean.

## Notes on this wave's shared-repo environment

Encountered two pre-existing/concurrent TypeScript errors from other windows' in-flight,
off-limits work during `npx tsc --noEmit` runs: a type mismatch in the untracked
`tests/specialtyPackMerge.test.ts` (Task #447, another stream) and a missing
`fetchWithTimeout` reference in `lib/specialtyPackLoader.ts` (also off-limits, mid-edit).
Confirmed both are unrelated to anything in this stream's scope via `git status` and by
not having touched either file; left untouched.

Verification: `npx tsc --noEmit` clean on all 4 owned files (ignoring the two confirmed
unrelated off-limits errors above). ESLint clean. Combined run of
`hooks/useLangPack.test.ts` + `tests/validatePack.test.ts`: 53/53 passing. No banned
pseudocode assertions added. Both Deletion Tests (for #458 and #459) manually verified by
temporarily reverting each fix and confirming the new tests fail, then restoring.

Debt entries logged: 0
Carry-forward tasks generated: 0
