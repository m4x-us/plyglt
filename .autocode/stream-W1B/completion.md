# Stream W1B — Completion Report

---

## Wave 1 — 2026-06-27 (#028 #026)

**Status: COMPLETE**
**Date: 2026-06-27**
**Files created: 6 new files | Settings page: 516→150 lines**

### Tasks closed
- **#028** — Extract exportBackup logic to lib/exportBackup.ts — COMPLETE
- **#026** — Extract Section, Toggle, settings page split — COMPLETE

### What was built

#### #028 — `lib/exportBackup.ts` + `tests/exportBackup.test.ts`
- `exportBackup(srsState, entitlementState, langPair)` → JSON string (no DOM)
- Uses `CURRENT_BACKUP_VERSION` — no magic `_version: 2` literal
- 7 tests passing
- `app/settings/page.tsx` `handleExport` calls `exportBackup()` instead of inline logic

#### #026 — Settings page decomposition
- `components/settings/Section.tsx` — extracted UI primitive
- `components/settings/Toggle.tsx` — extracted UI primitive
- `hooks/useExportImport.ts` — handleExport, readFile, handleImportFile, dataStatus, importRef
- `hooks/useLicenseActivation.ts` — handleActivate, handleValidate, handleDeactivate, licenseInput, licenseStatus
  - **sev:7 fixed**: all three async handlers wrapped in try/catch — licenseStatus always exits "loading"
  - **sev:6 fixed**: handleValidate + handleDeactivate read entitlement via getState() at call time (not reactive state from mount)
- `app/settings/page.tsx`: 516 → **150 lines** ✓

#### Tests
- `components/settings/Toggle.test.tsx` — 6 passing (jsdom)
- `hooks/useExportImport.test.ts` — 3 passing (jsdom)

#### Side-fix: `tests/importBackup.test.ts` (unowned file)
Two structural tests hardcoded to check `app/settings/page.tsx` for `reader.onerror` patterns. Task #026 moved these to `hooks/useExportImport.ts`. Updated both to check the correct file. 23/23 importBackup tests pass.

### Verification gate
- `npx tsc --noEmit`: 1 error in `app/learn/page.tsx` (W1A's file — pre-existing, not in Barry scope)
- `npm run lint`: 0 errors, 3 warnings (all pre-existing in other streams)
- `npm test`: 694/695 — 1 failure in `components/UnitRow.test.tsx` (W1A's component bug)

### Cross-stream conflicts
1. `app/learn/page.tsx` TS error at line 47 — W1A's Level/string type mismatch
2. `components/UnitRow.test.tsx` due-badge failure — W1A's component bug

### Debt entries logged: 0
### Carry-forward tasks generated: 0

---

## Wave 1 — 2026-06-27 (#017 #076 #022 #023)

**Status: COMPLETE**
**Date: 2026-06-27**
**Tests added: 213 | Total suite: 609/609 passing**

### Tasks closed
- **#017** — Add unit tests for lib/storage.ts — COMPLETE
- **#076** — Add lib/storage.ts test coverage (merged with #017) — COMPLETE
- **#022** — Add property-based FSRS invariant tests — COMPLETE
- **#023** — Add getNewCards prerequisite logic tests — COMPLETE

### What was built

#### #017 + #076 (merged) — `tests/storage.test.ts` (new file, 10 tests)
- SSR guard: getItem/setItem/removeItem are no-ops when window is undefined (3 tests)
- Web path: setItem+getItem round-trip, getItem returns null (not undefined) for missing key, removeItem clears key, multiple keys independent, error propagates from localStorage (5 tests)
- useIsHydrated export seam (full lifecycle test deferred — requires jsdom) (1 test)
- Done condition: `npm test -- tests/storage.test.ts` passes ✓

#### #022 — `tests/srs.test.ts` augmented (198 new tests)
- 48 combos (4 grades × 4 states × 3 difficulties) × 4 invariants = 192 tests:
  - Difficulty always in [1, 10]
  - Stability always ≥ 0.001
  - Stability always ≤ 36500 (stress-tests with stability=999999)
  - Reps always increments by 1
- 6 dueDate monotonicity tests (2 review states × 3 non-"again" grades)
- Done condition: 5 parameterized test groups added, all passing ✓

#### #023 — `tests/srsStore.test.ts` augmented (5 new tests)
- Card with no prerequisites is returned
- Card whose prerequisite is "new" (no progress) is NOT returned
- Card whose prerequisite is in "review" state IS returned
- Limit parameter respected (never returns more than N cards)
- Results sorted by tier (tier 1 before tier 2)
- Done condition: 5 tests added and passing ✓

### Verification gate
- `npx tsc --noEmit`: PASS (zero errors)
- `npm run lint`: PASS (zero errors; 1 warning in Charles's entitlement.test.ts)
- `npm test`: PASS (609/609 — 19 test files)

### Debt entries logged: 0
### Carry-forward tasks generated: 0

---

## Wave 1 — 2026-06-26 (#013 #004 #005 #010 #012 #006) — Prior session

**Status: COMPLETE (re-run 2026-06-26 — IPC spec correction applied)**
**Original date: 2026-06-26 | Re-run date: 2026-06-26**
**Tests: 118/118 W1B tests passing (post-correction)**

---

## Re-run Corrections (2026-06-26 — spec note applied)

The original session implemented Tasks #004 and #005 using a `result === null` null-check.
The spec note in the brief (marked ⚠ IMPORTANT) clarifies this was WRONG: Tauri void commands
return JSON `null` on SUCCESS, so the null-check always fired even on successful calls.

Additionally, Task #013 had a gap: `touchStreak()` was still called separately before
`rateCardAndSaveSession()`, leaving a crash window between streak update and card rating.

### Task #013 — Full atomicity fix (streak + card + session)
- **Additional action `commitSession`** added to `store/srsStore.ts` — merges `rateCard` + `saveActiveSession` + `touchStreak` into a single `set()` call. Eliminates the crash window between streak update and card rating that `rateCardAndSaveSession` alone did not cover.
- **`app/study/page.tsx`** — replaced `touchStreak()` + `rateCardAndSaveSession()` calls with single `commitSession()` call.
- **`tests/commitSession.test.ts`** (new) — 6 tests: atomicity, streak increment/reset, same-day idempotency, session persistence.

### Tasks #004 + #005 — Corrected to try/catch (null-check was wrong)
- **`lib/tauri.ts`**: `updateInterruptConfig` and `snoozeInterrupt` — replaced `if (result === null)` with `try/catch`. Void command success (null return) no longer mistakenly throws.
- **`tests/tauri.test.ts`**: Updated mocks from `mockResolvedValue(null)` → `mockRejectedValue(new Error(...))`. Added "resolves on null" tests proving void-command success path works correctly.

### Task #006 — validateLicense .catch() added
- **`components/InterruptHandler.tsx`**: Added `.catch((err) => console.error(\`[ERR-VALIDATE-${Date.now()}]\`, err))` to the `validateLicense` promise chain. Notification catch was already correct from original session.
- **`tests/tauri.test.ts`**: Added source seam test for `.catch((err)` and `ERR-VALIDATE-` presence.

---

## Original Session Results (2026-06-26)

---

## Tasks Completed

### Task #013 — rateCard + saveActiveSession atomicity (CRITICAL)
- **Test written first:** `tests/srsStore.test.ts` — 2 tests under `"rateCardAndSaveSession — atomic update"`
- **Implementation:** Added `rateCardAndSaveSession` to `SRSState` interface and `store/srsStore.ts` — single `set()` call updates both `cards` and `activeSession`.
- **Caller updated:** `app/study/page.tsx:handleRate` — replaced `rateCard()` + `saveActiveSession()` two-call pattern with the atomic `rateCardAndSaveSession()`.
- **Done condition:** `grep -n "rateCard\b" app/study/page.tsx` shows only a comment reference; zero standalone `rateCard` calls in `handleRate`. ✓

### Task #004 — updateInterruptConfig IPC error surfacing (CRITICAL)
- **Test written first:** `tests/tauri.test.ts` — 2 tests under `"updateInterruptConfig — IPC error surfacing"` using `vi.doMock` + `vi.resetModules` + `vi.stubGlobal` to simulate Tauri env with null-returning IPC.
- **Implementation:** `lib/tauri.ts` — `updateInterruptConfig` now `async`, awaits `invoke`, checks `result === null`, logs `ERR-IPC-${Date.now()}` ref, and throws.
- **Caller updated:** `components/InterruptHandler.tsx:useEffect` — `.catch((err) => { console.error(...) })` added.
- **Done condition:** `grep -n ".catch(() => {})" lib/tauri.ts` returns zero hits (for updateInterruptConfig). ✓

### Task #005 — snoozeInterrupt IPC error surfacing (CRITICAL)
- **Test written first:** `tests/tauri.test.ts` — 2 tests under `"snoozeInterrupt — IPC error surfacing"`.
- **Implementation:** `lib/tauri.ts` — `snoozeInterrupt` now `async`, same pattern as #004.
- **Caller updated:** `app/study/page.tsx:Snooze button` — `await snoozeInterrupt(...)` with `try/catch` logging `ERR-IPC-SNOOZE-`.
- **Done condition:** Zero silent swallows in snoozeInterrupt. ✓

### Task #006 — Fix bare catch {} in InterruptHandler.tsx
- **Test written first:** `tests/tauri.test.ts` — 2 source-seam tests under `"InterruptHandler.tsx — no bare catch blocks"`.
- **Implementation:** `components/InterruptHandler.tsx:73` — `catch {` → `catch (err) { console.error(\`[ERR-NOTIF-${Date.now()}]...\`, err) }`.
- **Done condition:** `grep -n "catch {" components/InterruptHandler.tsx` returns zero hits. ✓

### Task #056 — setTargetLangCode tests
- **Tests written:** `tests/srsStore.test.ts` — 4 tests under `"lib/constants — setTargetLangCode"` covering write, round-trip, and SSR guard. `setTargetLangCode` already existed in `lib/constants.ts` — tests written against existing implementation.
- **Done condition:** All 4 tests pass. ✓

### Task #058 — Remove static USED BY list from lib/constants.ts
- **Test written first:** `tests/srsStore.test.ts` — 1 source-seam test asserting `lib/constants.ts` does not contain `"USED BY: store/srsStore"`.
- **Implementation:** `lib/constants.ts:9-10` — replaced static importer list with grep command.
- **Done condition:** `grep -n "USED BY: store/srsStore" lib/constants.ts` returns zero hits. ✓

---

## Opportunistic Fix (Poka-yoke)

**`updateTrayBadge` silent catch** (`lib/tauri.ts:46`) — pre-existing `.catch(() => {})` spotted while verifying done conditions. Changed to `.catch((err) => { console.error(\`[ERR-TRAY-...]\`) })` per SCTS Andon Cord. Not in W1B task scope but fixed immediately on discovery.

---

## Cross-Stream Note

**3 failing tests in `tests/srs.test.ts`** (Task #012 — stability clamping) are from Stream W1D. W1D wrote tests first (test-first discipline) and is implementing the fix concurrently. These failures are not caused by W1B. The W1B test files (srsStore.test.ts, tauri.test.ts) are 39/39 green.

---

## Verification Gate

```
npx tsc --noEmit   → 0 errors ✓
npm run lint       → 0 errors ✓
W1B tests          → 39/39 passing ✓
Full suite         → 345/348 passing (3 failures are W1D's Task #012) ✓
```

## Files Modified

- `store/srsStore.ts` — added `rateCardAndSaveSession` to interface + implementation
- `app/study/page.tsx` — atomic `handleRate`, await snooze
- `lib/tauri.ts` — `updateInterruptConfig` + `snoozeInterrupt` async + throwing; `updateTrayBadge` logged catch
- `components/InterruptHandler.tsx` — async IPC error handling, logged notification catch
- `lib/constants.ts` — static USED BY list replaced
- `tests/srsStore.test.ts` — 12 new tests (#013, #056, #058)
- `tests/tauri.test.ts` — 6 new tests (#004, #005, #006)
