CLOSED: #474
NOT_CLOSED: none

## Task #474 — entitlementCrossTabSync async-reject silent swallow

`triggerRehydrate`'s async branch did `result.then(done, done)` — the rejection handler was
`done` itself, which resets `rehydrateInFlight` and re-triggers if a storage event queued
during the failed rehydrate, but never logged anything. Its sibling eight lines below (the
synchronous-throw branch) correctly logs via `console.error("[ERR-REHYDRATE-SYNC-THROW-...]",
err)` before calling `done()` — a direct AGENTS.md Rule 8 violation, since a `.then` rejection
handler is functionally this async path's catch block.

Fixed by giving the rejection handler its own function (instead of reusing `done` directly)
that logs `[ERR-REHYDRATE-ASYNC-REJECT-${Date.now()}]` with the rejection reason, then calls
`done()` — same ref-ID/message shape as the sync-throw sibling, so both failure modes of the
same call are equally diagnosable in production logs.

The existing test for this exact scenario ("a queued event during an in-flight rehydrate
that later REJECTS...") already set up an `errorSpy` but never asserted on it — literally
documenting the swallow instead of catching it, per the finding. Rewrote it to capture the
rejection reason in a named variable and assert `errorSpy` was called with both the ref-ID
substring and the exact rejection object, not just that `rehydrate`'s call count moved on
(the original passing assertion is exactly the kind of check that let this ship in the
first place — a call count is insensitive to whether the error path also logs).

Verified the Deletion Test by hand: reverted the fix back to bare `result.then(done, done)`,
re-ran the test in isolation, confirmed it fails with "Number of calls: 0" against the new
`errorSpy` assertion, then restored the file from a backup copy and re-verified all 11 tests
in the file pass again.

## Verification

Full gate green: `tsc --noEmit` clean, `npm test` 1428/1428 passing (whole repo), `npm run
lint` 0 errors (3 pre-existing warnings in files this stream doesn't own), coverage above
every threshold (stmts 89.79%, branches 85.77%, funcs 90.34%, lines 92%), Verification Gate
banned-assertion grep clean.

Hit the now-familiar cross-stream instability once, transiently: `tests/importBackup.test.ts`
(explicitly off-limits to this stream) failed on one assertion mid-run, expecting a more
specific "newer version" error message than the generic one Task #467 (a prior wave, also
mine) shipped for a non-number `_version`. Confirmed via `git stash` + isolated re-run at
HEAD (48/48 clean) that this is another window's in-progress refinement of that exact area
— `lib/importBackup.ts` and its test file both show real diffs this wave, unrelated to
anything in this stream. Re-ran the full suite a few seconds later and it passed clean
(1428/1428), consistent with the other window's edit settling mid-run.

Debt entries logged: 0
Carry-forward tasks generated: 0
