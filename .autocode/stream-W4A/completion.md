CLOSED: #563 #576 #584 #572
NOT_CLOSED: none

## Per-task: existing coverage vs. new work

### #563 — daily-cap overshoot test: PARTIALLY already covered, added the missing piece
My own Wave 3 test ("stops flexing new cards the moment canIntroduceNewCard flips false
mid-batch...") already proves the per-iteration RECHECK happens (Deletion Test re-verified:
still fails against a compute-once revert). But it does not pin the actual VALUE passed to
`canIntroduceNewCard`'s `maxPerDay` — every existing test (including that one) only checks
`maxPerDay !== undefined`, so a regression back to an unbounded value (e.g.
`Number.MAX_SAFE_INTEGER`, the literal pre-#551 bug F002 names) would satisfy every prior
test unchanged. Added one new test, "passes the real INTERRUPT_FLEX_DAILY_MAX constant to
canIntroduceNewCard's maxPerDay, not an unbounded value", asserting the collected call
arguments exactly equal `[INTERRUPT_FLEX_DAILY_MAX, INTERRUPT_FLEX_DAILY_MAX]` (imported
from the real `@/lib/queue`, not a hardcoded `9`). This closes the specific remaining gap
F002 described.

### #576 — #538/#541 regression tests: #538 already covered (comment added, no new test), #541 was a real gap (new test added)
**#538 (stranded pause blocks ALL new-card introduction):** the existing test "falls back to
near-due-only fill when the stranded pause blocks new introductions" already uses a
`canIntroduceNewCard` mock that returns `false` unconditionally for BOTH the normal-cap call
shape and the flex call shape — exactly how the real store's `canIntroduceNewCard` behaves
under `strandedAcrossDays`. Traced through by hand (production file is read-only this wave,
so I could not do a live revert-and-rerun Deletion Test on it as I did in Wave 3): if either
call site's `canIntroduceNewCard` check were removed or bypassed, `introduceCard` would fire
against the 5-card catalog this test uses, failing `expect(introduceCard).not.toHaveBeenCalled()`.
This is a real, working regression test for #538 already — I added an explicit comment tying
it to Task #538 (so future readers know this IS the intended regression test) rather than
writing a duplicate.

**#541 (near-due-interleaving):** genuinely NOT covered. Every existing near-due-dedup test in
the file places the duplicate-of-an-in-session-card FIRST in the mocked `getNearDueCards`
return (`[shared, ...nearDuePool]`, `[dual, ...nearDuePool]`) — this passes even against the
pre-#541 heuristic limit, since duplicates clustered at the front are exactly what that old,
smaller-limit heuristic handled correctly. Added a new test, "reaches the floor via near-due
fill even when already-in-session duplicates are interleaved throughout the pool, not
clustered at the front" — its mock `getNearDueCards` actually respects the requested `limit`
argument (mirroring the real `store/srsStore.ts` slice contract, unlike every sibling test's
`vi.fn(() => pool)` mocks which ignore the argument entirely), with 10 duplicate entries
placed before 2 needed fresh cards. Verified independently via a Node one-liner (not by
editing the off-limits production file) that `pool.slice(0, 10)` — the old heuristic's
request size (`INTERRUPT_SESSION_FLOOR + sessionIds.size` = 6 + 4) — contains zero fresh
cards, confirming this test would genuinely fail against the pre-#541 code.

### #584 — near-due dedup test: already fully covered, no new test added
Per the brief's own hint (Charles's W3C note), checked for a test proving the inner
loop-level `sessionIds.has(card.id)` check specifically. Found it: "never duplicates a card
introduced via the flex-new path in the same pass, even when getNearDueCards also returns
it" (added in an earlier wave, referencing Task #559 in its own comment) uses an EMPTY
`initialQueue` so the outer `setQueue` dedup filter (which only compares `added` against
`prev`) has nothing to catch "dual" against — the only thing preventing "dual" from
appearing twice in the final queue is the inner loop's own `sessionIds.has` check, since the
outer filter does not dedupe within `added` itself. Confirmed by re-reading the outer
filter's actual code (`added.filter((c) => !have.has(c.id))` — `have` is built from `prev`
only). No new test added; this finding was already resolved.

### #572 — weak bound → exact value, plus a root-cause fix to the fixture's isolation
Read `store/srsStore.ts`'s current `getNewCards` (Task #567 added a `!introMap[card.id]`
filter). The test's own describe block (`"getNewCards() — prerequisite logic"`) never reset
`introductions` in its `beforeEach` — traced the whole file for any earlier test introducing
cards with ids `c1`-`c5` (none exist; the first `introduceCard` call in the file is well
after this describe block, using different ids), so the specific assertion was safe as
originally scoped, but the missing reset was a latent test-isolation gap that Task #567's new
filter made newly load-bearing for any future reordering. Fixed both: added
`introductions: {}` to the describe's `beforeEach`, and changed
`expect(result.length).toBeLessThanOrEqual(3)` to an exact assertion —
`expect(result.length).toBe(3)` plus `expect(result.map((c) => c.id)).toEqual(["c1", "c2", "c3"])`
— since all 5 fixture cards have no progress, no introductions record, and no
prerequisites, so exactly 3 (tier-then-original-order) must come back from a working
`.slice(0, limit)`.

## Verification
- `npx tsc --noEmit` — clean
- `npm test` — 1968/1968 passed (101 files, includes other streams' concurrent Wave 4 work)
- `npm run lint` — 0 errors, 7 pre-existing warnings (none in files this stream touched)
- Deletion Tests run for every NEW assertion added this wave:
  - #563's new test: exact-value assertion fails by construction against any value other
    than the real `INTERRUPT_FLEX_DAILY_MAX` (verified via the mock's exact-equality check
    itself, not a live revert — `hooks/useStudySession.ts` is read-only this wave)
  - #576's new #541 test: independently verified via a Node one-liner that
    `pool.slice(0, 10)` (the pre-#541 heuristic's request size) contains zero fresh cards
  - #572: the exact assertion (`toBe(3)`) fails against a broken slice returning 0/1/2
    cards, unlike the weak bound it replaced
  - #538's existing test and #584's existing test: traced by hand rather than live-reverted,
    since the two production files (`hooks/useStudySession.ts`, `store/srsStore.ts`) are
    off-limits this wave — noted explicitly rather than silently skipped
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again) — substituted the
  real Verification Gate as the brief instructed
- `git status` confirms only `hooks/useStudySession.test.ts` and `tests/srsStore.test.ts`
  changed within this stream (no off-limits files touched)

Debt entries logged: 0
Carry-forward tasks generated: 0
