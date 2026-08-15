CLOSED: #562 #565 #566 #573 #574 #577
NOT_CLOSED: none

## How each task was implemented (Wave 4 depends on this — read before writing #563/#568/#575/#576/#581/#582)

All six tasks live in `hooks/useStudySession.ts`'s mount-fill `useEffect` and were
implemented as one coherent edit, per the brief's own guidance that they're tightly
coupled.

### #562 — per-iteration daily-cap recheck
The old code computed `flexIntroAllowed = canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`
**once**, before the while loop, then used that stale boolean as a loop condition.
**Fix:** `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` is now called directly
inside the `while` condition itself:
```js
while (
  sessionIds.size < INTERRUPT_SESSION_FLOOR &&
  introducedIds.size < INTERRUPT_SESSION_MAX_NEW &&
  canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)
) {
  if (!introduceNext()) break;
}
```
Since `canIntroduceNewCard` reads live `introductions` state from the real store
(`store/srsStore.ts`) and `introduceCard` synchronously mutates that state, each loop
iteration's recheck now correctly reflects every introduction this same pass already
committed. The `flexIntroAllowed` local variable no longer exists — see #566 below for
why that's not a loss.

### #565 — the never-empty backstop was deleted, not made reachable
Re-derived reachability after #562's fix (per Rule 23 — a fix must not leave a
"safety net" unexamined): `introduceNext()` is a pure function of
`(allCardMap, cards, introductions, introducedIds)`, none of which change between the
while loop's last attempt and the old backstop call site. The #562 per-iteration
recheck only changes **when the loop stops** (a `canIntroduceNewCard` transition),
never **whether a repeat call with frozen inputs can succeed where the loop's own
attempt didn't**. The backstop was — and remains — structurally guaranteed to fail
identically to the loop's last attempt. **Decision: deleted entirely**, replaced with a
comment explaining the re-derivation (so a future reader doesn't wonder why it's gone
without also re-deriving the same thing). This is the "delete it" branch of the
brief's fork, not the "make it reachable" branch.

### #566 — comment now describes both block reasons
Since `flexIntroAllowed` no longer exists as a separate variable, this became a comment
fix at the loop itself: the new comment explicitly states `canIntroduceNewCard`
returning false has two distinct causes (the stranded-pause invariant, or the daily
flex ceiling `INTERRUPT_FLEX_DAILY_MAX`), and that the loop deliberately does not
distinguish them — both are legitimate reasons to stop, and the near-due fill below
still runs regardless of which one stopped the loop.

### #573 — cold-start freeze fixed via a ready-signal + once-guard, not a full resync-on-every-change
Root cause: `app/study/page.tsx` calls `useStudySession` unconditionally, before its own
`packLoading` early return, so a session whose first render happens while the pack is
still loading gets `initialQueue=[]`/`allCardMap={}`. `useState(initialQueue)` only
consumes its initializer on that render, and the old effect's `[]` deps meant the fill
pass ran exactly once against that empty snapshot, permanently freezing the queue.

**Fix:** added `const mountFillDoneRef = useRef(false)`. The effect's dependency array
changed from `[]` to `[allCardMap]`. Inside the effect:
```js
if (Object.keys(allCardMap).length === 0) return;   // not ready yet — skip, don't mark done
if (mountFillDoneRef.current) return;                // already ran for real — skip
mountFillDoneRef.current = true;
setQueue(initialQueue);                               // resync to THIS render's real data
// ...rest of the fill logic unchanged, using this render's closure...
```
`allCardMap` is the ready-signal (a real language pack always has thousands of cards,
so empty can only mean "not loaded yet," never a legitimate steady state) —
`cards`/`introductions` were deliberately NOT used as the signal since they can
legitimately be empty for a real brand-new user. The ref preserves the original
"exactly one real fill pass per session" guarantee: the effect re-fires on every
`allCardMap` reference change (e.g. an unrelated later unit switch without a remount),
but the guard makes the actual fill logic execute only once, whichever render is the
first with real data. `setQueue(initialQueue)` is unconditional at the top of the real
pass — a no-op (same array reference, React bails out) on a normal already-loaded
mount, a real resync on the cold-start path.

Verified via Deletion Test: reverting the guard+deps change back to `[]` made the new
cold-start test fail exactly as expected (`expected [] to deeply equal ['p1','p2','p3']`),
then restored.

### #574 — real-store seam test added
`tests/seam_studyLoop.test.ts` was off-limits this wave (Charles's stream), so the new
seam test lives in `hooks/useStudySession.test.ts` (which I do own), importing the real,
unmocked `useSRSStore`/`ALL_UNITS` — same pattern as the Wave 2 seam test, just relocated.
Proves: a normal-cap introduction on mount consumes 1 of the interrupt flex loop's 3
per-session slots (shared `introducedIds` Set), not additive with them — real cards, real
store, exact counts asserted (`introducedInQueue` length 3, not 4; `nearDueInQueue`
length 3; real store `introductions` count 3). Verified via Deletion Test: swapping the
flex loop's shared `introducedIds.size` check for an unshared local counter made this
test fail (`expected [...] to have a length of 3 but got 4`), then restored.

### #577 — comment-only fix, no locking mechanism added
Per the brief's explicit instruction not to over-engineer this. Added a paragraph to the
existing fill-order comment acknowledging the check-then-act cross-tab race on
`INTERRUPT_FLEX_DAILY_MAX`, and explicitly ties it to the same accepted trade-off already
documented in CLAUDE.md §5 (client-only honor-system entitlement model) — no
BroadcastChannel/storage-event/server-counter mechanism was added.

## Verification
- `npx tsc --noEmit` — clean
- `npm test` — 1966/1966 passed (101 files, includes other streams' concurrent changes)
- `npm run lint` — 0 errors, 7 pre-existing warnings (none in files this stream touched;
  one transient warning I introduced myself — an unused `eslint-disable` comment — was
  caught by re-running lint and removed before closing)
- 3 explicit Deletion Tests run (temporarily reverting #562, #573, #565's dead-backstop
  reasoning is a comment not a Deletion-Test-checkable behavior, and #574's interaction)
  — all three new/changed tests genuinely fail against the pre-fix code, then the file
  was restored byte-for-byte (`diff` confirmed identical) before the final commit state
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again) — substituted the
  real Verification Gate as the brief instructed
- `git status` confirms only `hooks/useStudySession.ts` and
  `hooks/useStudySession.test.ts` changed within this stream (no off-limits files touched)

Debt entries logged: 0
Carry-forward tasks generated: 0

## Notes for Wave 4
- #563 (new test for the #562 overshoot): my #562 fix already ships with its own
  dedicated regression test ("stops flexing new cards the moment canIntroduceNewCard
  flips false mid-batch...") — #563 may already be satisfied; worth checking before
  writing a duplicate.
- #568 (CLAUDE.md doc update): should describe the per-iteration recheck (#562) and that
  the backstop was deleted, not fixed (#565) — CLAUDE.md's `useStudySession.ts` module
  entry currently doesn't mention either.
- #575 (docs update for cold-start fix): should describe the `allCardMap`-as-ready-signal
  + `mountFillDoneRef` pattern from #573.
- #576 (regression tests for #538/#541 depending on #565's outcome): the backstop was
  DELETED, not made reachable — any #538/#541 regression test that asserted on the
  backstop's behavior specifically needs updating to reflect it no longer exists as a
  distinct code path (the near-due fill and flex loop are now the only fill mechanisms).
- #581/#582 (lib/queue.ts and docs comment fixes for the daily-cap mechanism): the daily
  cap is now enforced by a live per-iteration `canIntroduceNewCard` check inside the
  while loop, not a cached boolean — any doc/comment describing the old "computed once"
  shape needs updating to match.
