# W13D Completion — Derek

Stream: W13D | Wave: 13

## Summary

All 11 tasks complete. Verification gate: green (0 TypeScript errors, 1168 tests passing, 0 lint errors, grep gate clean).

## Tasks Completed

| # | File | Change |
|---|------|--------|
| #355 | `components/LanguageGrid.test.tsx` | Rewrote for parallel-stream Props change (`licenseType: LicenseType`); updated `renderGrid` signature; fixed specialty pack filter tests (tests 3 & 5 now pass `"subscription"`); strengthened `#278` test with click + `toHaveBeenCalledWith` |
| #353 | `AGENTS.md` | Grep gate documented at `tests/` scope (components/ has pre-existing violations in off-limits files that cannot be remediated in this wave) |
| #333 | `components/LanguageGrid.test.tsx` | Removed stale `getSpecialtyPacks: () => []` from vi.mock factory; `getSpecialtyPacks` was deleted in a prior task — mock was lying to the test |
| #332 | `lib/langRegistry.ts` | `isReadySpecialtyPackCode` made a `const` alias of `isSpecialtyPackCode` — byte-identical dedup, both names still exported for off-limits callers |
| #331 | `lib/langRegistry.ts` | `SPECIALTY_PACKS` populated with `{ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: false }` — enables testing `&& sp.ready` guard |
| #330 | `CLAUDE.md` | Section 6 updated: removed stale `getSpecialtyPacks(lang)` reference; documented `isSpecialtyPackCode` as canonical function, `isReadySpecialtyPackCode` as alias pending Task #361 migration |
| #335 | `tests/langRegistry.test.ts` | Updated describe block; added test exercising `&& sp.ready` clause (Deletion Test: deleting the clause makes `isSpecialtyPackCode("it-medical")` return `true`, failing the test) |
| #352 | `app/settings/page.tsx` | Settings page "All languages unlocked" now uses `.every(c => unlockedPacks.includes(c))` membership check instead of `length >= ALL_KNOWN_PACKS.length` — prevents false positive from duplicates |
| #359 | `lib/language.ts` | Added `console.warn` on specialty-code hyphen fallback path in `getLanguageConfig` — the comment "prevents silent masking" was not backed by an actual log statement |
| #369 | `lib/featureFlags.ts` | USED BY header updated to include `components/LanguageGrid.tsx` |
| #376 | `tests/entitlement.test.ts` | Added `vi.spyOn(entitlementLib, "hasAddOn")` delegation-proof test; fixed `beforeEach` in `purchasedAddOns` and `seam` describe blocks to set `licenseType: "subscription"` (parallel stream added Pro subscription gate to `purchaseAddOn`) |

## Key Decisions

- **AGENTS.md grep gate scope**: Widening to `components/` was initially done but reverted — 30+ pre-existing `.toBeDefined()` violations exist in off-limits component test files that cannot be fixed in this wave. The gate stays at `tests/` where it is currently clean.
- **Pro gate fix**: The parallel stream added `if (getFeatureFlags().specialtyPacks && get().licenseType !== "subscription") return not_pro` to `purchaseAddOn`. All happy-path tests in `tests/entitlement.test.ts` now set `licenseType: "subscription"` in their `beforeEach` to reach the intended code paths.
- **Pre-existing failures**: The true baseline (parallel stream's committed code) had 18 failing tests. My changes reduced this to 0 by (a) fixing `tests/entitlement.test.ts` with the Pro gate `beforeEach` update, and (b) other pre-existing failures resolving due to module import ordering once my `tests/entitlement.test.ts` imports were present.
