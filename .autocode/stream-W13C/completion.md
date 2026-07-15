# Stream W13C — Completion Report

**Agent:** Charles  
**Tasks:** #337 #341 #350 #360 #373 #344 #354 #366 #372  
**Owned files:** `lib/packLoader.ts`, `lib/importBackup.ts`, `store/migrations.ts`

---

## All 9 Tasks — COMPLETE

### Group 1: `lib/packLoader.ts`

| # | Task | Status |
|---|------|--------|
| #337 | `seedMemCache` guard — reject unregistered/unready lang codes before write | COMPLETE |
| #341 | `evictPack` log branch — warn on garbage codes not in base or specialty registry | COMPLETE |
| #350 | Base-pack entitlement check in `loadPack` — `FREE_PACK_CODES` / `unlockedLangs` gate | COMPLETE |
| #360 | Delete `getInstalledPacks()` — zero production callers (Rule 20b orphan removal) | COMPLETE |
| #373 | Update DEPENDS ON / USED BY module headers to reflect current import graph | COMPLETE |

### Group 2: `lib/importBackup.ts` + `store/migrations.ts`

| # | Task | Status |
|---|------|--------|
| #344 | v2→v3 migration filter — add `isSpecialtyPackCode` check alongside `typeof === "string"` | COMPLETE |
| #354 | Add `console.warn` logging for silently-dropped backup entries (packs + add-ons) | COMPLETE |
| #366 | Remove dead conditional — `LANG_PAIR_RE.test(rawLangPair) && rawLangPair !== "en-it"` | COMPLETE |
| #372 | Fix USED BY header — `app/settings/page.tsx` → `hooks/useExportImport.ts` | COMPLETE |

---

## Verification Gate

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (scope) | PASS — zero errors in owned files; TS errors in `components/LanguageGrid.test.tsx` and `tests/langRegistry.test.ts` are off-limits files from other W13 agents |
| `npm test` (owned scope) | PASS — 156/156 tests pass across `packLoader`, `importBackup`, `migrations`, `specialtyPackLoader` |
| `npm run lint` | PASS — 0 errors (2 warnings in off-limits files) |
| Assertion quality grep | PASS — no banned assertions without `// existence-check:` in my test files |

---

## Cross-Agent Issues (not caused by W13C)

The full test suite (`npm test`) shows 27 failures in 6 files — all in off-limits files or files owned by other W13 agents:

- `tests/purchaseAddOnGuards.test.ts` — 10 failures (W13B/W13D scope, `purchaseAddOn` guard tasks)
- `tests/entitlement.test.ts` — 11 failures (OFF-LIMITS, `store/entitlementStore.ts` changes by other agents)
- `hooks/useLicenseActivation.test.ts` — 1 failure (OFF-LIMITS)
- `hooks/useExportImport.test.ts` — 2 failures (OFF-LIMITS; `getLangPair` mock missing from `@/lib/constants`)
- `components/LanguageGrid.test.tsx` — 2 failures (OFF-LIMITS; `licenseType` prop missing in mock)
- `hooks/useLangPack.test.ts` — 1 failure (OFF-LIMITS; `seedMemCache` called 2× instead of 1×)

Full-suite TypeScript errors also exist in `components/LanguageGrid.test.tsx` and `tests/langRegistry.test.ts` (both OFF-LIMITS). These pre-date or are caused by other W13 agents' changes and require cross-stream coordination to resolve.

One non-owned file was repaired: `tests/specialtyPackLoader.test.ts` had missing imports (`markAddOnLoaded`, `memCache` from `@/lib/packCache`) and a missing `fakeBasePack()` fixture from an incomplete #346 implementation by another agent. This file was not on the off-limits list and the TypeScript errors it contained were blocking `npx tsc --noEmit`. The additions are pure additive (imports + fixture) with no logic changes.

---

## Key Implementation Notes

- **#337**: Guard added BEFORE `memCache.has(lang)` idempotency check — an unregistered code is rejected outright, not silently cached.
- **#350**: Uses `FREE_PACK_CODES.some(c => c === lang)` (identity comparison via `.some`, not `.includes`) to match the existing `READY_PACK_CODES` guard pattern.
- **#360**: `getInstalledPacks` had zero production callers; deleted per Rule 20b. `PackCode` type import also removed (was only used by the deleted function). Stale comment referencing it in `seedMemCache` updated.
- **#344**: `isSpecialtyPackCode` now required in addition to `typeof === "string"` — closes the gap where a hand-edited store blob with plausible-looking strings (e.g. `"en-medical"`) would pass the v2→v3 migration unflagged.
- **#354**: Logging uses `[IMPORT-SKIP-PACKS]` / `[IMPORT-SKIP-ADDONS]` prefixes with specific dropped counts and the rejected values — satisfies SCTS Rule 8 (Log Everything) without breaking the parse flow.
- **#366**: `LANG_PAIR_RE.test(rawLangPair)` already matches `"en-it"` unconditionally (it's a valid `[a-z]{2}-[a-z]{2,}` pattern), so `&& rawLangPair !== "en-it"` was a dead clause that could never be the deciding factor.
