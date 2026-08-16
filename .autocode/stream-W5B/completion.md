CLOSED: #600 #590 #599 #595
NOT_CLOSED: none

## Wave 5, Stream W5B — app/study/page.tsx audit remediation (2026-08-15)

### #600 (severity 6, highest in this stream) — Study More handler omitted getIntroductionDueCardIds
`app/study/page.tsx`'s `onStudyMore` handler called `buildQueue(allCards,
getDueCards, getNewCards, false)` — 4 args — while `initialQueue`'s own
construction calls `buildQueue(allCards, getDueCards, getNewCards, isGlobal
|| isInterrupt, getIntroductionDueCardIds)` — 5 args. A card mid-intensive-
introduction-phase due today would be silently excluded from a rebuilt
Study More queue even though the unit's initial session load would have
included it.

**Fix:** added the matching 5th argument. One-line change (line 134).

**Test:** new test in `app/study/page.test.tsx` — since this file uses the
REAL `srsStore` (not a mock), I overrode just `getIntroductionDueCardIds` via
`useSRSStore.setState(...)` (captured and restored the original in a
`finally` block, so no cross-test leakage), rendered a unit-mode done screen,
and clicked a real "Study more" button (extended the `StudyDoneScreen` test
double to actually render a clickable button wired to `onStudyMore`, not just
expose its presence/absence as before). Asserted `resetToQueue` was called
with the introduction-due card. **Deletion Test run live:** reverted the
production fix (dropped the 5th arg), confirmed the new test failed with the
exact expected diff (`resetToQueue` called with `[]` instead of the intro
card), then restored the fix and confirmed all 13 tests pass again.

### #590 — inaccurate test comment + missing direct onStudyMore coverage
The comment on the interrupt-mode "does not offer 'Study more'" test claimed
a sibling test ("renders StudyDoneScreen when pos is at or past the end of
the queue") already proved global mode gets a null `onStudyMore` handler —
false; that sibling test never checks the `has-study-more` attribute at all,
only that `StudyDoneScreen` rendered.

**Fix:** added a new `describe("onStudyMore gating (Task #590)")` block with
two direct tests — global mode → `data-has-study-more="false"`, unit mode →
`"true"` (this also required a new `FAKE_UNIT` fixture and populating
`langPackState.unitMap[""]`, since this file had never exercised real
"unit" mode before — the `useSearchParams` mock always returns `unitId=""`).
Rewrote the inaccurate comment to point at the new dedicated tests instead of
the false claim. **Deletion Test run live on the new global-mode test:**
temporarily widened the `onStudyMore` gate from `!isGlobal && !isInterrupt`
to `!isInterrupt` (i.e. reintroduced the pre-#569 gap for global mode
specifically), confirmed the new global-mode test failed (`data-has-study-more`
`"true"` instead of `"false"`) while the interrupt-mode test and the new
unit-mode test stayed green, then restored the real gate and confirmed all
13 tests pass again.

### #599 — non-null assertion evaluated before its precondition
`const currentCard = queue[pos]!;` was evaluated unconditionally before the
`if (isDone)` branch that's the only thing establishing `pos < queue.length`
— harmless today only because the `isDone` branch never reads `currentCard`,
but the assertion's own precondition wasn't checked before the assertion was
made.

**Fix:** moved the `currentCard` declaration to immediately after the
`isDone` block (which returns early), with a comment explaining why. No
behavior change — confirmed via the full test suite still passing at 13/13
in this file and via `tsc`/`eslint` staying clean.

### #595 — mode read with no entitlement check (documented as intentional, not a bug)
Per the brief and CLAUDE.md §5 (client-only, owner-confirmed honor-system
entitlement model), this is not a defect. **Fix:** added a clarifying
comment directly above the `mode`/`isGlobal`/`isInterrupt` reads stating this
explicitly and citing CLAUDE.md §5, so a future reader (or auditor) doesn't
re-flag it. No logic change.

---

## Verification gate

- `npx tsc --noEmit` — **2 pre-existing errors in `hooks/useStudySession.ts`
  (`Cannot find name 'mountFillDoneRef'`), confirmed via `git status` to be
  mid-edit by Adam's stream this wave** (explicitly listed as
  read-only-reference/off-limits to me, "Adam's stream is fixing this in
  Wave 5"). Zero errors in `app/study/page.tsx` or `app/study/page.test.tsx`
  (confirmed via a filtered grep of the same `tsc` run).
- `npx eslint app/study/page.tsx app/study/page.test.tsx` — 0 errors
- `npx vitest run app/study/page.test.tsx` — **13/13 passed** (10 pre-existing
  + 3 new: the #600 regression test and #590's two dedicated tests)
- Live Deletion Tests run for both new-assertion tasks (#600 and #590's
  global-mode test), both confirmed failing on the reverted production code
  and passing again once restored — see above for exact repro. #599 and #595
  were comment/reordering-only changes with no new assertions, so no
  Deletion Test applies to them; verified via the existing suite staying
  green plus `tsc`/`eslint`.
- Full `npm test` — **34 tests failed, all in `hooks/useStudySession.test.ts`
  (31) and `tests/seam_studyLoop.test.ts` (3)** — both off-limits files that
  import the real `hooks/useStudySession.ts` directly (currently mid-edit by
  Adam's stream, same `mountFillDoneRef` reference error `tsc` caught above).
  `app/study/page.test.tsx` fully mocks `@/hooks/useStudySession` (see the
  file's own `vi.mock` block) and never executes the real hook's code, so
  it's structurally unaffected — confirmed by the isolated
  `vitest run app/study/page.test.tsx` run above passing 13/13. 99 of 101
  test files passed; the other 1945 non-`useStudySession`-dependent tests
  all passed too.

Debt entries logged: 0
Carry-forward tasks generated: 0

`git status` at the end of this task showed only my two owned files plus
`hooks/useStudySession.ts` (Adam's stream, untouched by me, confirmed via
`git diff` that I made zero edits to it) modified — nothing unexpected found,
no `git stash` used.

No files outside `app/study/page.tsx` and `app/study/page.test.tsx` were
touched.

Barry is done.

— Barry | W5B | #600 #590 #599 #595
