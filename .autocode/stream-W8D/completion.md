# Stream W8D — Completion Summary

## Wave: 8 (2026-07-09)

## Tasks Closed

- **#273** — v2→v3 entitlement migration element-shape validation ← COMPLETE
  - `store/migrations.ts:155`: replaced `d.purchasedAddOns` pass-through with `raw.filter((item): item is string => typeof item === "string")`
  - A persisted blob with `purchasedAddOns: [null, 1, {}]` is now sanitised to `[]` rather than propagating bad types into the entitlement store
  - Validation approach for #274/#289: same one-liner — `Array.isArray(raw) ? raw : []` → `.filter((item): item is string => typeof item === "string")`. Apply this pattern wherever `purchasedAddOns` is read from untrusted persisted/backup data.

- **#292** — packTypes.ts header documentation completeness ← COMPLETE
  - `lib/packTypes.ts:2–5`: updated header comment from "single source of truth for Pack, PackMeta, Manifest, and LoadPackResult" to include all 6 exports: `Pack, PackMeta, Manifest, LoadPackResult, hasValidUnitsArray, and PackMemCache`
  - Note: #293 (same root finding — header omits exports) is now fully subsumed by this fix. #293 can be closed as a duplicate at next wave planning — no separate fix needed.

- **#277** — langRegistry test mock correctness ← COMPLETE
  - `tests/langRegistry.test.ts`: removed `vi.mock`, `vi.hoisted` mock array, and `beforeEach` reset
  - Removed the "getSpecialtyPacks with non-empty registry" describe block (3 tests that tested the mock filter, not the real export — those tests passed regardless of the real implementation)
  - All remaining tests now call the real exports directly (`getSpecialtyPacks("it")` → real fn → `[]`; `isSpecialtyPackCode("it-medical")` → real fn → `false`)
  - Passes the Deletion Test: deleting any of the tested functions causes a TypeError, not a silent pass
  - Note: testing `getSpecialtyPacks` / `isSpecialtyPackCode` with a non-empty registry requires the real SPECIALTY_PACKS to be populated (currently `Object.freeze([])`) — the non-empty tests are deferred until real specialty pack data exists

- **#279** — getLanguageConfig silent fallback ← COMPLETE
  - `lib/language.ts:109–120`: added `console.error` log when `code` is not in `LANGUAGE_MAP`
  - No longer silent: unknown codes now emit `[ERR-LANG-CONFIG-UNKNOWN-{ts}] No LanguageConfig for "${code}"` before returning ITALIAN
  - Existing fallback behaviour preserved (returns ITALIAN) — the existing `tests/language.test.ts` poka-yoke test continues to pass
  - A full throw-on-unknown approach would require updating `tests/language.test.ts` (not in this stream's Files You Own); logged as carry-forward if a harder guard is wanted

## Verification Gate
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS — 1082/1082 tests pass, 53/53 files pass
- `npm run lint`: PASS (0 errors; 1 pre-existing warning in off-limits `hooks/useExportImport.test.ts`)

## Tasks NOT Completed
None.

## Debt Entries Logged
1 — `lib/language.ts:getLanguageConfig` — fallback still returns ITALIAN rather than throwing for unknown codes (soft fix only). A hard guard (throw) would require also updating `tests/language.test.ts` line 245, which is outside this stream's file ownership. Carry forward as a future task if stricter enforcement is wanted.

## Carry-Forward Tasks Generated
0 (the debt above is an existing test constraint, not a new task — #274 and #289 can now reuse the element-shape filter pattern from #273; #293 can be closed as duplicate of #292)
