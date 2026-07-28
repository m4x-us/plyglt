CLOSED: #434 #435
NOT_CLOSED: none

## #434 — lib/constants.ts localStorage error handling

Wrapped all four `window.localStorage` call sites (`getTargetLangCode`, `setTargetLangCode`,
`getLangPair`, `hasStoredLangPair`) in try/catch. Each degrades gracefully on a throw:
logs a distinct `ERR-CONST-*` code (mirroring the file's existing `ERR-LANG-PAIR-MALFORMED`
convention) and returns the same safe default the function already used for the
`window === undefined` (SSR) branch — `"it"`, `"en-it"`, or `false`. No behavior change on
the happy path.

Added `describe("localStorage error handling (#434)")` to `tests/constants.test.ts` (not
in "Files You Own" but the pre-existing home for this module's tests; no other sensible
location existed) — a throwing `localStorage` mock verifies each function returns its
fallback and logs its specific error code instead of throwing.

## #435 — useIsHydrated failsafe/late-hydration race

**Design decision:** kept `useIsHydrated`'s signature and return type (`boolean`)
unchanged — no call site (`app/study/page.tsx`, `app/learn/page.tsx`,
`hooks/useLangPack.ts`) needed to change. Instead of exposing a new signal for consumers
to act on manually, the hook now performs the reconciliation itself, generically, using
only the existing Zustand store API (`getState`/`setState`/`subscribe`, all already present
on every real store hook — made optional on the `PersistApi<T>` type so old test doubles
that supply only `.persist` keep type-checking and get the pre-#435 behavior unchanged).

Mechanism: while waiting for hydration, the hook subscribes to the store and keeps a
rolling `previousState`/`currentState` pair (each state-change notification shifts the
window by one). When the failsafe fires, it snapshots `snapshotAtExpiry = getState()` and
registers a one-time `onFinishHydration` listener. Zustand persist's `hydrate()` always
calls `set()` (triggering our subscribe listener, updating `previousState` to the true
pre-merge live value) *before* invoking `onFinishHydration` listeners — so when a real,
late hydration eventually lands, our listener can compare:
- `preMerge` (state right before the merge) vs. `snapshotAtExpiry` (state when the app
  gave up waiting) → which fields did the user actually change during the window?
- `postMerge` (`getState()` after the merge) vs. `preMerge` → which of those user-changed
  fields did the merge overwrite?

Only fields satisfying *both* get restored via `setState(clobbered)`, logged as
`ERR-HYDRATION-LATE-MERGE`. This avoids the naive "diff pre/post state" trap: a field the
user never touched but that legitimately differs after a correct (if late) hydration —
e.g. a persisted setting loading in for the first time — is left alone rather than being
wrongly reverted to its pre-hydration default.

Rejected alternative: returning a richer signal (e.g. `{hydrated, source}`) and pushing
the reconciliation decision onto each call site. Rejected because it would have required
touching `app/study/page.tsx`, `app/learn/page.tsx`, and `hooks/useLangPack.ts` — none of
which are in this stream's "Files You Own" — and because the fix generalizes cleanly to
every persisted store without per-consumer logic.

Added three tests to `tests/storage.test.ts` under "late real-hydration merge
reconciliation (#435)", using a minimal but faithful fake store (`makeFullStore`) whose
`__simulateLateHydration` mirrors Zustand persist's actual `set()`-then-notify order:
1. A live write during the failsafe window survives a late merge that would have
   clobbered it, while an untouched field still takes the persisted value normally.
2. No reconciliation activity (or log) when the user made no writes.
3. No reconciliation activity when hydration finishes normally (no failsafe involved).

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` (full suite) — 62 files, 1285 tests, all passed.
- `npx vitest run --coverage` — thresholds (lines 84/funcs 79/branches 81/stmts 82) all
  exceeded (89.49/84.46/89.63/92.01 actual).
- `npm run lint` — zero errors (2 pre-existing warnings, unrelated files).
- Existence-only-assertion grep gate — clean.

Debt entries logged: 0
Carry-forward tasks generated: 0
