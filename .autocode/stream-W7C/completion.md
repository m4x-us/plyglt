CLOSED: #616
NOT_CLOSED: none

## Summary

Task closed. Read `hooks/useStudyQueueSetup.ts` in full first (Wave 6's Task #612
extraction, read-only reference), then both failing tests in `tests/seam_studyLoop.test.ts`,
before writing anything, per the brief's instruction. Verification gate — all green:
- `npx tsc --noEmit` — clean
- `npm test` — 101 files, 2000 tests passed
- `npm run lint` — 0 errors, 7 pre-existing warnings, none in my file
- Existence-assertion grep gate — clean

`git status` showed only expected, recognizable changes throughout — other streams' concurrent
work on their own owned files (`hooks/useStudySession.ts`/`.test.ts`, `store/srsStore.ts`,
`supabase/functions/.../dispatch.ts`, plus a new untracked `store/resumableSession.ts` from
some other stream's in-progress extraction) and my own single-file change. No `git stash`
used or needed.

Debt entries logged: 0
Carry-forward tasks generated: 0

## Task #616 — the two "page.tsx wiring" tests were pseudocode per Rule 18/B7

**Root cause confirmed by reading, not just trusting the finding:** both tests' own docstrings
claimed to "reconstruct that exact page-level sequence," but both computed
`isInterrupt ? full.slice(0, INTERRUPT_SESSION_CAP) : full` inline in the test body — a
hand-copy of the real slice expression, not an import of it. Deleting the real line in
`app/study/page.tsx` (or, post-#612, in `hooks/useStudyQueueSetup.ts`) would never have failed
either test, since the test carried its own independent copy of the logic.

**Fix:** rewrote both tests to call the real `useStudyQueueSetup` hook via `renderHook`,
exactly as Wave 6's #612 was extracted to enable. For each test:
1. Built a real `Unit` fixture (`{ ...UNIT, cards: <the test's card slice> }`) so
   `useStudyQueueSetup`'s `allUnits`/`unitMap` params receive a real `Unit` shape, not a bare
   card array — the hook's internal `allCards` computation (`isGlobal || isInterrupt ?
   allUnits.flatMap(u => u.cards) : ...`) needed a real `Unit[]` to flatten.
2. Called `renderHook(() => useStudyQueueSetup({...}))` and used its returned
   `initialQueue`/`allCardMap`/`allCards` as what feeds into the subsequent
   `useStudySession` call — no hand-copied slice expression left anywhere in the file.
3. Kept the pre-existing direct `buildQueue(...)` sanity-check calls (proving `full` is
   12-cards-unsliced / 0-cards-starved before the real hook's own slice runs) as independent,
   informational assertions — these already called the real `buildQueue`, so they weren't part
   of the Rule 18 defect; only the SLICE decision that fed `useStudySession` was hand-copied.
4. Rebound the `getNearDueCards` closure to close over `setupResult.current.allCards` (the
   hook's own returned value) instead of the test's separate local variable — the more faithful
   reproduction of how a real `app/study/page.tsx` consuming this hook would bind it.

**Live Deletion Tests run on both** (not traced by hand — `hooks/useStudyQueueSetup.ts` was
read-only reference to me, but the brief explicitly permitted a temporary edit there to prove
the point, reverted before finishing):
1. Test 1 (12-card backlog, cap scenario): temporarily changed
   `return isInterrupt ? full.slice(0, INTERRUPT_SESSION_CAP) : full;` to `return full;` (cap
   removed). Re-ran — failed exactly as expected (`initialQueue` had length 12, not 8).
2. Test 2 (10-card starved scenario, floor-fill via near-due): first tried inverting the
   `isInterrupt` condition on the SAME slice line — this did NOT fail the test, because in the
   starved scenario `full` is already `[]`, so both branches of the ternary evaluate to the
   same empty array (a genuinely uninformative mutation for this specific test's inputs, not a
   test weakness). Switched to a mutation the test's near-due-pool assertion actually depends
   on: inverted the `allCards` `useMemo`'s `isGlobal || isInterrupt` condition (which
   determines whether `allCards` comes from the full cross-unit catalog or a single unit's
   cards). Re-ran — failed exactly as expected (`result.current.queue` had length 0, not 6,
   since the near-due pool the fill step reads from was now empty).
3. Restored `hooks/useStudyQueueSetup.ts` from the saved copy after each attempt; `git diff`
   on that file is empty — confirmed byte-identical to its state before I started.
4. Re-ran the full file after final restoration — all 9 tests pass.

**Note on the Deletion Test process:** the first mutation I tried for test 2 (inverting
`isInterrupt` on the slice line) didn't catch anything — a useful reminder that "the mutation
didn't fail the test" doesn't always mean the test is weak; sometimes it means that specific
mutation is a no-op for that test's specific input shape. I switched mutation targets rather
than concluding the test needed further strengthening, and the second mutation (on the logic
the test's assertions actually exercise) confirmed the rewrite is sound.

## Note on `scripts/deep-audit.sh`

Still does not exist in this repo (same finding as every prior wave's stream) — substituted the
real Verification Gate as the task's own acceptance criteria instructed.
