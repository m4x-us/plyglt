CLOSED: #469
NOT_CLOSED: none

## #469 — store/entitlementCrossTabSync.ts had no dedicated test file

Added `tests/entitlementCrossTabSync.test.ts` (11 tests), calling `createCrossTabSync`
directly with a fully-controllable fake `rehydrate` (a manually-resolved/rejected
Promise, not `mockResolvedValue`, so a test can observe state precisely while a
rehydrate is genuinely still in flight). Read both existing indirect-coverage files
first (`tests/entitlement.test.ts`'s `_handleCrossTabStorageEvent` describe block,
`tests/entitlementStoreEventWiring.test.ts`) and confirmed neither exercises anything
beyond basic key-matching with an always-immediately-resolved rehydrate — kept 3 sanity
tests for that (matching the existing coverage's shape, not duplicating its assertions)
and spent the rest of the file on the three genuinely-uncovered concurrency paths named
in the finding:

- **Task #304 (in-flight dedup)**: a second matching event while a rehydrate is pending
  does not start a second `rehydrate()` call.
- **Task #347 (requeue after settle)**: 4 tests — requeues exactly once when an event
  arrived during the in-flight window; does NOT requeue when none arrived (the paired
  negative case); collapses a burst of multiple events into exactly one requeue (proving
  `pendingRehydrate` is a flag, not a counter); and chains a further requeue when a new
  event arrives during the requeued call's own in-flight window (multi-hop, not just
  one level).
- **Task #363 (synchronous-throw recovery)**: 2 tests — `rehydrate()` throwing
  synchronously resets the in-flight flag so a subsequent event triggers a genuinely new
  call (not silently ignored, which is what "locking permanently" would look like); and a
  queued event during an in-flight call that later REJECTS (not throws) still gets its
  requeue attempt — this specifically exercises `result.then(done, done)`'s SECOND
  argument, since a hypothetical `result.then(done)` (missing the rejection handler)
  would leave `rehydrateInFlight` stuck true forever on any async rejection.
- **Bonus**: one test proving two `createCrossTabSync(...)` instances have fully
  independent dedup state (closure-scoped, not module-scope `let`) — a direct regression
  guard for the specific design decision made when this module was extracted (Wave 20,
  Task #463), verifying it actually holds rather than just asserting it in a comment.

Verified test rigor by tracing each assertion against the specific code branch it names
(the Deletion Test principle, AGENTS.md) rather than temporarily editing the module under
test — the brief explicitly scoped `store/entitlementCrossTabSync.ts` as read-only
reference, so I did not modify it even temporarily for verification, unlike my usual
practice on files I own. For each of the 11 tests I confirmed by inspection that deleting
the specific guard/behavior it targets (the dedup `if`, the requeue `if`, the catch
block's `done()` call, the `.then()`'s second argument, closure- vs. module-scope state)
would flip that exact test's assertion to fail — none are vacuous existence checks.

Coverage on `store/entitlementCrossTabSync.ts` from this file alone: 100% statements,
100% branches, 100% functions, 100% lines (up from the finding's cited 72.72%/62.5%
stmt/branch incidental coverage).

Full verification gate: `tsc --noEmit` clean, `npm test` 1418/1418 passing repo-wide,
`npm run lint` 0 errors (3 pre-existing warnings in other streams' files), existence-check
grep gate clean (no `.toBeDefined()`/`.toBeTruthy()`/etc. in the new file).

Debt entries logged: 0
Carry-forward tasks generated: 0
