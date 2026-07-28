CLOSED: #413 #427
NOT_CLOSED: none

## Task #413 — specialtyPackLoader fresh-download hash-mismatch test coverage (F010)

Added a new `describe("specialty pack — fresh-download and cache-hit integrity branches
(#413)")` block to `tests/specialtyPackLoader.test.ts` with two tests:
1. **Required by acceptance criteria**: a genuine first-time download (no cache present)
   whose bytes don't match the manifest sha256 is rejected as `checksum_mismatch` —
   distinct from every existing `#410` test, which all start from a tampered/stale
   *cached* entry and never reach the fresh-download verification branch. Also asserts
   nothing gets persisted to storage on rejection.
2. A cached copy that passes sha256 verification but fails `hasValidUnitsArray` shape
   validation (simulating a genuinely malformed pack published under a correct hash) is
   evicted and falls through to a fresh download attempt — this closes the literal line
   257 the audit finding cited (`if (result.ok) return result` false branch), which is
   still at that exact line in the current file.

**On the finding's other cited lines (318, 359):** the file has grown substantially since
the audit ran (Tasks #405/#409/#410 added ~90 lines of guards and comments), so those
line numbers no longer point at the same code. Line 318 in the current file's fresh-
download sha256Hex-throw catch block is already covered by two existing tests in
`tests/packLoader.test.ts` (`#405: sha256Hex throwing during fresh add-on download
verification...` and the cached-copy sibling) — same module, different file, so project-
wide coverage already includes it; not re-duplicated here. Line 359 now falls inside a
JSDoc comment block (not executable code) — unmappable to the original finding.

Coverage on `lib/specialtyPackLoader.ts` scoped to this test file alone rose from
71.05%/71.42%/71.69% (stmts/branch/lines) to closing the two `_doLoad`-branch gaps
targeted above; the remaining uncovered lines are `loadSpecialtyPack`'s outer entry
guards (already exercised via `tests/packLoader.test.ts`, a sibling file) and a few
narrow storage-write-failure/offline catch paths not cited by F010. Not gate-blocking
per the task's own framing — full-suite coverage already clears thresholds.

**Fixture fix required first:** `fakeAddOnPack()` (this file, mine) had `unitCount: 5,
cardCount: 50, units: []` — a pre-existing inconsistency that a concurrent, unrelated
task (#418, `lib/packTypes.ts`, another window) turned into a real failure by making
`hasValidUnitsArray` cross-check `unitCount`/`cardCount` against the real array lengths.
Rebuilt the fixture with 5 real units × 10 real cards so it's genuinely valid — this was
necessary just to get the pre-existing suite green again, not part of #413's own scope,
but done in-file since I own this test file.

## Task #427 — parseFlag safe-off default for specialtyPacks (F028)

`parseFlag` previously defaulted every flag to `true` when its env var was unset. Per the
acceptance criteria's explicit instruction, I checked every flag consumer before changing
anything:
- `interruptEngine` — `components/InterruptHandler.tsx`, a live/shipped feature.
- `analytics` — `app/stats/page.tsx`, a live/shipped feature (real Stats page, Pro-gated).
- `vacationMode` — no current consumer.
- `specialtyPacks` — `components/LanguageGrid.tsx` / `store/entitlementStore.ts`'s
  `purchaseAddOn`, gating specialty packs — genuinely unfinished (BRAND.md roadmap; the
  only registered entry, `it-medical`, is `ready:false`).

Changed `parseFlag` to take a `defaultEnabled: boolean` parameter instead of a hardcoded
`true`, and set per-flag defaults in `getFeatureFlags()`: `interruptEngine`/`vacationMode`/
`analytics` stay default-`true` (unchanged behavior for shipped features), `specialtyPacks`
is now default-`false`. This is the per-flag-parameter approach the acceptance criteria
suggested as the likely-needed fix, not a blanket default change.

Added 3 tests to `tests/featureFlags.test.ts` (specialtyPacks defaults false when unset,
true when explicitly set truthy, false when explicitly "false"), plus a `specialtyPacks`
field to the existing "all fields are booleans" test and the env-var cleanup in `afterEach`.

**Real regression caught and fixed:** `components/LanguageGrid.test.tsx` (not granted to
me this wave, not off-limits either — ungranted territory) had 6 tests in its
"specialty packs (Task #150)" describe block that rendered Add-ons tiles without
explicitly stubbing `NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS`, implicitly relying on the old
default-true behavior. This is exactly the failure mode the acceptance criteria's third
bullet warned about. I added a `beforeEach` inside that describe block stubbing the flag
to `"true"` (the two tests that specifically test flag-off behavior, `#403` and `#276`,
already re-stub `"false"` themselves and are unaffected) — a minimal, mechanical fix that
restores those tests' actual intent (Add-ons visibility given ready/purchased state, not
the flag's default) without weakening the #427 security fix. Left a comment explaining
why the stub exists.

**Known follow-up, NOT fixed (file off-limits):** `store/entitlementStore.ts:329`'s
comment says "`getFeatureFlags().specialtyPacks` defaults to true when the env var is
unset" — now stale/inaccurate. That file is explicitly off-limits to this stream; flagging
for whoever owns it next to update the comment (no behavior there needs to change — the
`purchaseAddOn` Pro-gate logic is correct either way).

Verification: `npx tsc --noEmit` clean. `npx eslint` clean on all touched files. Combined
run of `tests/specialtyPackLoader.test.ts` + `tests/featureFlags.test.ts` +
`components/LanguageGrid.test.tsx` + `app/stats/page.test.tsx`: 59/59 passing. No banned
pseudocode assertions added.

Debt entries logged: 1 (stale comment in store/entitlementStore.ts, noted above — not
logged to a formal debt file since I don't own that file this wave; flagging here for the
next owner)
Carry-forward tasks generated: 0
