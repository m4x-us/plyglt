CLOSED: #457 #463 #464 #465
NOT_CLOSED: none

## #457 — getLangPair duplicated getTargetLangCode's derivation logic

Extracted the shared `sepIdx`/`slice` derivation into one function, `deriveLangTail(pair)`,
in `lib/constants.ts`. Both `getTargetLangCode` and `getLangPair` now call it instead of
each carrying their own copy (which is what Task #446 left behind — byte-identical by
copy-paste, not shared). Corrected the overclaiming comment ("structurally impossible to
drift apart") to describe what #457 actually did, rather than what #446 alone achieved.
No behavior change — `tests/constants.test.ts`'s 11 tests pass unmodified.

## #463 — entitlementStore.ts (403 lines) and packLoader.ts (402 lines) over the cap

Two more narrow extractions, following the established pattern (parameter-typed /
closure-scoped state, no circular imports):

- **`store/entitlementCrossTabSync.ts`** (new, 97 lines): the `_rehydrateInFlight`/
  `_pendingRehydrate` dedup-and-queue logic for the browser `'storage'` cross-tab sync,
  extracted from `entitlementStore.ts`. Redesigned from module-scope `let` state to a
  `createCrossTabSync(storeKey, rehydrate)` factory returning closure-scoped state —
  mirrors `lib/generationGuard.ts`'s `createGenerationGuard()` shape exactly, so a second
  call (if this module is ever reused for another store) gets independent state instead
  of silently sharing flags with the first. `entitlementStore.ts`'s exported
  `_handleCrossTabStorageEvent` test hook keeps its exact name/signature, now delegating
  internally. `store/entitlementStore.ts`: 403 → 355 lines.

- **`lib/packManifest.ts`** (new, 103 lines): `fetchManifest`, `isValidManifestShape`,
  and their supporting constants, extracted from `lib/packLoader.ts` — self-contained,
  no dependency on `packLoader.ts`'s `inFlightBaseLoads` registry or any other
  module-private state there. `packLoader.ts` re-exports `fetchManifest` so its
  documented Public API surface is unchanged for callers (`hooks/useLangPack.ts` via
  `lib/packResolver.ts`). `lib/packLoader.ts`: 402 → 310 lines (before #464/#465's
  further reduction below).

No behavior change; `tests/entitlement.test.ts` (121 tests) and `tests/packLoader.test.ts`
(99 tests) pass unmodified.

## #464 + #465 — fetch timeout backstop and shared constant (done together)

Did these as one coherent change since both touch the identical 3 call sites (per the
brief's own suggested ordering, to avoid re-touching the same lines twice):

- **`lib/constants.ts`**: `FETCH_TIMEOUT_MS = 20_000` — the single source of truth,
  replacing 3 independent copies in `lib/basePackLoader.ts`, `lib/specialtyPackLoader.ts`,
  and the former `lib/packLoader.ts` (now `lib/packManifest.ts` after #463).
- **`lib/fetchWithTimeout.ts`** (new, 58 lines): `fetchWithTimeout(url, init)` — the one
  shared implementation. Bounds `fetch()` via TWO independent mechanisms: the existing
  `AbortController` (fast path — cancels the request for a conformant implementation) AND
  a `Promise.race` against a separate `setTimeout` that rejects on its own timer with no
  dependency on `fetch()` ever settling or ever checking the abort signal. All 3 original
  call sites (`lib/basePackLoader.ts`, `lib/specialtyPackLoader.ts`,
  `lib/packManifest.ts`) now call this instead of hand-rolling their own
  `AbortController`/`setTimeout`/local constant — net LOC reduction at each site as a
  side effect, which also helped keep them under the Rule 1 cap.

Test: `tests/fetchWithTimeout.test.ts` (new, 6 tests) — the acceptance-criteria test
mocks `fetch` to return a promise that never settles and never reads `init.signal` at
all (the pathological non-conformant case), advances fake timers by exactly
`FETCH_TIMEOUT_MS`, and asserts the call rejects with an `ERR-FETCH-TIMEOUT-BACKSTOP`
error within that bound. Verified against the Deletion Test: temporarily reverted
`fetchWithTimeout` to the AbortController-only implementation, confirmed that exact test
fails (times out at vitest's own 5s test timeout, with an unhandled-rejection log from
the backstop firing 20s later than the test could wait for), restored. Also added a
test pinning `FETCH_TIMEOUT_MS`'s exact value (20_000) and tests covering the
already-resolves-fine, real-network-error, and abort-signal-actually-passed paths, so
the new shared implementation has equivalent-or-better coverage than the 3 inline copies
it replaced (which had none).

## Full verification gate

`tsc --noEmit` clean. `npm test`: 1403/1403 passing repo-wide. `npm run lint`: 0 errors
(3 pre-existing warnings, all in files owned by other streams this wave). Coverage
thresholds unaffected (all new code is directly tested).

Debt entries logged: 0
Carry-forward tasks generated: 0

## Note for whoever next touches these files

`store/entitlementStore.ts` (355 lines) and `lib/packLoader.ts` (310 lines) both have
comfortable margin under 400 now, but this is the SECOND extraction pass each has needed
this batch (Wave 18/19 → Wave 20). If either creeps back over the cap a third time, it
may be worth asking whether the file's remaining responsibilities should be split along
a different seam entirely rather than doing another narrow slice.
