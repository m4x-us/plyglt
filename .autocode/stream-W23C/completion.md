CLOSED: #482
NOT_CLOSED: none

## Task #482 — entitlementCrossTabSync async-reject branch reachability (F009)

This was an investigation-and-decide task. Verified the finding's claim directly against
the actual installed dependency rather than trusting the audit description:

**Investigation:**
- Only one zustand version is installed (`5.0.14`, confirmed via `node_modules/zustand/package.json`
  and `package-lock.json` — no version drift to account for).
- Traced `node_modules/zustand/esm/middleware.mjs`'s `hydrate()` directly: its promise
  chain always terminates in `.then(...).catch((e) => { ...; postRehydrationCallback?.(void 0, e); })`
  — this final `.catch` never rethrows, unconditionally.
- Confirmed via grep that none of `store/entitlementStore.ts`, `store/srsStore.ts`, or
  `store/settingsStore.ts` registers an `onRehydrateStorage` option, so
  `postRehydrationCallback` is always `undefined` and the optional-chained call is always
  a no-op.
- Also traced `toThenable()` (the helper wrapping `storage.getItem`) and confirmed
  `lib/storage.ts`'s `getItem` is declared `async`, so it always returns a genuine native
  `Promise` — meaning `entitlementCrossTabSync.ts`'s `result instanceof Promise` check
  does enter the async branch in production; it's specifically the *rejection* callback
  within that branch that's unreachable, exactly as the finding states.
- **Conclusion: `persist.rehydrate()` cannot genuinely reject under this app's real
  configuration.** The one caveat found during the trace (not raised by the original
  finding): if a *future* `onRehydrateStorage` callback were added AND it itself threw
  when invoked from inside zustand's own `.catch` handler, that WOULD produce a genuine
  rejection (nothing catches a throw from inside that handler) — this is the concrete
  scenario that keeps the branch non-dead-code going forward.

**Resolution chosen:** kept the branch (it's genuinely defensive against future config
changes and against reuse of this module — its `rehydrate` parameter is generically typed
`() => unknown`, not Zustand-specific, per the module's own header). Did NOT change the
existing synthetic-Promise unit tests (Task #304/#347/#363/#474) — they correctly test
`createCrossTabSync`'s own contract given any Promise-returning function, which is the
right scope for a unit test of a generic, reusable primitive; that scope was never wrong.

**What actually changed:**
1. Added a substantial doc-comment block to `store/entitlementCrossTabSync.ts`'s header
   explaining precisely why the async-reject branch is defensive-only today (with the
   concrete future-onRehydrateStorage-throw scenario as the reason it's kept), so a future
   reader understands this without re-deriving it.
2. Added a new, durable regression test to `tests/entitlementCrossTabSync.test.ts` that
   exercises the REAL zustand `persist`/`createJSONStorage` (not a mock) with a storage
   whose `getItem` genuinely rejects and no `onRehydrateStorage` configured — mirroring
   every real store in this app — and asserts `persist.rehydrate()` still resolves. This
   turns the investigation's conclusion into a live guard: if a future zustand upgrade
   changes `hydrate()`'s internal error handling, this test fails and flags that the
   async-reject branch's importance needs re-evaluating.

Verification: `npx tsc --noEmit` clean (two confirmed unrelated pre-existing/concurrent
errors in off-limits files from other windows, unchanged, not touched). ESLint clean.
`tests/entitlementCrossTabSync.test.ts`: 12/12 passing (11 existing + 1 new). No banned
pseudocode assertions added.

Debt entries logged: 0
Carry-forward tasks generated: 0
