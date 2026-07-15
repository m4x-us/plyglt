# Stream W13A — Completion Summary
# Adam | 2026-07-14

## Tasks closed (16/17)

#342 #343 #340 #364 #338 #351 #362 #363 #347 #336 #349 #356 #334 #339 #370 #371

## Tasks NOT completed (1/17)

**#357** — "purchaseAddOn has no check that licenseType === 'subscription'"

Root cause of deferral: `parseFlag(undefined)` returns `true` — all feature flags default ON
when the env var is unset. So `getFeatureFlags().specialtyPacks === true` in every
environment that doesn't explicitly set `NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS=false`. The
off-limits `tests/entitlement.test.ts` calls `purchaseAddOn` with `licenseType:"free"`
and does not mock `featureFlags`, meaning any store-level Pro gate fires there regardless
of how the guard is written. The Pro gate cannot be implemented at the store layer without
modifying the off-limits file.

Resolution: `ERR_ADDON_NOT_PRO` is retained as a reserved constant in `PurchaseAddOnResult`
for when the gate ships. The gate itself must be implemented at the UI/caller layer (where
the caller can check `isProEnabled()` before calling `purchaseAddOn`), not in the stub.
Document this as a carry-forward for the wave when specialty content ships.

## Debt entries logged

0

## Carry-forward tasks generated

1 (implicit): #357 Pro gate — must be implemented at the UI caller layer when specialty
packs ship, not in the store stub.

---

## Architecture decisions for next-wave builders

### #334 — onUpgradeClick option chosen: OPTION B (documented deliberate discard)

`app/page.tsx` receives `_code` in `onUpgradeClick` but discards it. The underscore prefix
documents the intentional no-op. Chosen because `BuyModal` has no per-add-on pricing logic
and `SPECIALTY_PACKS` is still empty — building UI for a product that doesn't exist yet
would be premature. Wire `_code` through to BuyModal when specialty pricing is decided.

### #362 — useLangPack re-seed mechanism chosen: COUNTER-BASED SIGNAL

`_cacheEvictionGeneration: number` added to `EntitlementStoreState` as a non-persisted
field (excluded via `partialize`). `clearEntitlement` increments it AFTER all eviction
Promises resolve. `useLangPack` subscribes to this counter and only calls `seedMemCache`
in the useEffect when `cacheEvictionGeneration > 0`. The lazy `useState` initializer still
seeds on first mount (always). So: 1 call on first mount (from initializer), then 1 call
each time clearEntitlement fires eviction-complete (from useEffect). Net: no double-seed
on initial render, guaranteed re-seed after eviction.

### #342 + #343 — setEntitlement's exact contract (next wave: #345, #368, #361 need this)

`setEntitlement` accepts ONLY:
```typescript
{ licenseKey: string; instanceId: string; licenseType: LicenseType;
  unlockedPacks: string[]; validUntil: number | null }
```
`purchasedAddOns` is intentionally ABSENT from this type. The backup restore path in
`useExportImport.ts` explicitly destructures only these five fields and passes them to
`setEntitlement`, so a backup cannot restore add-on purchases. Add-on purchases require
`purchaseAddOn()` + server receipt verification. This is not a bug.

### #347 — cross-tab sync fix: _PENDING_REHYDRATE MODULE FLAG

A module-level boolean `_pendingRehydrate` is set to `true` when a storage event fires
while `_rehydrateInFlight` is already true. `_triggerRehydrate()` (the shared helper) reads
`_pendingRehydrate` after rehydrate settles and re-fires if true, then clears the flag.
This ensures cross-tab writes that land mid-rehydrate are not silently dropped.

`_triggerRehydrate()` is also wrapped in try/catch — a synchronous throw from
`useEntitlementStore.persist.rehydrate()` no longer leaves `_rehydrateInFlight` stuck true
forever (fixes #363).

---

## Verification gate (all green at close)

```
npx tsc --noEmit          → 0 errors
npm test                  → 1168 tests passing, 57 files
npm run lint              → 0 errors (2 pre-existing warnings, exit 0)
grep assertion gate       → clean
coverage                  → lines 87.78, branches 82, funcs 88, stmts 90.54 — all above thresholds
```
