CLOSED: #617 #622 #609 #607 #611
NOT_CLOSED: none

All 5 tasks closed. Two (#622, #609) closed via investigation confirming the concern
was already resolved (by Wave 5's #592/#593 and Wave 6's #608 respectively), not via a
new code fix — matching the brief's own instruction not to re-implement what's already
fixed. #617 was the real bug this wave and got a full fix + 3 new regression tests.
#607/#611 tightened two comments whose underlying claims are now true (thanks to
Wave 6's #606 strict-hydration fix already being wired in when I started this wave) but
whose wording predated that fix.

## #617 — normal daily-cap path had no INTERRUPT_SESSION_CAP awareness (requirements, sev 7)

Confirmed the bug exactly as described: `if (canIntroduceNewCard(today)) introduceNext();`
ran unconditionally for every session type with no knowledge of `sessionIds.size`, unlike
the flex loop (`sessionIds.size < INTERRUPT_SESSION_FLOOR`) and near-due loop (same),
both of which correctly stop. On a backlog day, `app/study/page.tsx` slices `initialQueue`
to `INTERRUPT_SESSION_CAP` (8) before handing it to this hook — but this one line had no
matching ceiling, so a qualifying untouched card anywhere in the ~30K-card catalog could
push the session to 9, contradicting both `components/InterruptHandler.tsx`'s and
`supabase/functions/send-interrupt-notifications/dueEstimate.ts`'s "at most 8" clamps.

**Fix:** `if (canIntroduceNewCard(today) && (!isInterrupt || sessionIds.size < INTERRUPT_SESSION_CAP)) { introduceNext(); }`
— confirmed via `lib/queue.ts`'s own doc comment that `INTERRUPT_SESSION_CAP` is an
interrupt-only concept (unit/global sessions have no queue-size cap at all), so the guard
is `!isInterrupt ||`-short-circuited for non-interrupt sessions rather than applying a cap
that doesn't conceptually exist for them.

**Design decision:** did NOT extract this into `hooks/useInterruptConfig.ts`'s shared
`canFlexIntroduceToday` predicate (which I could only READ this wave — that file is
off-limits/read-only). This is also the right call independent of the ownership
constraint: `computeDue` (the other caller of that shared module) never builds an actual
bounded queue array — it only produces a count estimate — so it has no analogous
"queue size" concept to cap, meaning there's no cross-file duplication risk here the way
there was for the flex-gate condition Task #618 extracted. Inlined the guard directly in
`useStudySession.ts`.

**Tests added (3), matching the brief's explicit request:** the CAP-boundary case
(session already at 8, qualifying card exists, daily cap open → `introduceCard` NOT
called, queue stays at 8), a below-CAP sanity check (guard doesn't over-block when
there's room), and a non-interrupt sanity check (the guard is a no-op for unit/global
sessions, which have no cap). Live Deletion Test: reverted the guard, confirmed the
CAP-boundary test failed with the queue growing to 9 exactly as the finding described,
restored byte-for-byte.

## #622 — getNearDueCards throwing after flex-loop introductions (edge-case, sev 3) — investigated, no code fix needed

Traced the control flow by hand: if `getNearDueCards` throws inside the
`if (sessionIds.size < INTERRUPT_SESSION_FLOOR) { for (...) }` block, the throw
propagates up through the `if (isInterrupt)` block to the OUTER `catch`/`finally` Wave 5's
#592/#593 already wraps the whole fill pass in. The `finally` unconditionally flushes
whatever's in `added` — which already includes every card the flex while-loop
successfully introduced before the throw. So there is no divergence between "cards the
store recorded as introduced" (consuming the daily/flex ceiling) and "cards the user
actually sees" (the visible queue) — every genuinely-introduced card is genuinely shown.

**Conclusion:** consuming the ceiling for those cards is CORRECT behavior, not a bug —
the introductions genuinely happened and are genuinely visible; the user just doesn't get
near-due padding on top that day, which Task #561 already documents as an accepted
possibility (the floor is a target, not a guarantee). Per the brief's own instruction
("only add a code fix if you find a genuine gap beyond what #592/#593 already
handles"), found none — added a documenting comment at the flex while-loop instead, and
a new regression test that specifically drives the flex loop to introduce 3 cards (not
just 1, unlike the existing #592/#593 tests which only exercised the normal-cap path)
before `getNearDueCards` throws, confirming all 3 survive into the visible queue. Live
Deletion Test on the underlying try/catch/finally structure (not on my new guard, since
there is none — verifying the MECHANISM this conclusion depends on) confirmed the new
test genuinely depends on that structure, not vacuously passing; restored byte-for-byte.

## #609 — resumeDecision hydration race (async, sev 7) — already closed by Wave 6's #608

Confirmed exactly as the brief predicted: the `resumeDecision`-resolution `useEffect`
(added by Wave 6's #608, migrating off the unsafe `getResumableSession` render-phase
call) is gated on the SAME `hydrated` signal the mount-fill effect uses — now the STRICT
variant (`useIsHydratedStrict`, Task #606, wired in before I started this wave). A test
already exists (`"useStudySession — resume decision hydration gating (Task #608/#609)"`,
added in Wave 6) proving `resumeDecision` stays `null` while hydration is pending and
only resolves once it completes — this test was ALREADY Deletion-Tested in Wave 6.
Verified the test still correctly exercises the current strict-hydration code path (it
spies on `useSRSStore.persist.hasHydrated`, the same underlying primitive
`useIsHydratedStrict`'s `useRealHydrated` reads — confirmed by reading `lib/storage.ts`).
No new work needed; this is a pure close-out per the brief's own explicit instruction not
to re-implement what's already fixed.

## #607 — stale "never runs against pre-hydration defaults" comment (code-quality, sev 3)

The claim (`if (!hydrated) return;`'s comment, in the mount-fill effect) is NOW true —
but only because `hydrated` above is `useIsHydratedStrict`, not because of anything
inherent in the comment's original Wave 5 wording (written when the gate was plain
`useIsHydrated`, which has a `HYDRATION_FAILSAFE_MS` timeout fallback that could open
the gate before real hydration finished). Rewrote the comment to explicitly state the
claim holds BECAUSE of the strict variant specifically, name what would break it (gating
on the lenient `useIsHydrated` instead), and flag that this comment's correctness is
tied to `hydrated` staying wired to the strict variant — so a future change to that
wiring is a signal to re-verify this claim, not just re-read it.

## #611 — Task #605 comment sits beside the (now-closed) cross-effect race (code-quality, sev 2)

The "cannot desync within one effect pass" comment's own narrow claim was always
accurate, but it sat next to the actual cross-effect hydration race without saying
anything about it — a future reader could mistake it as covering that race too. Since
Task #606's strict-hydration gate now closes that race for real, rewrote the comment to
explicitly say so: it names the separate race, states it is CLOSED (pointing at the
`if (!hydrated) return;` guard's own comment), and explicitly says this comment was
never trying to address it.

## Verification
- `npx tsc --noEmit` — clean (whole repo)
- `npm test` — 2001/2001 passed (101 files, includes other streams' concurrent Wave 7
  work — observed via system reminders touching `tests/seam_studyLoop.test.ts` and
  `hooks/useStudyQueueSetup.ts`, neither owned by me this wave, neither touched by me)
- `npm run lint` — 0 errors, 7 pre-existing warnings (none in files this stream touched)
- Live Deletion Tests run for #617 (the CAP guard) and #622 (confirming the try/catch/
  finally dependency) — both confirmed to fail against the reverted/pre-fix code, then
  restored byte-for-byte (`diff` against `/tmp` backups confirmed identical each time)
- #609 verified via existing (already Deletion-Tested in Wave 6) test, re-confirmed
  still correctly wired to the current strict-hydration code path
- #607/#611 are comment-only changes — no Deletion Test applicable, verified by full
  test-suite parity (41/41 unchanged) and direct re-reading against `lib/storage.ts`'s
  actual `useIsHydratedStrict`/`useRealHydrated` implementation
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again) — substituted
  the real Verification Gate as the brief instructed
- `git status` confirms only `hooks/useStudySession.ts` and
  `hooks/useStudySession.test.ts` changed within this stream — no off-limits files
  touched (`store/srsStore.ts`, `lib/storage.ts`, `hooks/useInterruptConfig.ts`, and the
  three off-limits test files were all read-only references or untouched)

No messy/unexpected `git status` state encountered. No `git stash` was run.

Debt entries logged: 0
Carry-forward tasks generated: 0
