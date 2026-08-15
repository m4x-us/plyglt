CLOSED: #535 #547 #538 #551 #561 #541 #539 #554
NOT_CLOSED: none

## Wave 1, Stream W1B — Batch 23 audit remediation (2026-08-15)

### #535 — INTERRUPT_SESSION_FLOOR/CAP client/server sync guard
Added `tests/interruptFloorSync.test.ts` — two assertions importing both
`lib/queue.ts`'s and `supabase/functions/send-interrupt-notifications/dueEstimate.ts`'s
copies of `INTERRUPT_SESSION_FLOOR`/`INTERRUPT_SESSION_CAP` and asserting equality
(same cross-Deno-import pattern as `tests/pushDueEstimate.test.ts`). Both constants
already existed in `dueEstimate.ts` by the time I reached this task — Adam's stream
(Task #544) had already landed `INTERRUPT_SESSION_CAP` there — so both sync
assertions are live now, not just the floor.

### #547 — 8-card ceiling comment arithmetic
Rewrote `lib/queue.ts:23-29`'s comment to state the real math honestly: 8 cards at
8-15s/card is 64-120s, up to 30s past the 90s target — a deliberate tradeoff
(favoring a longer worst-case session over truncating a heavy backlog day),
confirmed against `.autocode/tasks.md`'s Batch 23 entry rather than inventing new
justification.

### #538 — never-empty backstop bypassed the stranded pause
`hooks/useStudySession.ts`'s mount effect: renamed the flex gate from
`strandedPauseClear` to `flexIntroAllowed` (it now also encodes the #551 daily
ceiling — see below) and made the Task #533 backstop's `introduceNext()` call
conditional on it: `if (sessionIds.size === 0 && flexIntroAllowed) introduceNext();`.
**Product tradeoff, decided rather than deferred:** when the stranded pause is
active AND no near-due card exists either, the session can now be genuinely
empty — BRAND.md's explicit pause invariant ("introductions pause until the
stranded card stabilizes") takes priority over the "never completely empty"
guarantee in this one rare combination. I judged this the correct call because
the pause invariant is a named, explicit BRAND.md rule while "never empty" is
an implementation guarantee serving a *different* stated goal (avoid a 1-card
session, not defeat a struggling-learner pause) — silently overriding a named
product invariant to preserve an incidental guarantee felt like the wrong
default. Flagging for Max in case the product call should go the other way.

### #551 — no daily ceiling on flex-introduced new cards
Added `lib/queue.ts`'s `INTERRUPT_FLEX_DAILY_MAX = INTERRUPT_SESSION_MAX_NEW * 3`
(= 9), reasoned in the code comment: 3x the per-session cap, enough cold-start
ramp-up room across a 6-10-interrupt day without letting one bad day introduce
dozens of new cards. `hooks/useStudySession.ts`'s flex loop now calls
`canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` instead of
`canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER)`.
**No `store/srsStore.ts` change was needed** — `canIntroduceNewCard`'s
`introducedTodayCount` already counts every card introduced today across ALL
sessions (the `introductions` map is persisted store state, not per-session),
so passing a real finite `maxPerDay` immediately gives a genuine cross-session
ceiling with the existing store logic unchanged. Also applied the identical
fix to `hooks/useInterruptConfig.ts`'s `computeDue` flex-fallback (see #539)
for consistency, per Rule 22 (sibling call sites, same pattern, same fix).

### #561 — 6-card floor is a target, not a guarantee (docs only)
Rewrote the mount-effect's header comment in `hooks/useStudySession.ts` to state
this explicitly, no logic changes.

### #541 — near-due over-fetch heuristic not a proven bound
Replaced `getNearDueCards(INTERRUPT_SESSION_FLOOR + sessionIds.size)` with
`getNearDueCards(Number.MAX_SAFE_INTEGER)`. `store/srsStore.ts`'s real
`getNearDueCards` already filters+sorts the entire catalog before slicing to
`limit` (`store/srsStore.ts:189-199`), so requesting everything adds no real
cost and is a mathematically sufficient bound instead of a heuristic one.

### #539 — computeDue flex-fallback could promise a stranded-blocked card
`hooks/useInterruptConfig.ts`'s `computeDue`: the untouched-card flex-fallback
branch is now gated on `state.canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`
before scanning for an untouched card — identical fix to #538/#551, same file
family. When blocked, the function still falls through to the existing
near-due mirror (unchanged), so the fire-gate doesn't go silent, it just stops
promising a new-card session it can't deliver. Added 2 new tests to
`hooks/useInterruptConfig.test.ts` (mine to edit) and extended its `makeState`
test helper so the mock's `canIntroduceNewCard` distinguishes the normal-path
call (`maxPerDay` default 1) from the flex call (`maxPerDay > 1`) — mirrors
`store/srsStore.ts`'s real two-argument contract. All 16 tests in that file
pass (14 existing + 2 new).

### #554 — sync merge could overwrite a just-recorded local review
`hooks/useSync.ts`'s `runSyncNow`: right before building the download-merge
`patch`, now reads `useSyncStore.getState().pendingEvents` fresh (not the
pre-await `pending` snapshot) and skips any `cardId` still present there —
that card has an unsynced local event newer than the just-downloaded server
snapshot, so merging would silently regress it until the next sync corrects
it. Added a regression test to `hooks/useSync.test.ts` (not explicitly listed
in "Files You Own," but it's the direct sibling test of the owned
`hooks/useSync.ts` and isn't claimed by any other stream's off-limits list —
treated it the same way #523's prior wave treated an equivalent gap) proving
a card with a pending event is skipped while a second, non-pending downloaded
card still merges normally (proves the skip is per-card, not a blanket
pending-queue bail-out). All 20 tests pass (19 existing + 1 new).

---

## Verification gate

- `npx tsc --noEmit` — clean
- `npm run lint` — 0 errors (7 pre-existing warnings, all in files I didn't touch)
- `npm test` — **1 pre-existing test now fails**, see below. All other 1947 tests pass.

## ⚠ One test in an off-limits file now fails — needs Charles's/next-wave's fix

`hooks/useStudySession.test.ts` (Charles's stream this wave, off-limits to me per
the brief) has one test that breaks as a direct, unavoidable consequence of the
#551 fix:

**`useStudySession — interrupt-floor flex fallback > flexes past the daily cap when isInterrupt and the session would otherwise be empty`** (line 217)

Its mock is `canIntroduceNewCard: vi.fn(() => false)` — a single fixed return
value regardless of arguments, meant to represent "today's normal 1/day cap
already used." Before my fix, the flex loop called
`canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER)`, and the test's intent
("cap used, but flex should still work") only happened to pass because the
mock ignored the argument and returned `false` for *both* calls, which then
happened to bypass into the interrupt block... actually the mount effect
previously didn't gate the flex loop's *entry* on this value being true — re-read:
the flex loop condition is `strandedPauseClear && sessionIds.size < FLOOR && ...`,
so the OLD code needed `canIntroduceNewCard(today, MAX_SAFE_INTEGER)` to
return **true** for the flex loop to run at all. With the old mock always
returning `false`, the flex loop should already have been skipped — the test
must have been relying on the **backstop** (`if (sessionIds.size === 0)
introduceNext();`), which pre-#538 ran unconditionally. That's exactly the bug
#538 fixes: the backstop no longer force-introduces when the flex check is
blocked. **This existing test was unknowingly exercising the backstop-bypass
bug this wave was tasked to fix**, not the flex loop its own test name implies.

**What the next wave should do (test name unchanged, only the mock and the
scenario's realism need fixing):**

Two options, pick based on the intended scenario:

1. If the test should represent "cap used but flex/pause genuinely clear"
   (matching its own name/intent — "flexes past the daily cap"): change the
   mock to be argument-aware, e.g.
   `canIntroduceNewCard: vi.fn((_today, maxPerDay = 1) => maxPerDay > 1)` —
   returns `false` for the default (normal-path) call and `true` for the
   flex call (any `maxPerDay > 1`, which is what `INTERRUPT_FLEX_DAILY_MAX`
   now passes). This makes the flex *loop* itself run and introduce c1 — the
   assertions (`introduceCard` called once with `"c1"`) stay unchanged and
   now pass for the reason the test name claims.

2. If the test is meant to prove the **backstop** case (stranded/fully
   blocked, nothing near-due, still forced to introduce): that scenario is
   now **intentionally false** per #538 — the correct expected assertion
   becomes `expect(introduceCard).not.toHaveBeenCalled()` and
   `expect(result.current.queue).toHaveLength(0)`, and it should probably be
   renamed/moved to a new test (see the #538 case below) rather than edited
   in place, since it would then contradict its own name.

I believe option 1 is what the test originally intended (its name says "flexes
past the daily cap," not "backstop fires when stranded") — recommend fixing
the mock per option 1.

## New test cases needed in `hooks/useStudySession.test.ts` (mine to describe, not edit)

**For #538** — stranded pause must block the never-empty backstop:
```ts
it("does not bypass the stranded pause in the never-empty backstop — a fully blocked, fully exhausted day leaves the session empty (regression, Task #538)", () => {
  const introduceCard = vi.fn();
  const { result } = renderHook(() =>
    useStudySession(
      defaultParams({
        initialQueue: [],
        isInterrupt: true,
        canIntroduceNewCard: vi.fn(() => false), // false for EVERY maxPerDay — simulates strandedAcrossDays, not just the daily cap being used
        introduceCard,
        getNearDueCards: vi.fn(() => []), // nothing near-due either
      }),
    ),
  );
  expect(introduceCard).not.toHaveBeenCalled();
  expect(result.current.queue).toHaveLength(0);
});
```

**For #551** — the flex loop must pass a real bounded ceiling, not an unbounded one:
```ts
import { INTERRUPT_FLEX_DAILY_MAX } from "@/lib/queue";
// ...
it("passes INTERRUPT_FLEX_DAILY_MAX, not an unbounded maxPerDay, to the flex loop's canIntroduceNewCard check (regression, Task #551)", () => {
  const canIntroduceNewCard = vi.fn(() => false); // return value irrelevant here — asserting call args only
  renderHook(() =>
    useStudySession(
      defaultParams({ initialQueue: [], isInterrupt: true, canIntroduceNewCard }),
    ),
  );
  // 1st call: the normal daily-cap path (line 129), default maxPerDay (1 arg only).
  expect(canIntroduceNewCard).toHaveBeenNthCalledWith(1, expect.any(String));
  // 2nd call: the interrupt flex loop's bounded check — must be a real finite
  // ceiling, not Number.MAX_SAFE_INTEGER (which disabled the daily cap for
  // the rest of the day across every interrupt session that day).
  expect(canIntroduceNewCard).toHaveBeenNthCalledWith(2, expect.any(String), INTERRUPT_FLEX_DAILY_MAX);
});
```

**For #541** — near-due fill must not under-fill when overlap cards are
interleaved rather than clustered at the front of the sorted pool:
```ts
it("still reaches the floor when already-in-session cards are interleaved (not clustered) in the near-due pool (regression, Task #541)", () => {
  const already = ["s1", "s2", "s3", "s4", "s5"].map((id) => makeCard(id));
  const n1 = makeCard("n1");
  // 11 filler entries (all duplicates of the 5 already-in-session cards,
  // cycled) followed by the one genuinely new near-due card at index 11.
  // The OLD heuristic requested exactly FLOOR(6) + sessionIds.size(5) = 11
  // cards — n1 sits one position past that limit and would never be seen.
  const filler = Array.from({ length: 11 }, (_, i) => already[i % 5]!);
  const nearDuePool = [...filler, n1];
  const getNearDueCards = vi.fn((limit: number) => nearDuePool.slice(0, limit));
  const { result } = renderHook(() =>
    useStudySession(
      defaultParams({
        initialQueue: already,
        allCardMap: { ...CARD_MAP, ...Object.fromEntries([...already, n1].map((c) => [c.id, c])) },
        isInterrupt: true,
        canIntroduceNewCard: vi.fn(() => false), // flex loop blocked — forces reliance on near-due fill
        getNearDueCards,
      }),
    ),
  );
  expect(result.current.queue.map((c) => c.id)).toContain("n1");
  expect(result.current.queue).toHaveLength(6); // reaches the floor
});
```

Debt entries logged: 0 (the one test failure above is a direct, documented
consequence of a correct fix, not new debt — flagged precisely for the owning
stream/wave to pick up)
Carry-forward tasks generated: 0 (folded into the note above rather than
filing new task numbers, since it's test-only follow-up on tasks already in
this wave's scope)

No `store/srsStore.ts` change is needed for #551 (see above — existing
`canIntroduceNewCard` semantics already support a real cross-session cap).

Barry is done.

— Barry | W1B | #535 #538 #539 #541 #547 #551 #554 #561
