CLOSED: #633 #641 #635
NOT_CLOSED: none

## Summary

All 3 tasks closed. Read `components/InterruptHandler.tsx` in full before starting either of
the two async-safety tasks in it, per the brief's instruction. Verification gate:
- `npx tsc --noEmit` — clean
- `npm test` — 100 files passed, 1 file (`app/study/page.test.tsx`) had 1 failing test,
  persistent across two re-runs; confirmed via `git status` that both `app/study/page.tsx`
  and `.test.tsx` are mid-edit by another stream this wave (both off-limits to me) — my
  owned-scope-only run (`components/InterruptHandler.tsx`, `.test.tsx`,
  `hooks/useInterruptConfig.test.ts`) is 45/45 clean in isolation. Not something I touched or
  can fix within my file ownership this wave; flagging per the brief's own "confirm via git
  status before assuming" instruction rather than silently ignoring it.
- `npm run lint` — 0 errors, 7 pre-existing warnings, none in files I touched
- Existence-assertion grep gate — clean on all 3 owned files
- `git status` showed only expected, recognizable changes throughout (my 3 owned files, plus
  every other stream's own off-limits files matching this wave's off-limits list exactly) — no
  `git stash` used or needed.

Debt entries logged: 0
Carry-forward tasks generated: 0

## Task #633 — configSeqRef staleness guard missing from the success path

**Design decision, explained per the brief's request:** read `updateInterruptConfig`
(`lib/tauriInterrupt.ts`) directly before deciding anything — it resolves `Promise<void>`,
with genuinely no return value and no further JS-side action taken after it today (confirmed:
the effect had no `.then()` at all, only a `.catch()`). This matters because the actual
"overwrite" the audit finding describes happens on the RUST side, at the moment the IPC call
completes there — not in JS after the `await` resolves. A JS-side staleness check added after
a successful `await` cannot retroactively undo a Rust-side write that already happened; it can
only gate JS code that runs AFTER that point, and none exists today.

**Decision: add the check anyway, documented honestly as currently inert.** This directly
closes the real doc/code mismatch the audit flagged (the `configSeqRef` comment already claims
protection against this race; the code only delivered half of it) and future-proofs any change
that later adds real post-success logic here (e.g. storing an ack) — without the check, that
future code would silently need someone to remember to add exactly this line. Implemented by
converting the effect from `.catch()`-chaining to an `async () => { try {...} catch {...} }`
IIFE (matching this same file's existing style for the `interrupt:fire` listener), with the
identical `if (seq !== configSeqRef.current) return;` line placed symmetrically in both the
success and catch paths.

**Regression test added**, using controllable/deferred promises to force the exact "older
resolves after newer" ordering: asserts (1) no error is logged (proving the new success-path
code doesn't throw/crash), and (2) each of the two `updateInterruptConfig` calls still carried
its own correct, un-swapped arguments regardless of resolution order.

**Deletion Test — run live, and the result is worth stating precisely, not just "ran it":**
removing the new success-path check line did NOT fail any test, including the new regression
test — confirming, exactly as reasoned above, that the guard is currently inert with respect
to any observable behavior. This is not a failed verification; it's the expected, honestly
documented outcome for a defensive/future-proofing fix with no live effect to gate yet. Stated
plainly rather than glossed over, per the brief's instruction to explain design-decision
reasoning clearly.

## Task #641 — interrupt:fire listener has no re-entrancy guard

Added `interruptFireInFlightRef` (a `useRef(false)`, same ref-based-guard shape as
`configSeqRef`, not a state-triggered one — nothing here needs to cause a re-render). Set to
`true` at the very start of the listener callback (before any `await`, so it's synchronously
visible to a second concurrent invocation), checked-and-early-returned at the top for a second
fire while the first is in flight, and released in a `finally` wrapping the existing
try/catch — guaranteed to run regardless of which of the callback's several early-return paths,
a thrown error, or normal completion is taken.

**Regression test added:** fires the listener twice back-to-back (both calls started
synchronously, neither individually awaited first, so the second genuinely lands mid-flight of
the first — not after it already finished), then asserts `markInterruptFired` and the router's
`push` were each called exactly once, not twice.

**Live Deletion Test:** removed the guard-check/set lines and the `finally` release — the new
regression test failed exactly as expected (`markInterruptFired` called 2 times, not 1).
Restored and re-verified all 27 tests pass.

## Task #635 — two computeDue tests fail the Deletion Test negatively

Traced both tests against the CURRENT `hooks/useInterruptConfig.ts` (variable renamed
`newCardDue` → `hasQualifyingContent` in a later wave than the finding's own comments
reference, but the logic is identical) before rewriting, per this project's own repeated lesson
about checking real current state rather than trusting a stale description.

**"does not flex when reviews are due":** the original fixture set `newCardIds: []`, so even
if the outer `reviewDue === 0 && ...` guard gating the whole flex block were deleted, the flex
new-card loop would find nothing to flex anyway (empty pool) — same result of 1 either way.
Fix: added a genuinely untouched card via `newCardIds` that the flex path WOULD pick up if it
incorrectly ran, so a deleted guard now changes the numeric result (2, not 1) instead of
silently no-op'ing.

**"falls through to a near-due card when the flex introduction is blocked":** the original
fixture set up exactly one matching card on BOTH the new-card side and the near-due side, so
whether the `flexIntroAllowed` guard correctly blocks the new-card loop (falling through to
near-due, as the name claims) or the guard is deleted (new-card loop runs unconditionally,
finds its match, and never even reaches the near-due block) — both land on the identical count
of 1. Fix: spied on both `getNewCards` and `getNearDueCards` (same technique as this file's own
existing Task #558 pattern) to prove the result specifically came from the near-due fallback:
`getNearDueCardsSpy` must have been called with the unit's cards, and `getNewCardsSpy` must
never have been called at all (neither the normal-cap check nor the flex check should reach it
in this fixture).

**Both Deletion Tests run live** against the real (off-limits/read-only-to-me)
`hooks/useInterruptConfig.ts`: temporarily removed the outer flex guard for test 1 (result
became 2, correctly caught), then restored and removed the `flexIntroAllowed` gate around the
new-card loop for test 2 (the new `getNearDueCardsSpy` assertion correctly failed — never
called). Restored the production file after each attempt; `git diff` on it is empty — confirmed
byte-identical to its state before I started, consistent with it not being in my file ownership
this wave.

## Note on `scripts/deep-audit.sh`

Still does not exist in this repo (same finding as every prior wave's stream) — substituted the
real Verification Gate as every task's acceptance criteria itself instructed.
