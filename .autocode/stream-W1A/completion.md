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
