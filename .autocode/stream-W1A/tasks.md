# Stream W1A Task State

### Task #179 | correctness | severity 6
**What:** Fix remaining behavior bugs and code quality gaps in `lib/introduction.ts`:
- ~~F02: `shouldAppearToday` 0.5 branch~~ — DONE in Task #178 Cycle 2 (CF-12 fix)
- ~~F09: `recordResult` cross-day consecutiveWrongToday reset~~ — DONE in Task #178 Cycle 2 (CF-02 fix)
- F11: `getDayOfPhase`: validate date string format (`/^\d{4}-\d{2}-\d{2}$/`) before calling `new Date(str)`, throw with ref ID on invalid input — NaN propagation currently causes silent card disappearance (migration has DATE_RE guard at persistence boundary but getDayOfPhase itself is still unguarded)
- F07: `export const MAX_APPEARANCES_BY_PHASE_DAY = Object.freeze({...})` with `Readonly<Record<number, number>>` type — currently exported unfrozen, mutable by any importer
- F06: Extract `export const GRADUATION_THRESHOLD = 15` and `export const CONSECUTIVE_WRONG_RESET = 3` as named constants; replace all magic literals in `recordResult` and `shouldGraduate`
- F18: Add Rule 2 header to `lib/introduction.ts` (DEPENDS ON / USED BY missing)
- F19: Add ref ID to `throw new Error("getNextCardType: available must not be empty")` (currently no Error Reference System ID)
**Why:** F07 (sev:6) — unfrozen scheduling table corruptible by injected card content in Tauri webview. F11 — getDayOfPhase produces NaN silently on invalid input. F06 prevents silent divergence if thresholds change.
**File:** `lib/introduction.ts`, `tests/introduction.test.ts`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files, multiple behavior fixes
**Blocked by:** #178 (COMPLETE) | **Blocks:** #181
**Test required:** Yes — add test for `getDayOfPhase` with malformed date string (must throw). Tests for F02/F09 cross-day behavior were added in Task #178.
**Done when:** `grep -n "Object.freeze" lib/introduction.ts` shows `MAX_APPEARANCES_BY_PHASE_DAY`. `grep -n "GRADUATION_THRESHOLD\|CONSECUTIVE_WRONG_RESET" lib/introduction.ts` shows constant declarations. Rule 2 header present. All new tests pass. Verification gate green.
**Owner:** Architecture Agent
