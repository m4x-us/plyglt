# Adam — Stream W1A — Wave 1 — 2026-06-26

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W1A | #024 #025

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #024  — Extract pure functions from app/learn/page.tsx (Rules 15, 1)
2. /task #025  — Extract tierLabel dict and Stat component from app/study/page.tsx (Rules 15, 1)

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W1A
[✓] #024 — Extract pure functions from app/learn/page.tsx   ← done
[→] #025 — Extract tierLabel dict and Stat component         ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
app/learn/page.tsx
store/srsStore.ts
components/UnitRow.tsx          ← new file to create
app/study/page.tsx
lib/cardLabels.ts               ← new file to create (NOT lib/srs.ts — see critical note below)
components/Stat.tsx             ← new file to create

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/settings/page.tsx           ← W1B owns this
components/settings/Section.tsx ← W1B owns this
components/settings/Toggle.tsx  ← W1B owns this
hooks/useExportImport.ts        ← W1B owns this
hooks/useLicenseActivation.ts   ← W1B owns this
lib/exportBackup.ts             ← W1B owns this
lib/srs.ts                      ← W1C owns this (critical — do not touch)
lib/answerCheck.ts              ← W1C owns this
lib/language.ts                 ← W1C owns this
components/StudyCard.tsx        ← W1C owns this
lib/featureFlags.ts             ← W1D owns this
next.config.ts                  ← W1D owns this
components/InterruptHandler.tsx ← W1D owns this

## CRITICAL NOTE — MUST READ BEFORE STARTING #025
For Task #025, the TIER_LABELS constant and tierLabel() function MUST go in lib/cardLabels.ts.
Do NOT put them in lib/srs.ts. W1C (another window) is simultaneously refactoring lib/srs.ts —
if you write to lib/srs.ts and they write to lib/srs.ts, the merge will be broken.
lib/cardLabels.ts is a new file that you own. Create it.

## Task Definitions

### Task #024 | Extract pure functions from app/learn/page.tsx (Rules 15, 1)
**Severity:** 5 | **File(s):** `app/learn/page.tsx` (334 lines — currently over 150-line Rule 1 limit)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/learn/page.tsx, store/srsStore.ts, components/UnitRow.tsx)

Two computations violate Rule 15 (pure classification) and bloat the route beyond 150 lines:
- `levelMastery()` closure (lines ~52-61): aggregates mastery across all units in a level. It depends on `cards` and `byLevel` — both available in the store. Pure function of `(units: Unit[], progressMap: Record<string, CardProgress>) => number`.
- `currentLevel` computation (lines ~64-71): derives the highest level with any progress. Pure function of store state.

**Changes required:**
1. `store/srsStore.ts` — read the current file first (it was modified in prior wave). Add exported pure function `levelMasteryPct(units: Unit[], progressMap: Record<string, CardProgress>): number` that performs the same computation as the inline closure.
2. `store/srsStore.ts` — add exported pure function `currentStudyLevel(levels: readonly string[], masteryFn: (lvl: string) => number): string` that derives the current level.
3. `app/learn/page.tsx:52-71` — remove inline `levelMastery` closure and `currentLevel` IIFE. Import and call the store functions instead.
4. `UnitRow` component (lines ~258-333, 75+ lines) — extract to `components/UnitRow.tsx`. Self-contained with clear interface.

**Test required (write first):**
- `tests/srsStore.test.ts` — add: `levelMasteryPct([], {}) === 0`. `levelMasteryPct([unit with 2 cards], progressMap where 1 is mastered) === 50`. `currentStudyLevel` returns highest level with progress > 0.
- `components/UnitRow.test.tsx` — render test (Rule 14): renders unit name, shows due badge when `stats.due > 0`, shows locked state when `unlocked === false`.

**Done condition:** `app/learn/page.tsx` ≤ 150 lines. `components/UnitRow.tsx` exists. `levelMasteryPct` and `currentStudyLevel` exported from `store/srsStore.ts` and tested. Verification gate green.

---

### Task #025 | Extract tierLabel dict and Stat component from app/study/page.tsx (Rules 15, 1)
**Severity:** 5 | **File(s):** `app/study/page.tsx` (409 lines — 2.7× the 150-line rule limit)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/study/page.tsx, lib/cardLabels.ts, components/Stat.tsx)

- `tierLabel` dict (lines ~310-315): defined inline in the render body. Rule 15: a data→UI mapping with more than one key must be a pure named constant or function at module scope or in lib/.
- `Stat` component (lines ~382-399): a self-contained UI primitive defined inside the page file.
- The page file at 409 lines is well above the 150-line route limit.

**Changes required:**
1. `lib/cardLabels.ts` (NEW FILE — YOUR FILE, do NOT use lib/srs.ts):
   ```ts
   export const TIER_LABELS: Record<number, string> = {
     1: "Vocabulary",
     2: "Grammar",
     3: "Phrases",
     4: "Sentences",
   };
   export function tierLabel(tier: number): string {
     return TIER_LABELS[tier] ?? "";
   }
   ```
2. `app/study/page.tsx:310-315` — remove inline dict, import `tierLabel` from lib/cardLabels.ts.
3. `components/Stat.tsx` — extract the `Stat` function (lines ~382-399) into its own file.
4. Extract session resume state machine (`useEffect` at lines ~97-119 that calls multiple `setState` in sequence) into a `useReducer` or a custom hook. This brings the page below 150 lines.

**Test required (write first):**
- `tests/cardLabels.test.ts` — `tierLabel(1) === "Vocabulary"`, `tierLabel(4) === "Sentences"`, `tierLabel(99) === ""`.
- `components/Stat.test.tsx` — renders `value` and `label`, applies highlight class when `highlight === true`.

**Done condition:** `app/study/page.tsx` ≤ 150 lines. `lib/cardLabels.ts` exists with named exports. `components/Stat.tsx` exists. Verification gate green.

## Prior Wave Changes — Read Before Starting
These files were modified in Batch 2 Wave 1 by other streams. Read current state before writing.

**store/srsStore.ts** (modified by Batch 2 W1B — #022 and #023):
- `commitSession` action added: single `set()` call combining `rateCard + saveActiveSession + touchStreak` (atomicity poka-yoke)
- `rateCardAndSaveSession(cardId, rating, session)` added as the public API for session rating
- `ActiveSession` type added: `{ unitId, queueIds, position, sessionCorrect, sessionTotal, startedAt }`
- Read `store/srsStore.ts` in full before adding `levelMasteryPct` and `currentStudyLevel` — slot them in at module scope after the existing selectors without duplicating any imports.

## Agent Memories

### Architecture Agent Memory (first 150 lines)

---
agent: architect
last-updated: 2026-06-26
---

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2.

**Layer structure (top → bottom):**
- `app/` — Route pages (must stay ≤ 150 lines)
- `components/` — UI components with co-located `.test.tsx`
- `hooks/` — React hooks
- `store/` — Zustand stores. Key: `srsStore.ts` (9 importers)
- `lib/` — Pure utilities. Key: `srs.ts` (11 importers — highest blast radius)

**Blast-radius ranking:**
1. `lib/srs.ts` — 11 importers
2. `lib/langRegistry.ts` — 10 importers
3. `store/srsStore.ts` — 9 importers

**Recurring Patterns:**
- Oversized route files: pages accumulate business logic and inline components
- Inline data→UI mappings in render body — should be module-level named constants
- No test co-location: zero components have `.test.tsx` siblings

**Open findings relevant to your tasks:**
- `app/learn/page.tsx:52-71` Rule 15: `levelMastery()` closure and `currentLevel` IIFE in component body
- `app/learn/page.tsx:258-329` Rule 15: `UnitRow` multi-branch classname expression inline
- `app/study/page.tsx:310-315` Rule 15: `tierLabel` dict defined in render body
- `app/study/page.tsx:382-399` no co-located `.test.tsx` for Stat primitive

## When You Finish
Write your completion summary to .autocode/stream-W1A/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W1A | #024 #025
