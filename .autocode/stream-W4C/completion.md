CLOSED: #575 #582
NOT_CLOSED: none

## Summary

Both tasks closed. Both touch `docs/INTERRUPT_ARCHITECTURE.md` §10, which I read in full
(all of 10.1–10.7) before editing, plus the current committed `hooks/useStudySession.ts`
(read-only reference, Wave 3's `#562`/`#565`/`#573` already merged) to verify every claim
against the real code rather than trusting the brief's summary alone. Verification gate — all
green:
- `npx tsc --noEmit` — clean (docs-only change, no code touched)
- `npm test` — 101 files, 1967 tests passed
- `npm run lint` — 0 errors, 8 pre-existing warnings, none in files I touched
  (`docs/INTERRUPT_ARCHITECTURE.md` isn't ESLint-lintable — markdown, not code — confirmed by
  running `npx eslint docs/` directly, which reports the whole `docs/` glob as ignored by
  config, not an error)

Debt entries logged: 0
Carry-forward tasks generated: 0

## Approach: no renumbering

Both tasks named specific subsection numbers (10.3, 10.4) that are cross-referenced by number
in several other files (`.autocode/patterns.md`, `.autocode/tasks.md`, multiple streams'
`completion.md`/`tasks.md`/briefs). Renumbering the doc's subsections to insert new content
would have made every one of those historical references point at the wrong section. I kept
all existing `### 10.x` numbers exactly where they were and:
- Added the new cold-start content as a `####` sub-subsection inside the existing `### 10.2`
  (titled "Cold-start pack-loading race (Task #552/#573)") rather than a new top-level `10.x`
  — the brief's own task #575 text explicitly permits "add a subsection (or extend an existing
  one)," and this reads naturally as part of 10.2 since it's about the same mount effect's
  reliability, not a new mechanism.
- Rewrote the BODY of 10.3 and 10.4 in place (including their headings, to remove the now-false
  claims from the heading text itself, not just the prose below it) without changing their
  section numbers.
- Updated the 10.7 summary table's `hooks/useStudySession.ts` row to reflect the backstop's
  removal and the cold-start fix.
- Updated the §10 intro paragraph to mention Wave 3's remediation alongside Wave 1's, and
  named all three corrected claims up front (cold-start freeze, ceiling per-iteration
  enforcement, backstop removal) so a reader skimming just the intro gets the accurate current
  state without needing to read all of 10.2–10.4.

## Task #575 — cold-start-freeze gap (#552/#573) not documented

Added `#### Cold-start pack-loading race (Task #552/#573)` inside §10.2, documenting:
- **Root cause:** `app/study/page.tsx` calls `useStudySession` unconditionally before its own
  `packLoading` early return. A session mounting while the pack is still loading renders the
  hook first with an empty `allCardMap`/`initialQueue`. `useState(initialQueue)` only consumes
  its initializer on the true first render, and the mount-fill effect originally had an empty
  `[]` dependency array — so the one real fill pass ran against that empty snapshot and never
  got a second chance once real pack data arrived, permanently freezing the queue empty.
- **Why Wave 1's #552 didn't actually fix this:** it only added `allCards` to
  `app/study/page.tsx`'s `initialQueue` `useMemo` dependency array — a real fix for that
  memo's own staleness, but the actual freeze lived inside `useStudySession`'s own mount-fill
  effect in a different file, which #552 never touched.
- **The real Wave 3 fix (#573):** the effect's dependency array changed from `[]` to
  `[allCardMap]` (re-fires on every `allCardMap` reference change — i.e., whenever the pack
  finishes loading), with `allCardMap`'s emptiness doubling as the "not loaded yet" ready-signal
  (a real pack always has thousands of cards) and a `mountFillDoneRef` guard preserving the
  original "exactly one real fill pass per session" invariant despite the effect potentially
  re-firing multiple times.

## Task #582 — false per-introduction-ceiling claim (10.3) + stale backstop text (10.4)

**10.3 rewrite:** kept the accurate Wave 1/Batch 23 history (the `strandedAcrossDays` pause
preservation, `INTERRUPT_FLEX_DAILY_MAX` replacing `Number.MAX_SAFE_INTEGER`) but added the
real Wave 3 correction: Wave 1's fix computed the ceiling check ONCE before the flex loop
started (a frozen `const flexIntroAllowed`), which could still let a single session's loop
introduce up to 3 cards in a row without re-checking — overshooting the ceiling by up to 2
within one mount if the loop crossed the boundary mid-batch. Task #562 (Wave 3) moved the
check into the `while` loop's own condition, re-evaluated fresh on every iteration against
live store state. Also added the Task #566 note (already present as a code comment) that the
check's `false` result doesn't distinguish the stranded pause from the ceiling — both are
legitimate, equally-valid reasons to stop, and this is by design.

**10.4 rewrite (retitled, not just re-bodied):** old title "The never-empty backstop now
respects the pause" was itself the false claim, since it described code that no longer exists.
New title: "The never-empty backstop was removed as dead code (Task #565, Wave 3 — supersedes
Wave 1's #538 re-gating fix)." Body now states plainly that the backstop was deleted entirely,
explains the actual reasoning from the code's own comment (`introduceNext()` is a pure function
of frozen inputs, so a repeat call after the loop already tried and failed can never succeed),
and states explicitly that the near-due fill and flex loop are now the only two fill mechanisms
— matching the brief's exact instruction. Also updated 10.7's summary table row accordingly.

## Note on `scripts/deep-audit.sh`

Still does not exist in this repo (same finding as every prior wave's stream) — substituted the
real Verification Gate as every task's acceptance criteria itself instructed.

## Cross-checked against a parallel, independent source

While reading around for this task, I noticed `CLAUDE.md` (off-limits to me, edited by another
window this same session) already carries an accurate, independently-written description of
the exact same Wave 3 mechanism I was documenting here (`hooks/useStudySession.ts`'s entry in
its Layer Map notes). I did not copy from it, but its description matches what I found reading
the actual code directly — a useful independent confirmation that my read of the current
mechanism is correct, not just internally consistent with itself.
