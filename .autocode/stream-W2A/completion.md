CLOSED: #536
NOT_CLOSED: none

## Summary

Task #536 was a Rule 13 seam-test gap: `app/study/page.tsx`'s own `initialQueue`
computation (`buildQueue(allCards, ...)` then `.slice(0, INTERRUPT_SESSION_CAP)`,
lines 60-64) and its `getNearDueCards: (limit) => getNearDueCards(allCards, limit)`
closure binding (line 80) were never exercised together against a real store — Wave 1's
`tests/seam_studyLoop.test.ts` addition (Task #543, Charles's stream) proved the
hook-to-store seam (`useStudySession` → real `srsStore` actions) but hardcoded
`initialQueue: []` and bound `getNearDueCards` over a hand-picked subset, never calling
`buildQueue` at all.

Read Charles's test first per the brief's instruction, then extended
`tests/seam_studyLoop.test.ts` (no new file needed) with a new describe block —
`"seam: app/study/page.tsx wiring (buildQueue -> INTERRUPT_SESSION_CAP slice ->
useStudySession) — real store"` — containing two tests that reconstruct
`app/study/page.tsx`'s exact wiring one layer further out than Charles's test:

1. **Backlog/cap test** — 12 real cards, all FSRS-due. Calls the real `buildQueue(allCards,
   store.getDueCards, store.getNewCards, isGlobal || isInterrupt,
   store.getIntroductionDueCardIds)` (proving it returns all 12, unsliced), then applies
   the real `.slice(0, INTERRUPT_SESSION_CAP)` exactly as page.tsx does, then feeds that
   into a real `useStudySession` call. Asserts the resulting session queue is capped at
   `INTERRUPT_SESSION_CAP` (8) with no flex-fill triggered (already at/above the floor).
2. **Starved/floor-fill test** — 10 real cards, all with progress but none due (near-due
   pool, staggered `dueDate`). `buildQueue` genuinely returns empty (globalMode blocks
   new-card selection inside buildQueue itself, no due cards, no introductions) — the
   real cold-start/backlog-return scenario the interrupt floor exists for. Feeds the
   resulting empty `initialQueue` into a real `useStudySession` call whose
   `getNearDueCards` closure is bound over the SAME `allCards` array used for `buildQueue`
   (not a pre-trimmed stand-in, unlike Charles's test) — the actual page.tsx:80 binding
   shape. Asserts the session fills to `INTERRUPT_SESSION_FLOOR` (6) with the 6
   nearest-due cards out of the 10-card pool, proving the real store's
   nearest-due-first sort ran against the full pool the page-level closure exposes.

No change was needed to `app/study/page.tsx` itself — this was purely a missing-test
gap, not a functional bug (the Deletion Test below confirms the real wiring is correct
as shipped).

## Deletion Test (Rule 13/20 requirement)
Temporarily changed `lib/queue.ts`'s `INTERRUPT_SESSION_CAP` from 8 to 20 (reverted
immediately after, `git diff` confirms zero residual change) and re-ran the new tests:
the backlog/cap test failed exactly as expected (`expected [...] to have a length of 20
but got 12`), proving the test exercises the real constant and the real slice logic, not
a duplicated/hardcoded expectation.

## Verification
- `npx tsc --noEmit` — clean
- `npm test` — 1952/1952 passed (101 files) — full suite green, including all other
  streams' concurrent changes already in the working tree
- `npm run lint` — 0 errors (7 pre-existing warnings, none in files this stream touched)
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again this wave) —
  substituted the real Verification Gate as instructed in the brief's acceptance
  criteria override
- `git status` confirms only `tests/seam_studyLoop.test.ts` changed within this stream's
  file ownership (`app/study/page.tsx` untouched, no off-limits files touched)

Debt entries logged: 0
Carry-forward tasks generated: 0
