# Stream W11D — Wave 11 Completion

## Tasks closed

| Task | File(s) | Change |
|------|---------|--------|
| #300 | `store/entitlementStore.ts` | `hasAddOn` store action delegates to `hasAddOnLib(get(), code)` from `lib/entitlement.ts` instead of re-implementing `purchasedAddOns.includes(code)` |
| #305 | `tests/entitlementStoreEventWiring.test.ts` (new) | jsdom-environment test proving `window.addEventListener("storage", ...)` registration in entitlementStore fires `persist.rehydrate()` on the right key |
| #306 | `lib/featureFlags.ts`, `components/LanguageGrid.tsx` | Added `specialtyPacks` flag to `FeatureFlags` interface + `getFeatureFlags()`; replaced inline `!== "false"` env check in LanguageGrid with `getFeatureFlags().specialtyPacks` |
| #316 | `lib/packTypes.ts`, `tests/packTypes.test.ts` | Extended `hasValidUnitsArray` with per-unit `name`/`level` string checks and full card element-shape validation (id, type, prompt, accepted, tags, tier) |
| #321 | `tests/packLoader.test.ts` | Rewrote same-code concurrent dedup test with gated fetch for true concurrency; added honest commentary on mechanism indistinguishability |
| #327 | `lib/importBackup.ts`, `tests/importBackup.test.ts` | Fixed langPair regex to accept hyphenated specialty codes (`en-it-medical`); added `console.error` error signal for malformed input; 3 new tests |

## Verification gate

- `npx tsc --noEmit` — zero errors
- `npm test` — 1126 tests passed (55 files)
- `npm run lint` — zero errors (1 pre-existing warning in `hooks/useExportImport.test.ts`, not owned by this stream)
- Grep gate — clean

## Note for next wave (#307 / #308)

The specialty pack feature flag in `components/LanguageGrid.tsx` is now accessed as:

```typescript
const specialtyPacksEnabled = getFeatureFlags().specialtyPacks;
```

This constant gates the "Add-ons" section at approximately line 112:

```typescript
{specialtyPacksEnabled && specialtyPacks.length > 0 && (
  // Add-ons section
)}
```

The environment variable is `NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS`. The `parseFlag()` helper in `lib/featureFlags.ts` correctly treats `"false"`, `"0"`, `"off"`, and `"no"` as disabled (the old inline `!== "false"` check missed the other three).
