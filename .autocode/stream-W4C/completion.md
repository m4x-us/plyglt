# Stream W4C — Wave 4 Test Quality Fixes (#237 #238 #239)
**Date:** 2026-07-07
**Agent:** Charles
**Status:** COMPLETE
**Verification gate at close:** tsc=0 errors · 1011/1011 tests pass · lint=0 errors

## Tasks closed
- #237 — Fix commitSession atomicity test (tests/commitSession.test.ts)
- #238 — Fix useLangPack error-message enumeration omitting base_pack_not_loaded (tests/useLangPack.test.ts)
- #239 — Add packLoader stale-cache semantic-corruption test (tests/packLoader.test.ts + lib/packLoader.ts)

## What was done

### #237 — commitSession atomicity test

Rewrote "all three slices are consistent — no partial application" (was lines 36-47) to use the subscribe + snapshot-count pattern, mirroring `tests/seam_studyLoop.test.ts:93-129`.

**Old approach:** Called `commitSession`, read final state, asserted 4 values. Would pass identically if `commitSession` made 3 sequential `set()` calls instead of 1.

**New approach:** Subscribes to the store before calling `commitSession`, pushes a snapshot of `{reps, activeSession, streak}` on each store notification, then asserts `snapshots.length === 1`. Three sequential `set()` calls would produce 3 snapshots — the test catches the violation. The single snapshot is also checked for the expected values on all three slices.

New test name: `"commitSession is atomic — cards, activeSession, and streak update in a single store tick"`

### #238 — base_pack_not_loaded discriminant coverage

`RAW_DISCRIMINANTS` had 4 of 5 `LoadPackResult` error discriminants. `base_pack_not_loaded` was missing.

Added `"base_pack_not_loaded"` to `RAW_DISCRIMINANTS` and `base_pack_not_loaded: "Load the base language pack first."` to `EXPECTED_MESSAGES`. TypeScript's `Record<(typeof RAW_DISCRIMINANTS)[number], string>` type now enforces exhaustiveness — adding a 6th discriminant to `loadPackTypes.ts` will automatically break this test until `EXPECTED_MESSAGES` is updated.

All 5 discriminants now run through the 4-assertion describe loop (not-raw, exact-copy, no-exclamation, no-filler-words) → 20 tests total for the map.

### #239 — stale-cache semantic-corruption test + production fix

**Gap:** Both stale-cache fallback paths in `lib/packLoader.ts:210-235` did `JSON.parse(cachedData) as Pack` without shape validation. The happy-path download branch has `if (!Array.isArray(pack.units)) { return { ok: false, error: "parse_error" }; }` (line 257), but the two offline paths did not. A truncated cache write (plausible: the file's own atomic-write comment acknowledges this risk) with `units: "not-an-array"` would leak a malformed `Pack` as `ok:true`.

**Production fix (`lib/packLoader.ts`):** Added `if (!Array.isArray(pack.units)) { return { ok: false, error: "parse_error" }; }` immediately after `JSON.parse(cachedData)` in both stale-cache paths — the HTTP-error path (lines ~211-214) and the network-throws path (lines ~228-231). Consistent with the download path's existing check.

Note: `lib/packLoader.ts` is not in the off-limits list. The production fix was required by the Kaizen principle — the test reveals a real bug that must be fixed in the same commit, not logged as carry-forward.

**Test:** Added to `loadPack` describe block, immediately after the existing "serves stale cache when network is unavailable" test. Seeds cache with `{ ...fakePack(), units: "not-an-array" }` (syntactically valid JSON), version-mismatches the meta so the cache-hit branch is bypassed, makes fetch throw to force the stale-cache-fallback path, then asserts `result.ok === false` and `result.error === "parse_error"`. The test fails if the `!Array.isArray` guard is removed.

## Test count
- Before: 964 (start of session)
- After: 1011 (47 new tests across the session — #237 rewrote 1 existing test, #238 added 4 new tests for base_pack_not_loaded, #239 added 1 new test)

## Debt entries logged: 0
## Carry-forward tasks generated: 0
