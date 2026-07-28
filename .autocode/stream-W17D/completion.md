CLOSED: #426 #440
NOT_CLOSED: none

## #426 — non-empty purchasedAddOns preservation test

The two existing tests in `tests/seam_importRestore.test.ts` covering license restore
(`#391`/`#393`, lines 212-286) both start from `resetEntitlementState()`, which already
seeds `purchasedAddOns: []`. A `setEntitlement` implementation that explicitly reset
`purchasedAddOns` to `[]` as part of its own body (rather than correctly omitting it and
letting Zustand's shallow-merge `set()` leave the existing value untouched) would produce
the exact same observed `[]` and slip past both tests unnoticed.

Added `"preserves a non-empty purchasedAddOns across a license restore (#426)"`: seeds
`useEntitlementStore.setState({ purchasedAddOns: ["it-medical", "it-legal"] })`, restores a
backup containing a license (`licenseKey`/`instanceId` both present), and asserts the
seeded array survives unchanged.

**Deletion Test performed and reverted:** temporarily changed
`store/entitlementStore.ts`'s `setEntitlement` body to
`set({ ..., purchasedAddOns: [] })` (simulating the "full replace" the task describes),
ran the suite — the new test failed (`expected [] to deeply equal ["it-medical",
"it-legal"]`) while all 9 other tests in the file still passed, exactly matching the
task's Deletion Test prediction. Reverted the store change immediately after
confirming (store/entitlementStore.ts is off-limits for this stream; `git diff` confirms
the file now carries none of my edits — only other windows' concurrent, unrelated
changes to that file remain).

## #440 — purchasedAddOns exclusion enforced structurally

Previously the guarantee "an unsigned backup can never restore purchased add-ons" lived
only in `hooks/useExportImport.ts:readFile`'s choice of which five fields to name when
destructuring `result.entitlement` — a future call site spreading the object directly
(`setEntitlement({...result.entitlement, licenseKey, instanceId})`) would silently
reintroduce it, since TypeScript's excess-property check does not apply to object-literal
spreads (only to fresh literals), so such a call would type-check fine despite
`BackupEntitlement` carrying `purchasedAddOns`.

Added to `hooks/useExportImport.ts`:
- `export type RestorableEntitlement = Omit<BackupEntitlement, "purchasedAddOns">`
- `export function excludePurchasedAddOns(entitlement: BackupEntitlement):
  RestorableEntitlement` — strips the field via destructure-omit (`const {
  purchasedAddOns, ...restorable } = entitlement`), not a positive field allowlist, so it
  automatically covers any future field `BackupEntitlement` gains.

`readFile` now calls `excludePurchasedAddOns(result.entitlement)` once and spreads the
*result* (`{ ...restorableEntitlement, licenseKey, instanceId, lastValidated: 0 }`) into
`setEntitlement`. Because `restorableEntitlement`'s type structurally lacks
`purchasedAddOns`, spreading it can never reintroduce the field — the earlier loophole
(spreading the wide `BackupEntitlement` type directly) no longer has anywhere to enter
from at this call site.

Tests added:
- `hooks/useExportImport.test.ts` — `"#440: restoring a backup with a non-empty
  purchasedAddOns never passes it to setEntitlement"` (asserts the mock's call arg has
  neither a `purchasedAddOns` key nor any extra keys beyond the expected six), plus a new
  `describe("excludePurchasedAddOns (#440)")` block unit-testing the helper directly:
  strips the field, preserves every other field, and a simulated "naive full-spread of
  the return value" still lacks the key.

**Design note (kept in-scope):** left `store/entitlementStore.ts`'s existing
`setEntitlement` destructuring guard untouched (it's off-limits for this stream and
already correct — it independently drops any extra properties before calling Zustand's
`set()`). #440's fix adds a second, structural layer at the caller (defense in depth,
which is exactly what the audit finding asked for — not "solely one call site's
convention") without touching the off-limits file.

## Verification

- `npx tsc --noEmit` — zero errors (one transient error seen mid-run in the off-limits,
  concurrently-edited `tests/packTypes.test.ts` — a re-run moments later was clean,
  confirming it was a race with another window's file write, not a real error).
- Scoped run — `npx vitest run tests/seam_importRestore.test.ts hooks/useExportImport.test.ts
  tests/storage.test.ts tests/constants.test.ts` — 4 files, 47 tests, all passed.
- `npm run lint` — zero errors (3 warnings total: 2 pre-existing in untouched files, plus
  one new `_purchasedAddOns is assigned a value but never used` warning from the
  destructure-omit idiom in `excludePurchasedAddOns` — matches the existing
  underscore-prefix-for-intentionally-unused convention already present elsewhere in this
  codebase, e.g. `app/page.tsx`'s `_code`).
- Full-suite `npm test` currently shows failures, but every failing test file
  (`tests/importBackup.test.ts`, `tests/migrations.test.ts`, `tests/entitlement.test.ts`,
  `tests/packLoader.test.ts`, `tests/purchaseAddOnGuards.test.ts`) is a file this stream's
  brief lists as off-limits/owned by other windows (adam/barry/charles) that are actively
  editing `store/entitlementStore.ts`, `store/migrations.ts`, `lib/packLoader.ts`,
  `lib/importBackup.ts` concurrently — `git status` confirms all of those are modified,
  none by me. None of my touched files (`hooks/useExportImport.ts`,
  `hooks/useExportImport.test.ts`, `tests/seam_importRestore.test.ts`) appear anywhere in
  the failure list. This is expected transient parallel-wave state, not a regression from
  this stream's work.

Debt entries logged: 0
Carry-forward tasks generated: 0
