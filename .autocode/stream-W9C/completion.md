# Charles — W9C — Completion Summary

**Wave:** 9
**Stream:** W9C
**Date:** 2026-07-09

## Tasks Closed

- **#274** — Fix data-loss: ENTITLEMENT_MIGRATIONS[1] v1 `unlockedPacks` shallow validation hardened.
  Applied the Task #273 element-shape filter pattern to `store/migrations.ts` v1 migration.
  `Array.isArray(d.unlockedPacks)` check now followed by `.filter((item): item is string => typeof item === "string")`.

- **#289** — Fix data-loss: backup/restore missing `purchasedAddOns` field.
  - Added `purchasedAddOns: string[]` to `BackupEntitlement` interface in `lib/importBackup.ts`.
  - Added `rawAddOns` extraction + element-shape filter (same Task #273 pattern) to `parseBackup()` in `lib/importBackup.ts`.
  - Added `purchasedAddOns: entitlementState.purchasedAddOns` to serialized entitlement in `lib/exportBackup.ts`.
  - Fixed downstream TypeScript errors in `hooks/useExportImport.ts` (added field to object literal) and `tests/exportBackup.test.ts` (added field to fixture).

## Tasks NOT Completed

None.

## Verification Gate

- `npx tsc --noEmit` — 0 errors
- `npm test` — 1092 passed (53 test files)
- `npm run lint` — 0 errors (1 pre-existing warning in unrelated file)
- Assertion quality gate — clean

## Debt Entries Logged

0

## Carry-Forward Tasks Generated

0
