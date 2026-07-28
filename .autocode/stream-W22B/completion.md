CLOSED: #475
NOT_CLOSED: none

## #475 — fetchWithTimeout.test.ts's rewritten test proved only one of two timers

Task #472's rewrite proved `clearTimeout` was called with the backstop timer's id
(`setTimeoutSpy.mock.results[1]!.value`) but never captured or asserted anything about
the abort timer's id (`results[0]`), even though the same `finally` block clears both
one line apart. Added the missing capture and assertion:

```ts
const abortTimeoutId = setTimeoutSpy.mock.results[0]!.value;
const backstopTimeoutId = setTimeoutSpy.mock.results[1]!.value;
expect(clearTimeoutSpy).toHaveBeenCalledWith(abortTimeoutId);
expect(clearTimeoutSpy).toHaveBeenCalledWith(backstopTimeoutId);
```

Renamed the test ("clears BOTH the abort timer and the backstop's own timer...") and
extended its comment to record the #475 finding and its Deletion Test result, so the
next reader doesn't need to re-derive why both ids are asserted.

**Deletion Test performed exactly as the acceptance criteria specified**: temporarily
removed `clearTimeout(abortTimeoutId)` from `lib/fetchWithTimeout.ts`'s `finally` block,
ran the updated test — it failed as expected (`Number of calls: 1`, i.e. only the
backstop's clearTimeout call was observed), confirming the new assertion actually
exercises the line it claims to. Restored the file immediately after and re-verified all
6 tests pass again with `tsc --noEmit` clean.

`lib/fetchWithTimeout.ts` itself is unchanged in the final state — this task was a
test-only fix, and the brief's Files You Own list correctly scoped it that way (the
Deletion Test's temporary edit-and-restore was the one explicitly-instructed exception,
per the acceptance criteria).

Full verification gate: `tsc --noEmit` clean, `npm run lint` 0 errors (3 pre-existing
warnings in other streams' files), existence-check grep gate clean. `npm test` shows one
unrelated failure in `tests/importBackup.test.ts` — that file (and `lib/importBackup.ts`)
are explicitly off-limits to me this wave, owned by another concurrent window mid-edit;
confirmed my own scope (`tests/fetchWithTimeout.test.ts` plus its sibling pack-loader
suites) is 120/120 passing in isolation.

Debt entries logged: 0
Carry-forward tasks generated: 0
