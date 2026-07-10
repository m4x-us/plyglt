# Charles — W10C — Completion Summary

**Wave:** 10
**Stream:** W10C
**Date:** 2026-07-10

## Tasks Closed

- **#283** — Fix tests: LanguageGrid specialty-pack tests now drive the real entitlementStore.

  **What changed in `components/LanguageGrid.test.tsx`:**
  - Expanded the `vi.mock("@/lib/langRegistry", ...)` factory to include `FREE_PACK_CODES`,
    `ALL_PACK_CODES`, `READY_PACK_CODES`, `isSpecialtyPackCode`, `isReadySpecialtyPackCode`,
    `isValidPackCode`, and `getSpecialtyPacks` — required so `useEntitlementStore` can
    initialise its state from the mock without errors.
  - Added `import { useEntitlementStore } from "@/store/entitlementStore"`.
  - Changed `renderGrid` to remove its `hasAddOn` parameter: it now always passes
    `(code) => useEntitlementStore.getState().hasAddOn(code)` to the component — the real
    store is the only source of truth.
  - `beforeEach` now calls `useEntitlementStore.setState({ purchasedAddOns: [] })` to reset
    store state between tests.
  - State 2 (purchased+ready) and State 7 (#278, purchased add-on with locked base language)
    now call `useEntitlementStore.setState({ purchasedAddOns: ["it-medical"] })` before
    rendering to set up real store state instead of passing a manually crafted callback.
  - All other specialty-pack tests rely on the `purchasedAddOns: []` reset from beforeEach —
    `hasAddOn` returns false naturally, identical to the prior behavior.

  **Why this matters:** Previously, `(code) => code === "it-medical"` was a directly-controlled
  mock callback that would pass even if the entitlement store's `hasAddOn` action was deleted.
  Now the test fails if the store's `purchasedAddOns` state does not flow correctly into the
  `hasAddOn` callback passed to the component.

## Tasks NOT Completed

None.

## Verification Gate

- `npx tsc --noEmit` — 0 errors
- `npm test` — 1115 passed (54 test files)
- `npm run lint` — 0 errors (1 pre-existing warning in hooks/useExportImport.test.ts)
- Assertion quality gate — clean

## Debt Entries Logged

0

## Carry-Forward Tasks Generated

0
