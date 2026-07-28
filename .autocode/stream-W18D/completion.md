CLOSED: #441 #419 #425
NOT_CLOSED: none

## #441 — isSpecialtyPackCode naming: documentation over rename

Read `lib/langRegistry.ts` first per the brief's context update. Confirmed Task #407
(Wave 17) already split the predicate — `isRegisteredSpecialtyCode` (registration-only)
now exists alongside `isSpecialtyPackCode` (registered AND ready), and
`isSpecialtyPackCode`'s doc comment already said "registered AND ready" (that correction
also landed in Wave 17, committed in `7f34be6`). The only real gap left: nothing on
`isSpecialtyPackCode` itself pointed callers who need registration-only semantics (e.g. a
persisted/restored code that must survive `ready` flipping back to false, Task #384's
policy) at the sibling function — that pointer only existed in the reverse direction, on
`isRegisteredSpecialtyCode`'s own comment.

**Decision: documentation, not a rename.** Reasoning:
- `isRegisteredSpecialtyCode` already exists as the registration-only half — the "split
  into a registration-only predicate plus a readiness check" acceptance criterion is
  already satisfied structurally.
- A rename to `isReadySpecialtyPackCode` would revive the exact name Task #380 deleted
  for being a redundant alias — the brief explicitly warned against this without stronger
  justification, and I found none: the current split (two purpose-named functions) is
  clearer than one function with a longer, more accurate name.
- Renaming `isSpecialtyPackCode` itself would touch call sites across
  `hooks/useLangPack.ts`, `lib/packLoader.ts`, `store/entitlementStore.ts` (purchaseAddOn
  gate) — several of which are off-limits to this stream, making a rename impractical
  within scope anyway.

Added one paragraph to `isSpecialtyPackCode`'s doc comment (lib/langRegistry.ts:107-117)
stating explicitly that it is NOT a registration-only check despite the name, and
pointing to `isRegisteredSpecialtyCode` for callers that need the survives-ready-flip
semantics. `tests/langRegistry.test.ts` (20 tests) unaffected — doc-only change.

## #419 — isKnownCode recovery path for ready-but-unpurchased specialty codes

**The fix (hooks/useLangPack.ts):** the render body now computes
`unpurchasedSpecialty = isSpecialtyPackCode(rawTargetLang) && !hasAddOn({purchasedAddOns}, rawTargetLang)`
and redirects `targetLang` to that specialty's own `baseLang` (not a hardcoded "it") when
true — before ever attempting the doomed network/static load. The existing #339 repair
effect was generalized from `if (!isKnownCode)` to `if (rawTargetLang !== targetLang)` so
it persists BOTH repair cases (unknown/unready code → "it"; unpurchased specialty →
its baseLang) through the same effect, logging a distinct `ERR-LANGPACK-ADDON-UNOWNED`
code for the new case.

**Design iteration worth recording:** my first attempt tried the opposite approach —
leaving the render-body redirect out and instead self-healing LANG_PAIR_KEY only AFTER a
failed load, inside the "Add-on not purchased." branch. That broke on a subtle
architecture fact: this hook reads `getTargetLangCode()` fresh from localStorage on every
render (not from React state), so any `setTargetLangCode()` call inside a `.then()` that
also calls `setState()` triggers an immediate re-render that re-derives `targetLang` from
the JUST-repaired storage — collapsing the "show the error once, self-heal for next time"
window to zero and cascading into a different final state than intended. The render-body
redirect (applied before any load is attempted) avoids this entirely and is what shipped.

**Test suite consequences (hooks/useLangPack.test.ts):** the `#378 — specialty pack
target...` describe block's tests exercise the two-step base-then-specialty resolution
MECHANICS using two mocked specialty codes (`it-legal`, `es-business`) but never seeded
`purchasedAddOns` — irrelevant before #419, since the hook didn't consult it upstream.
With the fix live, those tests would have redirected every specialty code straight to its
base language before ever exercising the two-step chain. Fixed by seeding both codes as
purchased in this block's `beforeEach` (kept in a comment as the isolation rationale), and
rewriting the ONE test that was specifically about the un-owned case — previously named
"does not repair LANG_PAIR_KEY for a READY-but-unentitled specialty code (stranded-code
pin, see stream debt)" and explicitly documenting the gap #419 closes — into a test
proving the NEW recovery: redirect, self-healed storage, successful base-language load,
`error: null`.

The two `clearEntitlement`-based eviction-generation tests needed an additional fix:
`clearEntitlement()` itself wipes `purchasedAddOns` (that's what deactivating a license
means), which the render-body redirect correctly reacts to — self-healing LANG_PAIR_KEY
to the base code mid-test. Since that permanently overwrites the persisted specialty code,
merely re-seeding `purchasedAddOns` afterward wasn't enough to resume the two-step chain;
each test now also restores `LANG_PAIR_KEY` to the specialty code (simulating a user
re-selecting the add-on in the UI) before re-seeding ownership — exactly the two
preconditions a real user would have after re-purchasing and re-selecting. Verified the
resulting call counts empirically (temporary debug logging, removed before this landed)
rather than hand-deriving them, since the intermediate render sequence through
`clearEntitlement`'s two internal `set()` calls is non-obvious: final counts are 5 (not 6)
and 2 loadPack + 3 seedMemCache (not 3 + 3) respectively — both now assert the ACTUAL
deterministic sequence with an explanatory comment.

`hooks/useLangPackSeam.test.ts` (not in this stream's owned-files list, but broken by this
change and not owned by any other Wave 18 stream) needed the same treatment: its
"unpurchased specialty target" test asserted the old permanent "Add-on not purchased."
outcome through the REAL (unmocked) loader stack; updated to assert the new redirect
outcome (`error: null`, `LANG_PAIR_KEY` self-healed to "en-it").

## #425 — getLanguageConfig hyphenated-fallback signal

Chose to correct the doc comment (not strengthen the signal) — strengthening would require
resolving the documented circular-import constraint (`lib/langRegistry.ts` imports
`ITALIAN`/`SPANISH` from `lib/language.ts`, so `lib/language.ts` can't import
`SPECIALTY_PACKS` back to validate), which is out of scope for a documentation-trust
finding. Rewrote `getLanguageConfig`'s doc comment (lib/language.ts) to explicitly name
the two fallback branches and their different strengths: the no-hyphen/unrecognized-prefix
branch is the strong signal (console.error + ITALIAN) the original comment described;
the hyphenated-valid-prefix branch is weak by construction (console.warn + silent
success) and cannot distinguish a real specialty code from a typo'd one — pointed callers
needing that distinction at `isSpecialtyPackCode`/`isRegisteredSpecialtyCode`.

Added the explicit test the acceptance criteria asked for: `getLanguageConfig("it-typo")`
returns `ITALIAN`, logs `warn` (not `error`), identical to the real `"it-medical"` case —
pinning that the doc's now-corrected claim stays true.

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` (full suite) — 62 files, 1344 tests, all passed.
- `npx vitest run --coverage` — thresholds (lines 84/funcs 79/branches 81/stmts 82) all
  exceeded (92.35/89.4/85.38/89.93 actual).
- `npm run lint` — zero errors (3 pre-existing warnings, none in files this stream
  substantively changed — one new intentional `_purchasedAddOns`-style unused-var warning
  was already present from a prior stream's `hooks/useExportImport.ts` work, unrelated to
  this stream).
- Existence-only-assertion grep gate — clean across all files touched.

Debt entries logged: 0
Carry-forward tasks generated: 0
