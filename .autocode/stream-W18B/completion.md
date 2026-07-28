CLOSED: #438 #412 #423
NOT_CLOSED: none

## #438 — clearEntitlement flipped entitlement state before eviction completed

Reordered `clearEntitlement`: the state-reset `set({licenseKey:null, ...})` now runs
inside the same `.then()` callback as `resetSpecialtyLoadState()` and the
`_cacheEvictionGeneration` bump — i.e. only after the full `Promise.all(...evictPack...)`
eviction has settled — instead of running as the first two statements in the function
body, before eviction even started. Chose the "await eviction before the state flip"
option explicitly named in the acceptance criteria over the "documented acceptable
window" fallback, because the real cost was near-zero: the only production caller
(`hooks/useLicenseActivation.ts:handleDeactivate`) already awaits the full returned
Promise before updating its own UI, so the reorder changes nothing observable there. A
reactive subscriber elsewhere now sees `licenseType` flip a beat later (bounded by
eviction's I/O duration) instead of a beat earlier than the cache is actually clean —
the safer direction to be wrong in, and now correct either way.

Test: `tests/entitlement.test.ts` — calls `clearEntitlement()` without awaiting, checks
synchronously that `licenseType`/`licenseKey`/`unlockedPacks` are still the
pre-deactivation values (eviction hasn't settled yet — `clearEntitlement`'s own function
body has no `await`, so control returns to the caller before any `.then()` callback can
run), then awaits and confirms both state and `memCache` are cleared together. No
artificial delay needed — this is deterministic by construction. Also fixed a stale
comment in the existing `#415` test ("set() runs synchronously before eviction" — no
longer true) and the `clearEntitlement` idempotency comment at the top of the function.

## #412 — store/entitlementStore.ts was over the 400-line service cap

Extracted `purchaseAddOn` (implementation, `ERR_ADDON_*` constants, `PurchaseAddOnResult`
type, `RECEIPT_TOKEN_MAX_LENGTH`/`RECEIPT_TOKEN_PATTERN`) into a new sibling module,
`store/entitlementAddOns.ts`, mirroring the `lib/packLoader.ts` → `lib/basePackLoader.ts`
pattern named in the task. `createPurchaseAddOn(set, get)` takes narrow parameter
interfaces (`{licenseType, validUntil}` for get, `{purchasedAddOns}` for the set
updater) rather than importing `EntitlementState` from `entitlementStore.ts` — the real
Zustand `set`/`get` structurally satisfy these narrower types via TypeScript's normal
function-parameter contravariance, so the two modules have zero circular dependency (not
even a type-only one). `entitlementStore.ts` re-exports `ERR_ADDON_*` and
`PurchaseAddOnResult` so all existing external imports (`tests/entitlement.test.ts`,
`tests/purchaseAddOnGuards.test.ts`) keep working with zero changes on their end.

Result: `store/entitlementStore.ts` 397 lines (was 487), `store/entitlementAddOns.ts` 157
lines — both comfortably under the cap. Updated CLAUDE.md's Entitlement Model section
with one paragraph describing the new module's role (the brief explicitly permitted this
minimal, different-section edit despite CLAUDE.md's off-limits note for Adam's
concurrent #428 work).

All existing tests pass unchanged (no test needed updating for the extraction itself —
only #438's behavioral change required test updates, covered above).

## #423 — license-key length check hardcoded instead of a named constant

Added `export const LICENSE_KEY_MAX_LENGTH = 200` (+ a named `LICENSE_KEY_PATTERN`) to
`hooks/useLicenseActivation.ts`, replacing the inline `200` and inline regex at the
manual-entry validation call site. Cross-referenced in both directions with
`store/entitlementAddOns.ts`'s `RECEIPT_TOKEN_MAX_LENGTH` (validates the parallel
receipt-token input) — not merged into one shared import, since that would require
`lib/importBackup.ts` (a `lib/` file, checked below) to import from `hooks/`, an upward
layer-violating import; the three sites explicitly cross-reference each other in comments
instead. Added two boundary tests to `hooks/useLicenseActivation.test.ts` pinning the
exact constant value (200 chars accepted, 201 rejected) — the pre-existing test used a
hardcoded `"A".repeat(300)`, unrelated to the actual 200-char boundary.

**Follow-up flagged, not filed as a new task (per the brief's explicit instruction)**:
`lib/importBackup.ts:46`'s `LICENSE_FIELD_MAX_LENGTH = 200` was deliberately duplicated
by Task #424 with a comment noting "duplicated here deliberately... keep in sync until
#423 lands." #423 has now landed, but `lib/importBackup.ts` is off-limits to me this wave
— I did not edit it. Whoever owns that file next should decide whether to import
`LICENSE_KEY_MAX_LENGTH` from `hooks/useLicenseActivation.ts` there (same
layer-violation concern as above — `lib/` importing from `hooks/` — so this may turn out
to require relocating the constant to a `lib/` module both sides can import from, rather
than a straight import) and update `lib/importBackup.ts`'s comment accordingly.

## Cross-stream impact — flagging clearly, did not fix myself

`hooks/useLangPack.test.ts` (owned by Derek, W18D, explicitly off-limits to me,
actively in-progress this wave) has a test — "re-seeds and re-loads a static-base
specialty pack after clearEntitlement bumps the eviction generation" — whose own
docstring says: *"clearEntitlement triggers TWO re-renders (the synchronous
entitlement-field reset... then the post-eviction generation bump lands) — 1 initial + 2
re-runs = 3 each."* This docstring is literally describing the #438 bug (a two-phase,
non-atomic state update) as the test's own correctness assumption. After #438, the
state-reset and the generation-bump `set()` calls happen together in the same `.then()`
callback tick, not at two separate times — the exact call-count this test hardcodes
(`toHaveBeenCalledTimes(3)`) needs re-deriving once Derek's own concurrent #419 work on
`isKnownCode` (which also affects this same test's earlier assertions, per an isolated
re-run showing a *different*, earlier failure than the full-suite run) has landed and
stabilized. I confirmed via direct code inspection (not by editing the file) that this
is a real, expected consequence of #438's correctness fix, not a false positive — I did
not touch this file since it's actively owned by another live window.

My own owned scope (`store/entitlementStore.ts`, `store/entitlementAddOns.ts` (new),
`hooks/useLicenseActivation.ts`, `tests/entitlement.test.ts`,
`hooks/useLicenseActivation.test.ts`, plus the minimal CLAUDE.md addition) is fully
green: `tsc --noEmit` clean, `npm run lint` 0 errors, and every test file in my scope
(156 tests across 5 files) passes.

Debt entries logged: 0
Carry-forward tasks generated: 0 — both cross-stream flags above (lib/importBackup.ts's
LICENSE_FIELD_MAX_LENGTH, hooks/useLangPack.test.ts's render-count assertion) are
mechanical follow-ups for the respective file owners, not independent new findings.
