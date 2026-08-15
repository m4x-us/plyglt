CLOSED: #534 #552 #542 #553 #557 #543 #537 #555 #556 #559
NOT_CLOSED: none

## Summary

All 10 tasks closed. Verification gate (whole repo, not just owned files) — all green:
- `npx tsc --noEmit` — clean, zero errors
- `npm test` — 101 files, 1950 tests passed
- `npm run lint` — 0 errors, 7 pre-existing warnings (none in files I touched)
- `npm test -- --coverage` — exit 0, all four thresholds (lines=84, funcs=79, branches=81, stmts=82) met
- Existence-assertion grep gate — clean on all files I touched

Debt entries logged: 0
Carry-forward tasks generated: 0

## Note on `scripts/deep-audit.sh`

Every task's acceptance criteria references `bash scripts/deep-audit.sh <file>` — this script
does not exist anywhere in the repo (confirmed via `find . -iname "deep-audit*"`, empty
result). I substituted the project's real Verification Gate (tsc, full test suite, lint,
existence-assertion grep, coverage) for each task instead, plus a manual Deletion Test
(temporarily reverting each fix and confirming the relevant test(s) fail) for every test-only
task. Flagging this for Max/the orchestrator in case `deep-audit.sh` is expected tooling that
never got committed.

## Barry's hooks/useStudySession.ts WIP (Task #543 spillover)

Barry's stream (W1B, this same wave) was mid-edit on `hooks/useStudySession.ts` (off-limits
to me) implementing #538 (stranded-pause bypass fix) and #551 (INTERRUPT_FLEX_DAILY_MAX bound
on the flex daily ceiling) when I reached #543. His `.autocode/stream-W1B/completion.md` was
stale (dated 2026-08-13, task #523 — a prior wave, not this one), so no test-case notes were
available yet. Rather than wait, I read his uncommitted diff directly to understand the real
fix intent and updated the one test his change legitimately broke:

- **"flexes past the daily cap when isInterrupt and the session would otherwise be empty"**
  (hooks/useStudySession.test.ts) — its `canIntroduceNewCard: vi.fn(() => false)` mock
  couldn't distinguish "daily cap used, not stranded" (should still flex) from "stranded"
  (should not) — it returned false unconditionally for both the normal AND the new
  flex-bound check `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`. Fixed the mock to
  discriminate on whether `maxPerDay` was passed, and corrected the assertion count (3 calls,
  not 1 — the test's 3-card CARD_MAP pool exhausts before the 6-card floor or the 3-card
  MAX_NEW cap would otherwise stop it).

This was necessary to keep the Verification Gate green at the end of my own stream — a failing
test blocks `npm test`, a stop-the-line condition per AGENTS.md — and squarely matches the
brief's anticipated "if Barry hasn't finished yet, add what you can" instruction. If Barry's
own eventual completion.md lists additional test-case requests beyond this one, the next wave
should reconcile against his real diff (`git log`/`git diff` on `hooks/useStudySession.ts`)
rather than assume this note captures everything — I only fixed the one test that was actively
failing at the time I ran the suite; I did not attempt to preemptively guess every test case
his still-in-progress #538/#541/#551/#561 work might eventually need.

## Task-by-task notes

- **#534** — `components/InterruptHandler.tsx`'s passive-notification body now floors
  `totalDue` to `INTERRUPT_SESSION_FLOOR` (imported from `lib/queue.ts`) before building the
  notification string, mirroring the server push path. Updated the 3 stale assertions in
  `InterruptHandler.test.tsx` (previously "1 card ready", now "6 cards ready" given the test
  fixture's mocked `getStats().due: 1`).
- **#552** — Added `allCards` (and, since removing the `eslint-disable` fully, the store
  action deps `getDueCards`/`getNewCards`/`getIntroductionDueCardIds`) to `initialQueue`'s
  `useMemo` deps in `app/study/page.tsx`. `unitId` dropped from the array — it was already
  redundant once `allCards` (which itself depends on `unitId`) is a dep, and ESLint flagged it
  as unnecessary. Added a regression test proving `initialQueue` (captured via a new
  `mockUseStudySession` spy) recomputes once `ALL_UNITS` transitions from empty to populated
  mid-test — confirmed via a manual revert-and-rerun that the test fails without the fix.
- **#542** — Documentation-only per the task's own stated minimal-fix option: added a comment
  on the `getNearDueCards` binding in `app/study/page.tsx` documenting the current cost
  (full-catalog scan, up to 4x/mount) and a revisit trigger (~100K cards or profiling
  evidence). No behavior change.
- **#553** — Refactored `useLangPack`'s mock in `app/study/page.test.tsx` from a hardcoded
  return to a mutable `langPackState` object so `loading`/`units`/`unitMap` can transition
  mid-test. Added a test proving the page shows the loading screen while `packLoading` is
  true (never "Nothing ready.") and the real queue once loading completes — confirmed via
  revert-and-rerun that removing the `packLoading` gate breaks this test.
- **#557** — `INTERRUPT_SESSION_CAP` in `app/study/page.test.tsx`'s `@/lib/queue` mock now
  comes from `vi.importActual` instead of a hardcoded literal `8`. Added a test asserting a
  10-card `buildQueue` result gets sliced to exactly 8 in interrupt mode — confirmed via
  revert-and-rerun.
- **#543** — Three deliverables: (1) added `getNearDueCards: () => []` to
  `InterruptHandler.test.tsx`'s `srsStore` mock (confirmed `hooks/useInterruptConfig.ts`'s
  `computeDue` does call it — this closes a real, previously-incidental safety gap). (2) New
  seam test in `tests/seam_studyLoop.test.ts` wiring the REAL `useStudySession` hook against
  REAL `store/srsStore.ts` actions (no mocked `getNearDueCards`/`canIntroduceNewCard`) via
  `renderHook`, proving the interrupt floor-fill reaches the real `INTERRUPT_SESSION_FLOOR`
  (6) using real near-due `CardProgress` records seeded directly into the store — confirmed
  load-bearing via revert-and-rerun. (3) The Barry-WIP test fix described above, which is a
  direct consequence of exercising this same fill pipeline.
- **#537** — Renamed the stale-titled test (previously implying "non-empty queue always
  blocks flex") to accurately describe what it proves: canIntroduceNewCard denying the flex
  check with no near-due cards available, not queue-non-emptiness itself.
- **#555** — `toBeGreaterThanOrEqual(1)` → `toBe(1)` for the single-card, single-`handleRate`-
  call scenario where the exact value is provable. Also tightened the test title from "≥ 1"
  to "=== 1" to avoid immediately reintroducing #537's exact failure mode.
- **#556** — "tops up a 4-card interrupt queue to 6" now asserts the exact 6-id array
  (`["d1","d2","d3","d4","n1","n2"]`) instead of `toHaveLength(6)`, mirroring its sibling
  "fills an empty interrupt session to exactly 6" test.
- **#559** — Added a new test isolating the one scenario the outer `setQueue` filter
  structurally cannot catch: a card introduced via the flex-new-card path earlier in the SAME
  effect pass (present in `sessionIds`/`added` but not yet in `prev`, since `prev` is the
  queue state from BEFORE this effect ran) that also appears in `getNearDueCards`'s return.
  Manually traced the production code path by hand before writing the test, then verified via
  revert-and-rerun: deleting the loop-level `if (sessionIds.has(card.id)) continue;` check
  makes the NEW test fail (queue contains "dual" twice, 7 cards not 6) while the PRE-EXISTING
  "never duplicates a near-due card that is already in the queue" test still passes unchanged
  — concrete proof the old test never exercised the loop-level check, and the new one does.
  Kept the old test (it documents a real, valid scenario) and added the new one alongside it
  rather than replacing it, since the task's own decision criterion ("if the outer filter
  genuinely always covers every case... the loop-level check may be redundant") turned out
  false — the loop-level check IS load-bearing, just not provably so by the original test.

## Architecture/process notes for the next wave

- `app/study/page.test.tsx`'s mock structure changed shape (added `mockUseStudySession` and
  `mockBuildQueue` spies, `langPackState` mutable object, `vi.importActual` for
  `INTERRUPT_SESSION_CAP`) — any future test added to this file that needs to inspect what
  `app/study/page.tsx` actually passed into `useStudySession()` should use
  `mockUseStudySession.mock.calls`, not add a new ad-hoc mechanism.
- Every fix in this stream was verified with a manual Deletion Test (temporarily reverting the
  production fix or the loop-level check, confirming the relevant test(s) fail, then
  restoring) — not just "the test passes," per this project's Rule 16/Rule 18 conventions.
