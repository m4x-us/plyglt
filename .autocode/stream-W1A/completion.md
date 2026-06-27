# Stream W1A — Completion Summary
**Last updated:** 2026-06-27 (Cycle 3 — Wave 1 new tasks: #015, #016, #014)

## All 10 Tasks — COMPLETE

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| #003 | Lang-injection guard in loadPack/evictPack | COMPLETE | Code already in place; verified |
| #066 | useMemo stability fix for `lang` in useEffect | COMPLETE | Code in place; 8 tests + 1 new A002 seam test |
| #059 | `LanguageEntry.code: PackCode` annotation | COMPLETE | Code in place; verified |
| #060 | `"invalid_lang"` discriminant + A001/A002/A003/A023 | COMPLETE | See below |
| #067 | MANIFEST_FETCH_FAIL logging in fetchManifest | COMPLETE | Code in place; verified |
| #008 | ERR-CACHE-META/DATA logging | COMPLETE | Code in place; verified |
| #075 | CACHE_PARSE_FAIL logging | COMPLETE | Code in place; verified |
| #061 | QuotaExceededError test coverage | COMPLETE | Test in place; verified |
| #062 | Strengthen LANG_CONFIG_MAP assertions | COMPLETE | Intentionally FAIL (surfacing fr/de/pt bug per spec) |
| #057 | @deprecated re-export in useLangPack | COMPLETE | Code in place; verified |

## Task #060 Sub-items (Cycle 2 work)

- **A001**: Removed `"not_cached"` dead discriminant from `LoadPackResult` union in `lib/packLoader.ts`. Cleaned up guard comment (removed "retry-on-not_cached" reference).
- **A002**: Added source-level seam test to `tests/useLangPack.test.ts`: verifies `error: result.error` passes the `invalid_lang` discriminant through useLangPack without transformation. Node-environment-compatible approach consistent with existing test style.
- **A003**: Changed `const [cachedMeta, cachedData]` to `let cachedData` with `cachedData = null` immediately after `clearPackCache(lang)` in SHA-256 mismatch branch. Prevents integrity-failed bytes from reaching stale-cache fallback.
- **A023**: Added `loadPack — A003: cachedData nulled after SHA-eviction` test to `tests/packLoader.test.ts`. Seeds corrupted data with wrong SHA, makes fetch throw, asserts `{ ok: false, error: "download_failed" }`. Fails before A003 fix, passes after.

## A004–A026 (deferred)

Explicitly deferred per done condition: "A004–A026 may be closed in subsequent cycles or carried to debt register."

## Files Modified (Cycle 2)

- `lib/packLoader.ts` — A001 (removed `"not_cached"`), A003 (`cachedData = null` after SHA eviction)
- `tests/packLoader.test.ts` — A023 (cachedData integrity bypass test)
- `tests/useLangPack.test.ts` — A002 (invalid_lang seam test)

## Verification Gate
- `npx tsc --noEmit` (W1A files): ✓ zero errors
- `npm test`: 369/371 pass — 2 intentional failures in `tests/langRegistry.test.ts` (Task #062 spec)
- `npm run lint`: ✓ zero errors

## Cycle 3 — Wave 1 new tasks (#015, #016, #014)

### #015 — Delete dead test file tests/grading.test.ts — COMPLETE
- Deleted tests/grading.test.ts (5 autoRate tests — strict subset of srs.test.ts)
- Test count: 18 files → 17 files; 392 tests passing

### #016 — Fix vacuous assertion in language.test.ts — COMPLETE
- Replaced `toBeTruthy()` on card label string with three-part assertion:
  - `expect(label).toMatch(/\S/)` + `not.toBe("undefined")` + `length > 2`
- Zero `toBeTruthy` hits in file after fix

### #014 — Fix false-green poka-yoke test — COMPLETE
- tests/language.test.ts: changed `not.toBe("it")` → `toBe(code)` in poka-yoke it()
- lib/language.ts: removed fr/de/pt dead entries from LANGUAGE_MAP
- Rationale: old test passed because "es" !== "it", not because the map was correct. New test requires exact code match. The CTO escalation from Cycle 2 is resolved: fr/de/pt stubs removed in W2A #077 (langRegistry) and now in lib/language.ts too.

## Verification Gate (Cycle 3)
- `npx tsc --noEmit`: 0 errors
- `npm test`: 392/392 pass (17 files)
- `npm run lint`: 0 errors (1 pre-existing warning in entitlement.test.ts)

## Outstanding
- **A004–A026**: registered in tasks.md under #060 for future cycles.
