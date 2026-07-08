# Stream W6A — Wave 6 — Completion

**Agent:** Adam  
**Wave:** 6  
**Date:** 2026-07-08  
**Tasks:** #252 #253 #257

---

## Tasks Closed

| Task | Status | Notes |
|------|--------|-------|
| #252 | COMPLETE | `clearPackCache` now uses `Promise.allSettled` for both `removeItem` calls; `memCache.delete` always runs after, even if storage throws; failures logged with `[ERR-CACHE-CLEAR-META-{lang}]` / `[ERR-CACHE-CLEAR-DATA-{lang}]` |
| #253 | COMPLETE | Added `clearSpecialtyPacksForLang(baseLang)` to `specialtyPackLoader.ts`; `evictPack` calls it before `clearPackCache` so merged add-ons are pruned when their base pack is evicted |
| #257 | COMPLETE | Removed dead `cachedData = null; // A003-style...` from the branch that returns immediately after — behavior unchanged, misleading comment eliminated |

Tasks NOT completed: none

Debt entries logged: 0

Carry-forward tasks generated: 0

---

## Files Changed

- `lib/specialtyPackLoader.ts` — added `clearSpecialtyPacksForLang(baseLang)` export; uses `SPECIALTY_PACKS.filter` to find matching codes, then splices them out of `loadedAddOns` in reverse order
- `lib/packLoader.ts` — updated import to include `clearSpecialtyPacksForLang`; `clearPackCache` rewritten with `Promise.allSettled` + always-runs `memCache.delete`; `evictPack` now calls `clearSpecialtyPacksForLang(lang)` before `clearPackCache`; removed dead `cachedData = null` from parse_error branch
- `tests/packLoader.test.ts` — added `#252` test: mocks second `removeItem` to throw, asserts `getInstalledPacks()` no longer contains lang and error is logged; added `#253` test inside `specialty pack merge path` describe: loads add-on, evicts base, asserts `getLoadedAddOns()` no longer contains add-on code

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors ✓
- `npm test` — 1025/1025 passing ✓ (+7 vs Wave 5)
- `npm run lint` — 0 errors (1 pre-existing warning in unrelated file) ✓
- Assertion quality grep gate — clean ✓

---

## Architecture Check (Memory Note)

Grepped ALL call sites of `clearPackCache`, `evictPack`, `loadedAddOns`, `clearSpecialtyCache`, `clearSpecialtyPacksForLang` across `lib/packLoader.ts` and `lib/specialtyPackLoader.ts`:

- All 8 `clearPackCache` call sites route through the patched function (allSettled + always-delete)
- `evictPack` — now calls `clearSpecialtyPacksForLang` before `clearPackCache` ✓
- `clearCacheForTesting` — still calls `clearSpecialtyCache()` (correct: test teardown clears everything, not just one lang)
- No unprotected sibling call sites remain

This batch has now closed 3 consecutive "fixed the named site, missed a caller" sibling gaps in `lib/packLoader.ts`. No known open instances remain.
