# Stream W11A — Wave 11 — Completion

**Agent:** Adam  
**Wave:** 11  
**Date:** 2026-07-10  
**Tasks:** #296 #325 #323 #324

---

## Tasks Closed

| Task | Status | Notes |
|------|--------|-------|
| #296 | COMPLETE | Option A: added `seedMemCache` to `lib/packLoader.ts`; called from `hooks/useLangPack.ts` static-pack path |
| #325 | COMPLETE | Added `console.error` alongside existing `console.warn` in `evictPack`; updated JSDoc |
| #323 | COMPLETE | Validate `rawTargetLang` in `useLangPack`; repair via `setTargetLangCode("it")` if unrecognised |
| #324 | COMPLETE | At error setState site: `invalid_lang` + `isReadySpecialtyPackCode` → "Add-on not purchased." |

Tasks NOT completed: none  
Debt entries logged: 0  
Carry-forward tasks generated: 0

---

## Files Changed

- `lib/packLoader.ts` — Added `Unit` import; added `LANG_CONFIG_MAP` to langRegistry import; added `seedMemCache(lang, units)` function; updated `evictPack` JSDoc + added `console.error` alongside `console.warn` for specialty codes.
- `hooks/useLangPack.ts` — Added `seedMemCache` + langRegistry imports; added #323 validation block; added `seedMemCache(targetLang, static_.units)` in useState initializer; added `isReadySpecialtyPackCode` branch in error setState for #324.
- `hooks/useLangPack.test.ts` — Added `seedMemCache` and `isReadySpecialtyPackCode` to mocks; added langRegistry mock with `isValidPackCode` extension for "pt" (to preserve the existing language-switch test); added 8 new tests for #296, #323, #324.

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors ✓
- `npm test` — 1133/1133 passing ✓
- `npm run lint` — 0 errors (1 pre-existing warning in `hooks/useExportImport.test.ts`) ✓
- Assertion quality grep gate — clean ✓

---

## #296 — Architectural Decision: Option A

**What the problem was:** Italian is served from `STATIC_PACKS` in `useLangPack.ts`, bypassing `loadPack` entirely. `loadSpecialtyPack`'s precondition `memCache.has(spec.baseLang)` can therefore never be satisfied for any `it-*` specialty pack via the real `useLangPack` entry point.

**Option A vs B:**
- **Option A** (chosen): Seed `memCache["it"]` as a side effect of the existing static-pack fast path. `seedMemCache` constructs a synthetic `Pack` from the static units and calls `memCache.write(lang, pack)`. Italian users still get an instant synchronous response from `STATIC_PACKS`; `memCache` gets populated as a side effect in the `useState` initializer.
- **Option B** (rejected): Redesign `loadSpecialtyPack`'s precondition in `lib/specialtyPackLoader.ts` to not require the base pack to be in `memCache` for statically-bundled languages. This file is off-limits for W11A, and even if it weren't, it would change a contract that all specialty pack loading depends on — higher risk, wider blast radius.

**Why Option A is the right choice even generally:**
- `seedMemCache` touches only `lib/packLoader.ts` and `hooks/useLangPack.ts` (both owned by this wave)
- It is idempotent: if a future code path calls `loadPack("it", ...)` and populates `memCache["it"]` via the real load path, `seedMemCache` no-ops on the next render
- `specialtyPackLoader.ts`'s contract (`memCache.has(baseLang)` → base data is available) remains correct and unchanged
- The synthetic Pack has the right shape for the merge operation (`units`, `unitCount`, `cardCount`) — the metadata fields (`name`, `nativeName`, `flag`) are populated from `LANG_CONFIG_MAP` and are cosmetic only

**New expected behavior for loading a specialty pack for Italian:**
1. `useLangPack` renders with `targetLang = "it"` → `STATIC_PACKS["it"]` exists → `seedMemCache("it", ALL_UNITS)` populates `memCache["it"]`
2. Some caller (e.g. `LanguageGrid.tsx`) calls `loadPack("it-medical", manifest, { purchasedAddOns: ["it-medical"] })`
3. `loadPack` routes to `loadSpecialtyPack("it-medical", memCache, manifest, ["it-medical"])`
4. `memCache.has("it")` → TRUE → proceeds to download and merge
5. Specialty units merged into `memCache["it"]`; `loadedAddOns` now includes `"it-medical"`

**Dependency for next-wave tasks:**
- **#297** (packLoader.ts header update): The header comment at the top of `lib/packLoader.ts` still says "Since SPECIALTY_PACKS is currently empty, the specialty path never executes". This is now false — the specialty path CAN execute once real content ships. The header also lacks any mention of `seedMemCache`. Task #297 should update both.
- **#302** (false-positive error log): Now that Italian specialty packs can load, the error log `[ADDON_NO_MANIFEST-...]` in `specialtyPackLoader.ts` may fire in more scenarios. #302 should review its conditions.
- **#311** (test assertions update): `tests/packLoader.test.ts` may need assertions updated now that `memCache["it"]` can be seeded without going through `loadPack`.

---

## #323 — Corrupted lang code repair

The `#323` fix detects an unrecognised `rawTargetLang` using `isValidPackCode` (covers all registered base packs, ready or not) and `SPECIALTY_PACKS.some(sp => sp.code === rawTargetLang)` (covers registered specialty packs). If neither check passes, the value is treated as corruption:

1. `console.error("[ERR-LANGPACK-CORRUPT] ...")` — one log, no `Date.now()` (render-body purity rule)
2. `setTargetLangCode("it")` — repairs localStorage immediately
3. `const targetLang = isKnownCode ? rawTargetLang : "it"` — this render uses "it"

Subsequent renders call `getTargetLangCode()` which reads the now-repaired "en-it" from localStorage → `isKnownCode = true` → no log.

**Test file note:** The existing test "calls loadPack again when the target language changes between renders" used "pt" as a second non-static language. "pt" was removed from `LANGUAGE_REGISTRY` in 2026-06-27 and is no longer in `ALL_PACK_CODES`. Without intervention, my `#323` fix would detect "pt" as corrupted, repair to "it", and break that test. The `hooks/useLangPack.test.ts` langRegistry mock was extended to include "pt" in `isValidPackCode` specifically for this test scenario, with an explanatory comment.

---

## #324 — invalid_lang disambiguation

At the error setState call site in `useLangPack.ts`'s `useEffect`:
```typescript
const errorMsg =
  result.error === "invalid_lang" && isReadySpecialtyPackCode(targetLang)
    ? "Add-on not purchased."
    : LOAD_PACK_ERROR_MESSAGES[result.error];
```

`LOAD_PACK_ERROR_MESSAGES["invalid_lang"]` remains `"Pack not available."` (unchanged). The new message "Add-on not purchased." only surfaces when the user has a ready specialty pack code that they haven't purchased yet. Since `SPECIALTY_PACKS` is currently empty, the new branch is dead code in production until real specialty pack content ships — at which point it surfaces correctly without any further change needed.
