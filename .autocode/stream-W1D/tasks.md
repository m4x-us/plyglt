# Stream W1D Task State

### Task #156 | architecture | severity 5
**What:** Extract specialty-pack handling from `lib/packLoader.ts` (currently 426 lines — 26 over Rule 1 service ceiling of 400) into new `lib/specialtyPackLoader.ts`. Move: `isReadySpecialtyPack` guard logic, specialty pack download + sha256 verify + merge into `memCache[baseLang]`, `loadedAddOns` array, `getLoadedAddOns()` export, `"base_pack_not_loaded"` error path. `lib/packLoader.ts` calls `lib/specialtyPackLoader.ts` for the specialty branch. Keep `clearCacheForTesting` exports accessible to tests (either re-export or expose from both modules). Add Rule 2 header to `lib/specialtyPackLoader.ts`.
**Why:** Rule 1 — service files cap at 400 lines. `lib/packLoader.ts` is at 426 lines and will grow as specialty packs ship. Extract now avoids a larger refactor later.
**File:** `lib/packLoader.ts`, `lib/specialtyPackLoader.ts` (new), `tests/packLoader.test.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files + 1 new, refactor (keyword: extract)
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — all 28+ existing packLoader tests must continue passing, including the 3 specialty pack merge path tests.
**Done when:** `lib/packLoader.ts` ≤ 400 lines. `lib/specialtyPackLoader.ts` exists with Rule 2 header. All existing packLoader tests pass (no regressions). `npm test` passes. No coverage regression.
**Owner:** Architecture Agent

---

### Task #157 | tests | severity 4
**What:** Add a test describe block to `tests/langRegistry.test.ts` exercising `getSpecialtyPacks(lang)` with a non-empty `SPECIALTY_PACKS` registry. Use `vi.mock`/`vi.hoisted` to temporarily replace `SPECIALTY_PACKS` with a 3-pack mock (2 with `baseLang: "it"`, 1 with `baseLang: "es"`). Assert: `getSpecialtyPacks("it")` returns exactly the 2 Italian packs; `getSpecialtyPacks("es")` returns exactly the 1 Spanish pack; `getSpecialtyPacks("fr")` returns [].
**Why:** The `sp.baseLang === lang` filter predicate in `getSpecialtyPacks()` has no test with a non-empty registry. LanguageGrid tests mock the function entirely. If someone adds specialty packs and misspells `baseLang`, no test catches it.
**File:** `tests/langRegistry.test.ts`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, tests only
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** This task IS the test.
**Done when:** `tests/langRegistry.test.ts` has a new describe block "getSpecialtyPacks with non-empty registry" with ≥3 test cases. `npm test` passes.
**Owner:** QA Agent
