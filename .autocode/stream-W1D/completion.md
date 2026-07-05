# Stream W1D — Completion Summary
**Completed:** 2026-07-01

## Tasks Closed

- **#156** — Extract specialty pack logic from packLoader.ts (Rule 1 fix) ← COMPLETE
  - Created `lib/specialtyPackLoader.ts` (116 lines) with Rule 2 header
  - Moved: `loadedAddOns`, `getLoadedAddOns()`, `clearSpecialtyCache()`, full specialty pack download+verify+merge path
  - `lib/packLoader.ts` reduced from 426 → 363 lines (≤400 threshold met)
  - `packLoader.ts` calls `loadSpecialtyPack(lang, memCache, manifest)` for the specialty branch
  - `getLoadedAddOns` re-exported from `packLoader.ts` via `export { getLoadedAddOns } from "@/lib/specialtyPackLoader"` — no import changes required in callers
  - `clearCacheForTesting()` now calls `clearSpecialtyCache()` to reset both modules
  - All 31 packLoader tests pass (including 3 specialty pack merge path tests from Task #152)

- **#157** — Add getSpecialtyPacks() filter test with non-empty registry ← COMPLETE
  - Added `vi.mock` with custom `getSpecialtyPacks`/`isSpecialtyPackCode` implementations using `mockSpecialtyPacks`
  - Added global `beforeEach(() => { mockSpecialtyPacks.length = 0 })` to isolate all tests
  - Added new describe block "getSpecialtyPacks with non-empty registry" with 3 test cases (2 Italian, 1 Spanish, 0 French)
  - All 21 langRegistry tests pass

## Verification Gate
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: 893 passed, 1 pre-existing failure in `tests/tauri.test.ts` (ERR-VALIDATE- test reads wrong file — not caused by my changes; confirmed by git stash comparison showing same failure pre-exists)
- `npm run lint`: 1 pre-existing error in `app/settings/page.tsx` (off-limits file owned by another stream; committed codebase was clean — confirmed by stash)

## Tasks NOT Completed
None.

## Debt Entries Logged
1 — `app/settings/page.tsx:23` — `react-hooks/set-state-in-effect` lint error introduced by another stream agent in this wave's working directory changes. Not fixable by Derek (off-limits). Needs resolution before merge.

## Carry-Forward Tasks Generated
0

---

# Stream W1D — Wave 3 Completion Summary
**Completed:** 2026-07-05

## Tasks Closed

- **#217** — Config-sync effect race guard ← COMPLETE
  - `components/InterruptHandler.tsx`: added `configSeqRef = useRef(0)` sequence counter
  - Each effect run captures its seq; `.catch()` silently drops stale resolutions (`seq !== configSeqRef.current`)
  - Eliminates race where an older in-flight `updateInterruptConfig` call resolving after a newer one would silently revert Rust-side state
  - All 5 InterruptHandler tests pass (sequence-number approach calls synchronously — no fake timers needed)

- **#222** — Layer boundary fix (components/ → store/ violation) ← COMPLETE
  - Created `hooks/useInterruptConfig.ts` — hook facade wrapping `useSettingsStore` and `useSRSStore`
  - Exports: `useInterruptConfig()` (returns all interrupt config values + `computeDue(units)` helper), `isInDnd` (re-export)
  - `components/InterruptHandler.tsx` now imports from `@/hooks/useInterruptConfig` only — no direct `store/` imports remain
  - Layer boundary restored: `components/` → `hooks/` → `store/`

- **#223** — Brand voice: tray tooltip strings ← COMPLETE
  - `src-tauri/src/lib.rs:59`: `"plyglt — all caught up!"` → `"plyglt — nothing ready"` (removed exclamation mark, canonical empty-state phrasing per BRAND.md)
  - `src-tauri/src/lib.rs:61`: `"plyglt — {} card{} due"` → `"plyglt — {} card{} ready"` ("due" → "ready" per BRAND.md terminology table)

- **#224** — Platform storage abstraction (app/learn/page.tsx) ← COMPLETE
  - `app/learn/page.tsx`: replaced `window.localStorage.removeItem(LANG_PAIR_KEY)` with `void _langPairStore.removeItem(LANG_PAIR_KEY)`
  - Module-level `_langPairStore = createPlatformStorage("lang")` — initialised once, routes through `lib/storage.ts` abstraction
  - No direct `window.localStorage` calls remain in this file

## Verification Gate
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: 931 passed, 6 pre-existing failures in `app/settings/page.test.tsx` (OS Triggers implementation from another Wave 1 stream — off-limits files `app/settings/page.tsx` and `app/settings/page.test.tsx` — confirmed pre-existing by git stash comparison showing 25/25 settings tests pass at base commit; the 6 failures are from tests added by another agent testing its own implementation which has a rendering bug)
- `npm run lint`: PASS (0 errors; 1 pre-existing warning in `hooks/useExportImport.test.ts`)

## Tasks NOT Completed
None.

## Debt Entries Logged
1 — `app/settings/page.tsx` (OS Triggers section) — another stream's implementation fails 6 of its own tests; the section renders as hidden even when `interruptEnabled && isTauri`. Off-limits for Derek. Needs resolution by owning stream before merge.

## Carry-Forward Tasks Generated
0
