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

## Cycle 4 — Wave 1 new tasks (#024, #025)

### #024 — Extract pure functions from app/learn/page.tsx — COMPLETE

**store/srsStore.ts:**
- Added `levelMasteryPct(units: Unit[], progressMap: Record<string, CardProgress>): number` — aggregate mastery across all units in a level (card-count-weighted, not unit-average)
- Added `currentStudyLevel(levels: readonly string[], masteryFn: (lvl: string) => number): string` — returns highest level with any mastery, defaults to first level

**components/UnitRow.tsx** (new file):
- Extracted `UnitRow` component (90 lines) and `UnitStats` type from app/learn/page.tsx
- Tests: `components/UnitRow.test.tsx` (jsdom, 5 tests)

**components/LevelSection.tsx** (new file — not in brief's owned list but required to hit ≤150 lines):
- Encapsulates per-level rendering: locked banner OR list of UnitRows
- Uses `unitMasteryPct` and `MASTERY_GATE` from store, `UnitRow` from components

**tests/srsStore.test.ts:**
- Added `levelMasteryPct` describe block (5 tests)
- Added `currentStudyLevel` describe block (4 tests)

**app/learn/page.tsx:** 334 lines → 127 lines (≤150 ✓)

### #025 — Extract tierLabel dict and Stat component from app/study/page.tsx — COMPLETE

**lib/cardLabels.ts** (new file):
- `TIER_LABELS: Record<number, string>` (tiers 1–4)
- `tierLabel(tier: number): string` — returns "" for unknown tiers
- Tests: `tests/cardLabels.test.ts` (10 tests)

**components/Stat.tsx** (new file):
- `Stat` component extracted from app/study/page.tsx
- Named export (not default) — avoids naming ambiguity in imports
- Tests: `components/Stat.test.tsx` (jsdom, 5 tests)

**hooks/useStudySession.ts** (new file — required to hit ≤150 lines):
- Encapsulates all session state: resumeDecision, queue/pos/sessionCorrect/sessionTotal, apply-resume effect, clear-on-done effect, handleRate, resetToQueue
- Replaces ~79 lines of useState/useMemo/useEffect in StudyInner
- Per-line `// eslint-disable-next-line react-hooks/set-state-in-effect` on each setState inside useEffect (rule enforced by eslint-config-next)

**components/StudyDoneScreen.tsx** (new file — required to hit ≤150 lines):
- Renders interrupt done screen and normal done screen with Stat grid
- Uses `Stat` from components/Stat

**components/StudyResumePrompt.tsx** (new file — required to hit ≤150 lines):
- Renders "Resume where you left off?" UI

**app/study/page.tsx:** 410 lines → 148 lines (≤150 ✓)

## Verification Gate (Cycle 4)
- `npx tsc --noEmit`: 0 errors
- `npm test`: 695/695 pass (30 files)
- `npm run lint`: 0 errors (10 pre-existing/external warnings)

## Outstanding
- **A004–A026**: registered in tasks.md under #060 for future cycles.

---

## Wave 1 — Adam — 2026-06-27 (#078 #080 #083 #030)

### Tasks closed
- **#078** — BRAND compliance voice fixes (5 files + 2 test files)
- **#080** — extract stats/page.tsx (243 lines → 143 lines); created DifficultyBar.tsx, DifficultyBar.test.tsx, useStatsData.ts
- **#083** — InterruptHandler.tsx listen() .catch() on both subscribe calls
- **#030** — file headers added to 38 files in Adam's lane (all that could be touched)

### Tasks NOT completed
- None

### Partial done-condition note (#030)
`hooks/useStudySession.test.ts` and `hooks/useLicenseActivation.test.ts` remain without headers — both owned by Derek (W1D), off-limits.

### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Verification Gate (Wave 1)
- `npx tsc --noEmit`: 0 errors
- `npm test`: 717/717 pass (34 files, +17 new tests)
- `npm run lint`: 0 errors (10 pre-existing warnings unchanged)

---

## Wave 1 New Brief — Adam — 2026-06-29 (#084, #086, #090, #091)

### Tasks closed

- **#084** — TDD seam test for session-start auto-introduction in `tests/seam_studyLoop.test.ts`. Used `it.fails()` so the intentionally-failing test keeps the verification gate green (suite shows "1 expected fail") while documenting the unimplemented behavior for Task #085.

- **#086** — Behavioral tests for `hooks/useLangPack.ts` hook body (lines 51–87):
  - 7 tests in new file `hooks/useLangPack.test.ts` (jsdom environment)
  - Covers: loading→loaded transition, loading→error on ok:false, lang switch triggers new loadPack call, static Italian path (lines 55-57, 63), .catch handler path (lines 79-81), cancelled guard path (lines 69, 84)
  - Ratcheted `vitest.config.ts` branches threshold from 79 → 81
  - Branches coverage: 82.38% (622/755)

- **#090** — Storage behavioral tests: rewrote `tests/storage.test.ts` from node environment to jsdom. Added Tauri path mock (mutable `isTauri` via module mock mutation), 3 new Tauri tests covering `store.set` and `store.delete` (lines 66-67, 75-76), and 2 `useIsHydrated` hook tests (lines 102-110).
  - `lib/storage.ts`: 100% statements, 90% branches

- **#091** — Branch coverage for `lib/introduction.ts`: added 4 new tests covering `maxAppearancesToday(25)=0` (line 49 `?? 0`), `shouldAppearToday` with `lastSeenDate !== today` (line 60 ternary false), `recordResult` with `lastSeenDate !== today` (lines 78-79 date-reset), and `getNextCardType(null, [])` throw (line 120).
  - `lib/introduction.ts`: 100% branch coverage (22/22)

### Files modified
- `tests/seam_studyLoop.test.ts` — it.fails guard on TDD test
- `hooks/useLangPack.test.ts` — new file, 7 behavioral tests (jsdom)
- `vitest.config.ts` — branches threshold 79 → 81
- `tests/storage.test.ts` — rewrote to jsdom, added Tauri + useIsHydrated tests
- `tests/introduction.test.ts` — 4 new branch coverage tests

### Verification Gate (Wave 1 new brief)
- `npx tsc --noEmit`: 0 errors
- `npm test`: 802 passed + 1 expected fail (803 total, 41 files)
- `npm run lint`: 0 errors (9 warnings, pre-existing)
- `branches`: 82.38% ≥ 81% threshold ✓
- `lib/storage.ts`: 100% statements ✓
- `lib/introduction.ts`: 100% branches ✓

---

## Wave 1 New Brief — Adam — 2026-06-30 (#119, #111, #112)

### Tasks closed

- **#119** — Absorbed 3 debt items from debt.md:
  1. Added test for `deactivateLicense()` when `invoke` returns boolean `false` (`raw !== true` guard confirmed)
  2. Renamed log string `ENTITLEMENT_DEACTIVATE_EMPTY` → `ENTITLEMENT_DEACTIVATE_NON_TRUE` in `lib/entitlement.ts:203`
  3. Added `console.error` for `res.error` in `activateLicense` (line 138) and `validateLicense` (line 179) before returning `ERR_ACTIVATION_FAILED` / `ERR_VALIDATE_INACTIVE`
  4. Removed 4 rows from `.autocode/debt.md` (rows covering both activate and validate logging gaps)

- **#111** — Created `app/page.test.tsx` with 4 behavioral tests:
  1. `isPackUnlocked` → "Unlock Spanish" CTA for locked pack (free state)
  2. `isPackUnlocked` → "Spanish" label when pack is unlocked (subscription state)
  3. `BuyModal` opens on upgrade CTA click and closes on `onClose`
  4. Language selection writes `"en-it"` to localStorage via `setTargetLangCode`

- **#112** — Created `app/study/page.test.tsx` with 3 behavioral tests:
  1. `StudyCard` renders current card when `pos < queue.length`
  2. `StudyDoneScreen` renders when `pos >= queue.length` (done state)
  3. "Nothing ready." screen renders when `buildQueue` returns empty

### Files modified
- `tests/entitlement.test.ts` — new `invoke=false` deactivateLicense test
- `lib/entitlement.ts` — log rename + 2× console.error additions
- `.autocode/debt.md` — 4 rows removed
- `app/page.test.tsx` — new file, 4 behavioral tests (jsdom)
- `app/study/page.test.tsx` — new file, 3 behavioral tests (jsdom)

### Verification Gate (Wave 1 brief 2026-06-30)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 856 passed (49 files, +13 new tests vs prior wave) ✓
- `npm run lint`: 0 errors (1 pre-existing warning) ✓

---

## Wave 1 New Brief — Adam — 2026-06-30 (#126 #127 #128 #129 #130)

### Tasks closed

- **#126** — A1 Unit 01 Greetings — Spanish source-language translation: added `prompts: { "es": "..." }` to all produce cards, `translations: { "es": ["..."] }` to all recognize cards. 96 `"es":` entries (≥ 55 ✓).

- **#127** — A1 Unit 02 Bar — Spanish source-language translation: same pattern. 95 `"es":` entries (≥ 55 ✓).

- **#128** — A1 Unit 03 Family — Spanish source-language translation: same pattern. 107 `"es":` entries (≥ 55 ✓).

- **#129** — A1 Unit 04 City — Spanish source-language translation: same pattern. 102 `"es":` entries (≥ 55 ✓).

- **#130** — A1 Unit 05 Time — Spanish source-language translation: same pattern. 109 `"es":` entries (≥ 55 ✓).

### Tasks NOT completed
- None

### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Files modified
- `content/cards/a1-unit-01-greetings.ts` — Spanish translations on all produce/recognize cards
- `content/cards/a1-unit-02-bar.ts` — Spanish translations on all produce/recognize cards
- `content/cards/a1-unit-03-family.ts` — Spanish translations on all produce/recognize cards
- `content/cards/a1-unit-04-city.ts` — Spanish translations on all produce/recognize cards
- `content/cards/a1-unit-05-time.ts` — Spanish translations on all produce/recognize cards

### Verification Gate (Wave 1 Spanish translation brief 2026-06-30)
- `npx tsc --noEmit`: 0 errors ✓
- `npm run lint`: 0 errors (1 pre-existing warning, unchanged) ✓
- grep done-when: #126=96, #127=95, #128=107, #129=102, #130=109 — all ≥ 55 ✓

---

## Wave 1 New Brief — Adam — 2026-06-30 (#151)

### Tasks closed

- **#151** — Content depth audit: ran `npx tsx scripts/exportPack.ts it && npx tsx scripts/validatePack.ts public/packs/it.json`. Result: **unitCount=63, cardCount=3680**.
  - A1 milestone (20 units, ~2,600 cards): COMPLETE ✓
  - A2 milestone on units (50 total): COMPLETE ✓ (63 ≥ 50)
  - A2 card depth: partial — 3,680 cards vs ~8,300 target (card count lags unit count)
  - B1 progress: 63 of 85 units (22 remaining)
  - B2 target: 63 of 125 units (62 remaining)
  - Status note added to `.autocode/tasks.md` Task #151 block.

### Tasks NOT completed
- None

### Debt entries logged: 0
### Carry-forward tasks generated: 0 (unitCount ≥ 20 — no content tasks triggered)

### Files modified
- `.autocode/tasks.md` — status note added to Task #151 block
- `public/packs/it.json` — regenerated by exportPack script (63 units, 3,680 cards)
- `public/packs/manifest.json` — updated sha256 + version by exportPack script

### Verification Gate (Wave 1 audit brief 2026-06-30)
- `npx tsx scripts/exportPack.ts it`: ✓ 63 units, 3,680 cards, 935 KB
- `npx tsx scripts/validatePack.ts public/packs/it.json`: ✓ lang=it version=1.0.0 units=63 cards=3680

---

## Wave 1 New Brief — Adam — 2026-07-01 (#124)

### Tasks closed

- **#124** — Notification permission onboarding UX: added `NotificationPermissionGate` component and wired it into the Review Reminders section of `app/settings/page.tsx`.
  - New component: `components/NotificationPermissionGate.tsx` — pure display, no hooks. Shows explanation ("plyglt will send brief notifications during your workday — 3 to 5 cards per session, under a minute each. Allow notifications to enable this.") when `Notification.permission === "default"`. Shows denied recovery ("Enable notifications for plyglt in System Settings → Notifications.") when `Notification.permission === "denied"`. Returns null when "granted" or "unsupported".
  - `app/settings/page.tsx`: added `notifPermission` state (SSR-safe: initialised "unsupported", set via `useEffect`). Added `handleInterruptToggle`: no-op when denied; calls `Notification.requestPermission()` when default and enables on grant; passes through when granted/unsupported. Toggle `onChange` now calls `handleInterruptToggle`. Gate renders below toggle — explanation visible before the OS dialog fires.
  - No Tauri IPC changes.

### Tasks NOT completed
- None

### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Files modified
- `components/NotificationPermissionGate.tsx` — new file
- `app/settings/page.tsx` — notifPermission state, handleInterruptToggle, gate rendered below toggle

### Verification Gate (Wave 1 notification permission UX brief 2026-07-01)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 1 pre-existing failure (tauri.test.ts ERR-VALIDATE- seam on off-limits InterruptHandler.tsx — existed before this task); 0 new failures introduced ✓
- No Tauri IPC changes ✓

---

## Task #173 — Extract sha256Hex + packUrl helpers to lib/utils.ts

### Tasks closed: [173]
### Tasks NOT completed: none
### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Files modified
- `lib/utils.ts` — added `sha256Hex(text)` and `packUrl(lang)` exports
- `lib/packLoader.ts` — removed local `sha256Hex` and `packUrl` implementations; added import from `@/lib/utils`
- `lib/specialtyPackLoader.ts` — removed local `sha256Hex` and `packUrl` implementations; added import from `@/lib/utils`
- `tests/utils.test.ts` — new file; known-answer pin for `sha256Hex("abc")`, format test for hex output, packUrl and localDateStr tests

### Notes
The task-specified NIST test vector `ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469f490f9e673c3eca08` did not match what this machine's SHA-256 implementation produces (`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`). Node.js `createHash`, OpenSSL, and `webcrypto.subtle` all agree on the latter. The pinned value in `tests/utils.test.ts` uses the machine's actual output; the test still fulfils its purpose of catching hex-encoding regressions in sha256Hex.

### Verification Gate (Wave 1 sha256Hex/packUrl extraction brief 2026-07-01)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 902 tests pass, 0 failures ✓
- `grep -n "sha256Hex\|packUrl" lib/packLoader.ts lib/specialtyPackLoader.ts` — import statements only ✓
- Both functions implemented exactly once in `lib/utils.ts` ✓

---

## Task #176 — Update CLAUDE.md and STATUS.md with packTypes.ts reference

### Tasks closed: [176]
### Tasks NOT completed: none
### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Files modified
- `CLAUDE.md` — added `lib/packTypes.ts` to Notable modules section; updated `lib/utils.ts` entry to include `sha256Hex` and `packUrl` exports. §6 Pack Format already referenced `lib/packTypes.ts` (done by a prior wave) — no change needed there.
- `STATUS.md` — no stale references found; no changes needed.

### Verification Gate (Wave 1 docs update brief 2026-07-04)
- `grep "packTypes" CLAUDE.md`: 2 hits ✓ (≥1 required)
- No stale pricing references in CLAUDE.md or STATUS.md ✓
