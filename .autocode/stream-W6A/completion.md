CLOSED: #618 #610 #608 #612 #615 #619 #620
NOT_CLOSED: none

All 7 tasks closed. Two (#619, #620) closed via investigation + honest documentation
rather than a code fix, since their real fixes require editing files off-limits to this
stream this wave — explained in detail below, per the brief's own instruction not to
silently pick an option or edit an off-limits file "to just finish it."

## #618 — shared 3-tier decision logic (code-quality, sev 5)

Extracted the ONE condition that has actually drifted before (per the finding's own
Task #523/#539 history) — the flex-gate check
`canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` — into a new exported function
`canFlexIntroduceToday(canIntroduceNewCard, today)` in `hooks/useInterruptConfig.ts`
(the natural conceptual home, following that file's existing `export { isInDnd }`
pattern of co-locating shared pure helpers). Both `computeDue` (same file) and
`hooks/useStudySession.ts`'s mount-fill effect now call this single function instead of
each hand-rolling the condition.

**Deliberately did NOT unify the full 3-tier decision** (tier 1 normal-cap search, tier
3 near-due fallback search) — those legitimately search different data shapes
(`computeDue` probes per-unit via `getNewCards`; `useStudySession` probes the whole
session's `allCardMap` via `selectQualifyingNewCard`). Forcing them into one shared
function would trade real, working code for a fragile abstraction. Instead, added
explicit cross-referencing comments at each file's tier-3 (near-due) block, pointing at
the sibling file's matching block, so a future change to "what counts as near-due
fallback-worthy" can't be made in one file without a comment flagging the other.

**Design decision — file ownership constraint:** the brief suggested `lib/queue.ts` or
"a new small module" as the natural home for this extraction, but `lib/queue.ts` was
not in my file-ownership list this wave, and creating an unlisted `lib/` file carried
the same ambiguity. Chose to co-locate in `hooks/useInterruptConfig.ts` (an owned file)
instead — documented in the function's own doc comment that `lib/queue.ts` is the
better long-term home and that relocating it later is a pure move, not a behavior
change.

This extraction directly sets up Wave 7's deferred #617 (adding
`INTERRUPT_SESSION_CAP`-awareness to the daily-cap tier) to be a single-place change.

## #610 — computeDue hydration gate (async, sev 4)

Initial implementation called `useIsHydrated(useSRSStore)` as a new hook inside
`useInterruptConfig()` — this broke `components/InterruptHandler.test.tsx` (off-limits,
owned by Derek's stream this wave), whose mock of `useSRSStore` doesn't provide a
`.persist` shape. **Redesigned rather than touch that off-limits file**: `computeDue` is
invoked from `components/InterruptHandler.tsx`'s `interrupt:fire` event-handler closure,
not render output — so it doesn't need a React-reactive hydration value at all. Switched
to a plain, non-reactive check: `if (useSRSStore.persist?.hasHydrated() === false) return 0;`,
called fresh at event time (matching the existing `useSRSStore.getState()` read style
immediately below it), with optional chaining as defense against test doubles that stub
`useSRSStore` without the real `persist()` wrapper (a genuine Zustand persist-created
store always has `.persist`). This required NO new hook call in `useInterruptConfig()`
and is fully compatible with the existing (unmodified) `InterruptHandler.test.tsx` mock.
Fixed my OWN `hooks/useInterruptConfig.test.ts`'s mock to add a `.persist` shape for the
dedicated hydration-gate tests I added there.

Live Deletion Test: reverted the guard, confirmed the new test failed, restored.
Verified full suite green including `components/InterruptHandler.test.tsx` (25/25,
untouched by me).

## #608 — migrate to peekResumableSession/clearExpiredResumableSession (requirements, sev 6)

Migrated all 4 real-but-unsafe call sites named in the brief:
- `hooks/useStudySession.ts`'s `resumeDecision` `useState` lazy initializer → now
  starts at `null`; resolved via a new `useEffect` gated on the same `hydrated` signal
  the mount-fill effect uses, calling `clearExpiredResumableSession()` then
  `peekResumableSession()`.
- `resumedQueue`/`resumedPos` `useMemo` bodies → swapped `getResumableSession()` for
  `peekResumableSession()` (render-phase-safe by its own doc comment).
- `app/study/page.tsx`'s render-body call inside `resumeDecision === "pending"` →
  swapped to `peekResumableSession()`.

Left ONE remaining `getResumableSession()` call site (inside `useStudySession.ts`'s
"apply resume" effect, reading `saved?.sessionCorrect`/`sessionTotal`/`startedAt`)
unchanged — it's already inside a `useEffect`, never render-phase, so it was never part
of the unsafe-call defect class, and the brief's own task listing didn't name it.

**Design decision (per the brief's explicit prompt):** used a `useEffect` gated on
`hydrated` (not `useLayoutEffect`) to resolve `resumeDecision`, per the brief's own
suggested shape. This closes Task #609 (deferred, hydration-race on these same reads)
as a bonus, since the resolution now cannot run before real hydration completes.
Considered `useLayoutEffect` to avoid a one-frame flash on the common already-hydrated
path, but rejected it — this route IS server-rendered for its initial HTML (confirmed
via `lib/storage.ts`'s own `getServerSnapshot: () => false` comment), so
`useLayoutEffect` here would trigger React's real SSR-mismatch dev warning; the
`useEffect` approach avoids that entirely and matches what #609 will need already
closed.

Live Deletion Test: reverted the hydration guard on the new effect, confirmed the new
test ("does not resolve resumeDecision before hydration completes...") failed exactly
as expected, restored.

**Necessary out-of-ownership fix:** the interface change (`UseStudySessionParams` now
requires `peekResumableSession`/`clearExpiredResumableSession`) is a breaking change to
`useStudySession`'s public signature. This broke `tests/seam_studyLoop.test.ts` (3 call
sites), which is not in my "Files You Own" list but also isn't in the off-limits list —
no stream appears to own it this wave. Rather than leave `npx tsc --noEmit` failing
repo-wide, made the minimal, purely-additive fix (adding the 2 new mock params at each
of the 3 call sites, mirroring the exact pattern already used for every other real-store
param there). Documented this explicitly here rather than silently doing it.

## #612 — page.tsx over 150-line cap (code-quality, sev 3)

Started at 185 lines (181 pre-#608, +4 from #608's new params). Extracted two pieces,
following the `hooks/useSnoozeAndExit.ts` precedent CLAUDE.md documents for this exact
file:

1. `hooks/useStudyQueueSetup.ts` (new) — the `allCards`/`unit`/`prereqsMet`/
   `initialQueue`/`allCardMap` `useMemo` block (a real React hook, since it calls
   `useMemo`). Pure computation, no JSX, importable/testable in isolation — matching the
   brief's note that Wave 7's deferred #616 needs exactly this for a rewritten
   `app/study/page.test.tsx`.
2. `hooks/studyDoneScreenProps.ts` (new) — the `isDone` branch's `pct`/`stillDue`/
   `onStudyMore` derivation. Deliberately a PLAIN function (`computeStudyDoneScreenProps`,
   no "use" prefix, calls no hooks internally), NOT a React hook — `page.tsx`'s `isDone`
   branch sits after several earlier conditional early returns
   (hydrated/packLoading/unit-not-found/empty-queue), so anything called only inside that
   branch cannot itself be a hook without violating the Rules of Hooks.

Also trimmed several verbose inline comments (condensed, not deleted — same facts,
fewer words) to close the remaining gap: the `getNearDueCards` cost comment (now
pointing at `useStudySession.ts`'s fuller version, which I also expanded for #620), the
Task #595 entitlement-gate comment, and the Task #518 sync-nudge comment.

**Design decision — new files outside nominal ownership:** same tension as #618, but
here the brief's language was directive ("Whatever you extract to, name the new file
clearly" — explicitly anticipating a new file) and there's a direct, already-shipped
precedent (`useSnoozeAndExit.ts`) for extracting FROM this exact file INTO a new
`hooks/` file. Proceeded on that basis.

Final: **149 lines** (under the 150-line cap). Verified `app/study/page.test.tsx`
(13/13) passes unmodified — Vitest's module-path mocking of `@/lib/queue`'s
`buildQueue` transparently covers the new extracted files too, since they import from
the same module path.

## #615 — statements before the try block (error-handling, sev 3)

Moved `mountFillStartedRef.current = true`, `setQueue(initialQueue)`, and the
`sessionIds`/`introducedIds`/`today` construction all inside the try block Tasks
#592/#593 (Wave 5) added — they were previously BEFORE it, so a throw from any of them
(the finding's own example: a malformed `initialQueue` entry crashing
`.map((c) => c.id)`) was NOT contained. `added` (needed by the `finally` block) stays
declared OUTSIDE the try as `const added: Card[] = [];` — an empty-array literal cannot
itself throw, so it needs no protection, and block-scoping means it must be declared
outside try to remain visible in `finally`.

Added a new regression test proving containment now extends to the sessionIds
construction specifically (a malformed `initialQueue` entry). Live Deletion Test:
temporarily moved the same 3 statement groups back outside the try, confirmed the new
test failed with the real uncaught `TypeError`, restored.

Also required adding one `// eslint-disable-next-line react-hooks/set-state-in-effect`
above the relocated `setQueue(initialQueue)` call — the lint rule apparently only fires
in this specific code shape/position (it didn't fire before the statements moved into
the try), confirmed by re-running `npm run lint` before/after.

## #619 — sequential introduceCard persist writes (async, sev 5) — investigated, NOT code-fixed

**Investigation (as the brief asked, "if it does [serialize], this finding is already
safe and the fix is a clarifying comment"):** read
`node_modules/@tauri-apps/plugin-store/dist-js/index.js` directly. Each `Store.set()`
call is an independent `invoke('plugin:store|set', {rid, key, value})` IPC round-trip —
no visible client-side queue or lock forcing FIFO completion order. `lib/storage.ts`'s
`setItem` (read-only reference) does `await store.set(key, value)` per call, with no
serialization of consecutive calls. **Conclusion: NOT verified safe — the finding's
concern is real.** Since each Zustand persist write is a FULL state snapshot (not an
incremental patch) captured synchronously in-memory before the async write starts, the
actual risk is narrow but real: if a LATER (more complete) write's promise resolves
BEFORE an EARLIER (staler) one's, the stale write overwrites the correct one on disk —
in-memory state stays correct regardless; only the persisted copy could regress, until
the next unrelated save corrects it.

**Why not code-fixed:** the brief's own suggested real fix ("batch all cards to
introduce first, then commit via a single set() call") requires a new batched
introduce-multiple-cards action in `store/srsStore.ts` (its own file-size extraction is
explicitly deferred to Task #613 next wave — off-limits to me this wave) and/or
serializing consecutive persist writes in `lib/storage.ts` (being redesigned by a
parallel stream this wave — also off-limits). Neither fix fits inside my file
ownership. Per the brief's explicit instruction not to edit an off-limits file "to just
finish it," documented the full investigation, the honest conclusion, and the specific
blocker directly in `hooks/useStudySession.ts`'s own comment (at the `introduceNext`
function, where the repeated calls happen) and here, rather than silently leaving the
finding unaddressed or writing a false "verified safe" comment.

## #620 — getNearDueCards(MAX_SAFE_INTEGER) scan (performance, sev 3) — investigated, NOT code-fixed

**Investigation:** confirmed `getNearDueCards` (store/srsStore.ts, read-only reference)
filters+sorts the entire catalog before slicing to `limit` — genuine O(n log n) work,
~30K cards per CURRICULUM.md's 2026-08-03 count, run synchronously in the mount effect
on every interrupt-session open.

**Why not code-fixed:** the brief's suggested optimization ("getNearDueCards accepting
an exclusion set so it can filter+sort+early-terminate in one pass") requires changing
`store/srsStore.ts`'s implementation — off-limits this wave for the same #613-deferral
reason as #619. The brief explicitly said "either is acceptable" (implement or
document) for this specific finding, so per that explicit permission, chose to leave it
as accepted debt and strengthened the existing comment — it previously claimed "asking
for everything adds no real cost," which is the exact "not yet measured" overclaim the
brief called out. Rewrote it to state the real O(n log n) cost explicitly, name the
real fix and why it's blocked, and state the actual accepted trade-off (a few ms per
call at current scale, revisit past ~100K cards or on real profiling evidence) rather
than asserting "no real cost."

## Verification
- `npx tsc --noEmit` — clean (whole repo)
- `npm test` — 1997/1997 passed (101 files, includes other streams' concurrent Wave 6
  work — `components/InterruptHandler.test.tsx`, `lib/storage.ts`,
  `supabase/functions/send-interrupt-notifications/*`, etc. — all modified by other
  streams, none touched by me, all still passing)
- `npm run lint` — 0 errors, 7 pre-existing warnings (none in files this stream
  touched; one transient error I introduced myself during #615's restructuring — a
  missing `react-hooks/set-state-in-effect` disable comment — was caught by re-running
  lint and fixed before closing)
- Live Deletion Tests run for #610 and #608 (both behavior-changing hydration-gate
  fixes) and #615 (the try-block extension) — each confirmed to fail against the
  reverted pre-fix code, then restored byte-for-byte (`diff` against `/tmp` backups
  confirmed identical each time)
- #618, #612 were structural/extraction changes verified by full test-suite parity
  (identical pass counts before/after) rather than a targeted Deletion Test, since
  they're refactors with no intended behavior change
- #619, #620 are documentation-only changes for this wave (investigated, no code fix —
  see above) — no Deletion Test applicable
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again) — substituted
  the real Verification Gate as the brief instructed
- `git status` confirms: my owned files changed
  (`hooks/useStudySession.ts`/`.test.ts`, `hooks/useInterruptConfig.ts`/`.test.ts`,
  `app/study/page.tsx`), 2 new files created (`hooks/useStudyQueueSetup.ts`,
  `hooks/studyDoneScreenProps.ts`, both documented above), and exactly one necessary
  out-of-ownership fix (`tests/seam_studyLoop.test.ts`, minimal/additive, documented
  under #608 above). All other modified files in `git status` belong to other
  streams' concurrent Wave 6 work — not touched by me.

No messy/unexpected `git status` state encountered at any point. No `git stash` was
run.

Debt entries logged: 2 (#619, #620 — both documented in-code with the specific blocker
and the exact real fix needed, for whichever stream next owns `store/srsStore.ts`
and/or `lib/storage.ts`)
Carry-forward tasks generated: 0 (both debt items already tracked as #619/#620 by the
audit; no new task numbers needed)
