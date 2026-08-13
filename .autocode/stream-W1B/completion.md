CLOSED: #523
NOT_CLOSED: none

## Task #523 — Fix computeDue() to count introduction/new cards

**What changed:** `hooks/useInterruptConfig.ts`'s `computeDue()` previously only summed
`getStats(unitCards).due` (FSRS reviews with `reps > 0 && isDue`). It now also counts:
- Cards due for their next intensive-introduction-cadence appearance
  (`getIntroductionDueCardIds(today)`, filtered to card ids actually present in the
  passed-in units, so a stray id from a different language pack never inflates the count).
- At most **one** qualifying new/untouched card (`getNewCards`), and only when
  `canIntroduceNewCard(today)` is true — matching the real one-new-card-per-day cap the
  introduction engine enforces (`store/srsStore.ts`'s `canIntroduceNewCard`, consumed by
  `hooks/useStudySession.ts`'s session-start introduction effect). Deliberately capped at 1
  rather than summing every unit's full new-card pool — the pool can be huge (curriculum is
  ~30k cards) and only one new card is ever actually introduced per day regardless of how
  many units have eligible candidates.

This closes the gap `docs/INTERRUPT_ARCHITECTURE.md` §2 describes: on a day with zero
traditional FSRS reviews due but an introduction-phase card needing its next appearance (or
a fresh new-card slot open), the interrupt engine previously computed `totalDue === 0` and
silently never fired — breaking BRAND.md's "appears every interrupt on Day 1" cadence
promise for that day.

**Files touched:**
- `hooks/useInterruptConfig.ts` — the fix itself (owned file)
- `hooks/useInterruptConfig.test.ts` — new test file, 9 cases (owned file)
- `components/InterruptHandler.test.tsx` — **1 mechanical, non-semantic addition** to its
  existing `@/store/srsStore` mock (added 3 no-op stubs: `getIntroductionDueCardIds: () =>
  []`, `canIntroduceNewCard: () => false`, `getNewCards: () => []`) so its existing
  `getState()` stub doesn't throw now that `computeDue` calls those methods. This file isn't
  listed as owned by any Wave 1 stream (checked adam.md/charles.md/derek.md — all three
  explicitly list `hooks/useInterruptConfig.ts`/`.test.ts` as MY off-limits/owned files, none
  claim `InterruptHandler.test.tsx`), and leaving it broken would fail the Verification
  Gate's "full test suite" requirement — a direct, mechanical consequence of this fix, not
  scope creep. Zero existing assertions or test behavior changed; all three new stubs return
  the same "nothing extra" defaults the old single-method mock implied.

**Verification gate — all green:**
- `npx tsc --noEmit` — clean
- `npm test` — 1834/1834 passed (96 files), including the 9 new tests and
  `components/InterruptHandler.test.tsx`'s 12 existing tests (all still pass with their
  original assertions intact)
- `npm run lint` — 0 errors (7 pre-existing warnings elsewhere, unrelated to this change)
- Deletion Test satisfied: two dedicated tests
  (`hooks/useInterruptConfig.test.ts`) prove `computeDue` returns non-zero for exactly the
  two scenarios today's implementation would return 0 for — an introduction-cadence-only
  day and a qualifying-new-card-only day — plus tests for the 1-per-day new-card cap, the
  cross-unit id-membership filter, and a combined-sources sum.

Debt entries logged: 0
Carry-forward tasks generated: 0

Note for later-wave streams touching `hooks/useInterruptConfig.ts` or
`InterruptHandler.tsx` (#526/#529 per Adam's brief): `computeDue`'s signature and return
semantics are unchanged (still `(units: Unit[]) => number`) — only its internal counting
logic grew. No API changes for downstream callers to adjust to.

Barry is done.

— Barry | W1B | #523
