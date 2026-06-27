# Stream W1A Task State

### Task #024 | Extract pure functions from app/learn/page.tsx (Rules 15, 1)
**Severity:** 5 | **File(s):** `app/learn/page.tsx:52-71`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/learn/page.tsx, store/srsStore.ts, components/UnitRow.tsx)

Two computations violate Rule 15 (pure classification) and bloat the route beyond 150 lines:
- `levelMastery()` closure (lines 52-61): aggregates mastery across all units in a level. It depends on `cards` and `byLevel` — both available in the store and computed at render time. This is a pure function of `(units: Unit[], progressMap: Record<string, CardProgress>) => number`.
- `currentLevel` IIFE (lines 64-71): derives the highest level with any progress. Pure function of `(levels: Level[], masteryFn: ...) => Level`.

**Changes required:**
1. `store/srsStore.ts` — add exported pure function `levelMasteryPct(units: Unit[], progressMap: Record<string, CardProgress>): number` that performs the same computation as the inline closure.
2. `store/srsStore.ts` — add exported pure function `currentStudyLevel(levels: readonly string[], levelMasteryFn: (lvl: string) => number): string` that derives the current level.
3. `app/learn/page.tsx:52-71` — remove inline `levelMastery` closure and `currentLevel` IIFE. Import and call the store functions instead.
4. `UnitRow` component (lines 242-333, 92 lines) — extract to `components/UnitRow.tsx` (its own file). This is a self-contained component with a clear interface.

**Test required (write first):**
- `tests/srsStore.test.ts` — add: `levelMasteryPct([], {}) === 0`. `levelMasteryPct([unit with 2 cards], progressMap where 1 is mastered) === 50`. `currentStudyLevel` returns the highest level with progress > 0.
- `components/UnitRow.test.tsx` — basic render test (Rule 14): renders unit name, shows due badge when `stats.due > 0`, shows locked state when `unlocked === false`.

**Done condition:** `app/learn/page.tsx` ≤ 150 lines. `components/UnitRow.tsx` exists. `levelMasteryPct` and `currentStudyLevel` are in `store/srsStore.ts` and tested. Verification gate green.

---

### Task #025 | Extract tierLabel dict and Stat component from app/study/page.tsx (Rules 15, 1)
**Severity:** 5 | **File(s):** `app/study/page.tsx:310-315`, `app/study/page.tsx:382-399`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/study/page.tsx, lib/cardLabels.ts, components/Stat.tsx)

- `tierLabel` dict (lines 310-315): defined inline in the render body. Rule 15: a data→UI mapping with more than one key must be a pure tested function (or at minimum a module-level constant). It should be a named export from a lib or the store.
- `Stat` component (lines 382-399): a self-contained UI primitive defined inside the page file. Should be extracted to `components/Stat.tsx`.
- `StudyInner` function is 379 lines — the page file total is 407 lines, well above the 150-line route limit.

**Changes required:**
1. `lib/cardLabels.ts` (NEW FILE — do NOT use lib/srs.ts) — add `export const TIER_LABELS: Record<number, string> = { 1: "Vocabulary", 2: "Grammar", 3: "Phrases", 4: "Sentences" }` as a module-level constant. Export a pure function `tierLabel(tier: number): string` that does `TIER_LABELS[tier] ?? ""`.
2. `app/study/page.tsx:310-315` — remove inline dict, import `tierLabel` from lib/cardLabels.ts.
3. `components/Stat.tsx` — extract the `Stat` function (lines 382-399) into its own file.
4. The session resume state machine (the `useEffect` at lines 97-119 that calls multiple `setState` in sequence) should be extracted into a `useReducer` as the comment at line 95 notes. This will bring the page below 150 lines.

**Test required (write first):**
- `tests/srs.test.ts` — add: `tierLabel(1) === "Vocabulary"`, `tierLabel(4) === "Sentences"`, `tierLabel(99) === ""`.
- `components/Stat.test.tsx` — renders `value` and `label`, applies highlight class when `highlight === true`.

**Done condition:** `app/study/page.tsx` ≤ 150 lines. `TIER_LABELS` is a named constant. `components/Stat.tsx` exists. Verification gate green.
