CLOSED: #560
NOT_CLOSED: none

## Task #560 — "keeps an estimate above the floor exact" test doesn't prove the floor exists

**Finding: already fully closed by Wave 1 (Adam's stream, Tasks #544/#545). No test-file edit was made.**

### What I checked

Read `tests/pushDueEstimate.test.ts` as it exists on disk today (not the task description's stale
snippet). The originally-flagged test — `"keeps an estimate above the floor exact"` using
`cardCount: 9` — no longer exists under that name or with that input. Adam's Wave 1 fix
(`buildNotificationPayload` now does `Math.min(Math.max(cardCount, FLOOR), CAP)`, i.e. clamps to
`[6, 8]`) already required rewriting it, since 9 is now itself clamped down to 8 rather than passed
through unchanged.

The current suite (`describe("buildNotificationPayload — Batch 23 session floor...")`) has:
1. `cardCount: 0` → `"Cards ready"` (no-number zero case)
2. `cardCount: 1` → `"6 cards ready"` (floor)
3. `cardCount: 7` → full-payload exact match `"7 cards ready"` — this is the renamed replacement
   for the old broken test (`"keeps an estimate within the floor..cap range exact"`)
4. `cardCount: 9` → `"8 cards ready"` (cap)
5. `cardCount: 40` → `"8 cards ready"` (cap, large backlog)
6/7. forbidden-terminology checks on zero and non-zero bodies

### Deletion Test — run directly against the live source, not assumed from Adam's completion.md

I temporarily edited `supabase/functions/send-interrupt-notifications/dueEstimate.ts` three ways,
reran `tests/pushDueEstimate.test.ts` after each, and reverted before finishing (confirmed via
`git diff --stat` showing zero delta on that file at the end):

1. **Delete the floor** (`announced = Math.min(cardCount, CAP)`, no `Math.max`) →
   exactly 1 failure: `"floors a small positive estimate (1) at 6..."` (expected `"6 cards ready"`,
   got `"1 cards ready"`). Proves the floor is load-bearing and this test alone catches its removal.

2. **Delete the cap** (`announced = Math.max(cardCount, FLOOR)`, no `Math.min`) →
   exactly 2 failures: the `cardCount: 9` test (expected `8`, got `9`) and the `cardCount: 40` test
   (expected `8`, got `40`). Proves the cap is load-bearing.

3. **Force `announced` to the floor constant unconditionally** (simulating a bug where the clamp
   collapses to "always return FLOOR" regardless of input) → 3 failures, including
   `"keeps an estimate within the floor..cap range exact"` (`cardCount: 7`, expected `7`, got `6`).
   This is the specific proof the task asked for: an in-range value passes through **unchanged**,
   not just "some value near the floor happens to work." The old `cardCount: 9` test could never
   have caught this class of bug even before Wave 1, since 9 was never in-range to begin with.

All three deletions were caught by distinct, correctly-named tests with exact expected values
(`.toBe()` / `.toEqual()`, no `.toBeDefined()`/`.toBeTruthy()` pseudocode). File was restored to
its original committed state after the last run (`git diff --stat supabase/functions/...` showed
no changes).

### Conclusion

Wave 1's rename of the flagged test (9 → 7) plus its two new cap-clamp tests already give the
floor, the cap, and the untouched-middle-value behavior each their own falsifiable, Deletion-Test-passing
assertion. Task #560's originally-described gap does not exist in the current codebase. No edit to
`tests/pushDueEstimate.test.ts` was needed or made.

### Verification gate

- `npx tsc --noEmit` — clean, 0 errors
- `npm test` — 101 files, 1952 tests, all passed
- `npm run lint` — 0 errors (7 pre-existing warnings, unrelated files, not in my scope)
- `git status` / `git diff --stat` — `tests/pushDueEstimate.test.ts` and
  `supabase/functions/send-interrupt-notifications/dueEstimate.ts` both show zero diff from HEAD;
  only other streams' files (W2A/W2B/W2C queue/briefs, docs/INTERRUPT_ARCHITECTURE.md,
  hooks/useInterruptConfig.test.ts) are modified in the working tree, none of which are mine.
