CLOSED: #597 #589 #603
NOT_CLOSED: none

## Summary

All 3 tasks closed. Verification gate — all green:
- `npx tsc --noEmit` — clean (one transient error observed mid-session in `hooks/useStudySession.ts`
  — Adam's stream, off-limits/read-only to me this wave, actively editing it concurrently;
  confirmed via `git status` it was his file not mine, resolved on its own within ~20s)
- `npm test` — 101 files, 1979 tests passed
- `npm run lint` — 0 errors, 8 pre-existing warnings, none in files I touched
- `npm test -- --coverage` — thresholds (lines=84, funcs=79, branches=81, stmts=82) met with
  margin (actual: stmts 91.88%, branches 88%, funcs 91.14%, lines 93.33%)
- Existence-assertion grep gate — clean on both owned files

`git status` was clean of anything I didn't recognize at every check — no `git stash` needed
or used.

Debt entries logged: 0
Carry-forward tasks generated: 1 (see #597 below — a real follow-up item, not debt from this
task being incomplete)

## Task #597 — getResumableSession's render-phase side effect

**Blast-radius finding that shaped the fix:** every real caller of `getResumableSession`
(`app/study/page.tsx`, `hooks/useStudySession.ts`, and their respective test files, plus
`tests/session.test.ts`) is off-limits or unowned by me this wave. `tests/session.test.ts` in
particular directly asserts the CURRENT mutating behavior as a feature ("returns null and
purges a session older than 24 hours" — `expect(store().activeSession).toBeNull(); //
auto-purged"), so renaming or changing `getResumableSession`'s behavior outright would have
broken that off-limits test file's real, load-bearing assertion.

**Fix applied (the smaller-blast-radius option, per the task's own instruction):** left
`getResumableSession` completely unchanged (same name, same mutating behavior, zero risk to
`tests/session.test.ts` or any other existing caller) and added a genuinely pure alternative
pair to `store/srsStore.ts`:
- `peekResumableSession()` — identical resolution logic (null if no session, or if expired)
  but never calls `set()`. Safe to call during React's render phase.
- `clearExpiredResumableSession()` — the explicit, separately-callable side effect: purges
  `activeSession` if and only if it's expired, a no-op otherwise. Intended for a `useEffect`,
  not render.

Also added an honest doc comment directly on `getResumableSession` in the `SRSState`
interface, explicitly naming the render-phase danger and pointing future/concurrent callers at
the pure pair instead of leaving the danger silently undocumented.

**Real regression tests added** (`tests/srsStore.test.ts`, two new describe blocks): 7 new
tests covering `peekResumableSession`'s no-mutation guarantee (including a dedicated test
proving it does NOT clear an expired session from state — "the defining difference from
getResumableSession") and `clearExpiredResumableSession`'s no-op/expired-only behavior. **Live
Deletion Tests run and verified** (not just traced by hand — the production file is one I own
this wave): reintroduced the mutation into `peekResumableSession` → the "does NOT clear it
from state" test failed as expected; replaced `clearExpiredResumableSession`'s body with a
no-op → the "clears a session that has expired" test failed as expected. Both reverted and
re-verified passing before considering the task done.

**Carry-forward/coordination item for the next wave (per the task's own explicit instruction
not to edit Adam's file):** the actual code-quality finding — `getResumableSession` being
called during React's render phase in `hooks/useStudySession.ts`'s `useState` lazy initializer
and two `useMemo` bodies — is NOT yet fixed at those call sites, since that file was read-only
to me this wave (Adam's stream). The pure primitives now exist and are ready to use. A future
wave (ideally Adam's, since he already owns `hooks/useStudySession.ts` this wave and may be
touching the exact same mount-effect region) should: swap `getResumableSession()` →
`peekResumableSession()` at the three render-phase call sites in `hooks/useStudySession.ts`,
and add a `useEffect` that calls `clearExpiredResumableSession()` once on mount to preserve the
original auto-purge behavior outside of render. `app/study/page.tsx`'s one direct call
(`getResumableSession()` inside the `resumeDecision === "pending"` branch, which renders
AFTER the early-return checks, not during the hook's own initial render) is lower-risk and may
not need to change at all — flagging it for whoever picks this up to judge, not asserting it
needs the same treatment.

## Tasks #589 / #603 — getNewCards' introductions filter test gap

Added one real regression test to `tests/srsStore.test.ts`'s existing `getNewCards() —
prerequisite logic` describe block: a card with an existing `IntroductionRecord` (full,
realistic shape — not a shortcut cast) is excluded from `getNewCards`' return even though it
has no FSRS progress and no prerequisites, so it would otherwise qualify by every other filter.

**Live Deletion Test run** (not traced by hand — `store/srsStore.ts` is mine this wave):
temporarily removed the `.filter((card) => !introMap[card.id])` line from `getNewCards`,
re-ran the test — failed exactly as expected (`mid-phase` appeared in the result alongside
`untouched`). Restored the filter, re-ran the full file — 79/79 pass, `git diff` confirms the
production file is back to its Task #567 state with only the new test file changes surviving.

This closes #589 directly. #603 required no separate edit — the brief was explicit that
`.autocode/stream-W3C/completion.md` (the historical report making the overclaim) is not to be
edited; the actual fix is closing the real test gap the report's own #567 section had honestly
flagged as unverified ("verified no existing test broke" — a materially weaker claim than the
report's blanket closing statement). That gap is now closed, which is what #603 asked for.

## Note on `scripts/deep-audit.sh`

Still does not exist in this repo (same finding as every prior wave's stream) — substituted the
real Verification Gate as every task's acceptance criteria itself instructed.
