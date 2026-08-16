CLOSED: #614 #626
NOT_CLOSED: none

# Derek — Stream W6D — Wave 6 — Completion

## #614 — mandatory-branch comment falsely claimed a content guarantee (severity 5)

Verified the finding directly against `docs/INTERRUPT_ARCHITECTURE.md` §10.2/§10.4: "The
floor is a target, not an unconditional guarantee ... can leave a session below 6 — even, in
one rare combination, completely empty." `components/StudyEmptyQueue.tsx` exists precisely for
that outcome. The pre-existing comment in `components/InterruptHandler.tsx` above `markFired`
("the mandatory branch always shows content ... so it calls this unconditionally") was false.

**Scope decision (judgment call, per the brief's explicit allowance):** implemented option (b),
not (a). Option (a) — deferring `markFired()` in the mandatory branch until the opened study
session confirms it has content — requires a signal back from `app/study/page.tsx` /
`hooks/useStudySession.ts`'s mount-fill effect. Both files are off-limits this wave (owned by
Adam's stream), and I confirmed no such signal already exists:
`components/StudyEmptyQueue.tsx` (the empty-state UI a genuinely empty mandatory session
renders) only calls `exitMandatoryMode()` and a local `onHome()` navigation callback — nothing
is emitted back toward `InterruptHandler.tsx`. Closing this gap for real is a cross-file change
this wave's ownership boundaries don't permit; I did not edit an off-limits file to force it
through.

**What I did instead:** rewrote the comment block above `markFired()` and added a call-site note
at the `if (isMandatory)` branch, both now stating plainly that the mandatory branch fires
`markFired()` speculatively — not because content is guaranteed, but because no confirmation
signal exists yet — and documenting this as an accepted, bounded trade-off (the failure mode is
one skipped interrupt interval on the rare stranded-pause + exhausted-near-due-pool combination,
not data loss or a stuck state). Left an explicit coordination note in the comment naming
exactly which off-limits files would need to change to close the gap for real, for whichever
future wave picks this up.

Also added a comment to the existing test `"is called exactly once when real content is shown
on the mandatory path"` (`components/InterruptHandler.test.tsx`) explaining why a literal
"mandatory + ultimately empty" regression test can't be written meaningfully at this layer:
`InterruptHandler.test.tsx` never renders the real `/study` route, so this component has no
testable visibility into whether the destination's mount-fill effect actually reaches the
floor. The brief's own regression-test instruction was conditional on implementing option (a)
("if you implement (a)") — since I implemented (b), no new assertion was fabricated; writing a
synthetic "empty session" test here would be pseudocode (asserting behavior this component
cannot observe), which the Deletion Test / Rule 16 exists to prevent.

Verification: doc-only production change (no new assertion), so no Deletion Test applies;
existing 25/25 tests in `InterruptHandler.test.tsx` still pass unchanged.

## #626 — no contract test for interrupt_gate_events' RLS-relevant query scoping (severity 2)

Confirmed via direct read of `supabase/migrations/20260813000000_interrupt_gate_events.sql`:
RLS policies (`auth.uid() = user_id` on both select and insert) are correct, and the table
comment itself states "the client is never trusted to filter by user_id itself" — RLS is the
real boundary, not the client query shape. This is process debt (Rule 19a), not a live bug, as
the brief states.

**Feasibility judgment (explicit, per the brief's request):** a literal RLS-enforcement
integration test (does Postgres actually reject a cross-user query) is not feasible in this
suite — Vitest runs against a mocked Supabase client (`lib/interruptGate.test.ts`'s
`makeMockClient()`), not a live Postgres instance. There is no database to reject anything
against.

What I added instead, in `lib/interruptGate.test.ts` under a new, explicitly-labeled
`"cross-user query isolation (Task #626 — RLS defense-in-depth)"` describe block (with a
comment explaining the feasibility judgment above and why this is the meaningful thing the
suite CAN verify): three tests on `readInterruptGateState` and `recordInterruptGateEvent`
proving (1) two calls with different `userId`s scope to their own id and never a prior call's
id — closing the gap that the pre-existing tests only ever exercised a single `"user-1"` and
so could not have caught a stale-closure/cross-user-leakage bug; (2) the insert payload's
`user_id` matches the caller-supplied id exactly, never mismatched; (3) `user_id` is never
silently omitted from the insert payload. RLS itself remains the actual security boundary —
these are a fast, local signal that the client-side half of the contract (never send/query the
wrong id) hasn't regressed.

**Live Deletion Test not performed for these 3 new tests** — `lib/interruptGate.ts` is not in
my "Files You Own" list this wave (only `lib/interruptGate.test.ts` is), and the brief's "do
not touch anything else" instruction reads as covering even a temporary revert-and-restore.
**Traced-by-hand verification instead:** I read `lib/interruptGate.ts`'s current implementation
directly — `readInterruptGateState` calls `.eq("user_id", userId)` using the function parameter
with no intermediate caching, and `recordInterruptGateEvent` inserts `user_id: userId` the same
way. Both new tests use a **fresh `makeMockClient()` instance per call** specifically so that a
hypothetical regression (e.g. a stale closure or module-level cached id) would leave the second
call's fresh mock never receiving the expected `eq`/`insert` call with its own id — the
assertion would then fail on `mockB`, not silently pass by re-observing `mockA`'s prior call.
This construction is what makes the isolation claim real rather than pseudocode.

Verification: 16/16 tests in `lib/interruptGate.test.ts` pass (13 pre-existing + 3 new).

## Verification Gate (whole owned file set)

- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors (7 pre-existing warnings in unrelated files, untouched by this
  wave)
- `npm test` — 101 files / 1993 tests, all green (includes 25/25 in
  `InterruptHandler.test.tsx` and 16/16 in `interruptGate.test.ts`)
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again this wave) — the
  Verification Gate above is the real acceptance criterion.
- `git status --short` confirmed only my three owned files were touched
  (`components/InterruptHandler.tsx`, `components/InterruptHandler.test.tsx`,
  `lib/interruptGate.test.ts`) — no off-limits or other-stream files modified.

No `git stash` was run at any point.
