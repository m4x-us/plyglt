CLOSED: #587 #592 #593 #594 #602 #605 #588 #596
NOT_CLOSED: none

## #587 (P1, sev 8, data-loss) — the priority fix

Root cause confirmed by reading the current `app/study/page.tsx` (read-only this
wave): it destructures `cards`/`introductions` from `useSRSStore()` and calls
`useStudySession(...)` unconditionally at line 84-85, and only computes/checks
`useIsHydrated(useSRSStore)` at line 87-88, AFTER the hook call. On Tauri (async
file-store IPC hydration), the mount-fill effect can therefore fire with `allCardMap`
already populated (Italian's pack loads synchronously via STATIC_PACKS) while
`cards`/`introductions` are still pre-hydration `{}` defaults — an `introduceCard`
call in that window writes into an in-memory `introductions` map that Zustand
persist's `hydrate()` then wholesale-replaces moments later, silently discarding the
record.

**Fix:** since `app/study/page.tsx` is off-limits this wave (owned by another stream)
and already calls the hook before it could compute/pass a `hydrated` value, the only
self-contained fix is for `useStudySession` to compute hydration readiness itself:
added `const hydrated = useIsHydrated(useSRSStore);` (new value imports:
`useSRSStore` from `@/store/srsStore`, `useIsHydrated` from `@/lib/storage` — both
read-only imports, no changes to either file) and added `if (!hydrated) return;`
to the mount-fill effect's guard, alongside the existing `allCardMap` emptiness
check, plus `hydrated` added to the effect's dependency array (`[allCardMap,
hydrated]`) so the fill pass gets a real second chance once hydration completes —
exactly mirroring how Task #573 solved the sibling pack-loading race.

**Test:** added `describe("useStudySession — SRS-store hydration gating (Task #587)")`
with two tests. The race-reproducing test spies on `useSRSStore.persist.hasHydrated`
(not `useIsHydrated` itself — see the test's own comment: mocking the whole hook
broke React's Rules of Hooks, since the mocked call skipped
`useSyncExternalStore`/`useState`/`useEffect` on the first render while the real
implementation invoked them on rerender, and `mockReturnValueOnce` alone also failed
because React's `useSyncExternalStore` calls `getSnapshot` more than once per render
for tearing checks) to simulate "pack ready, store still hydrating," asserts
`introduceCard` is NOT called and the queue stays empty, then simulates hydration
completing and asserts the fill pass runs correctly. A second test confirms the
common already-hydrated case is unaffected. **Live Deletion Test**: temporarily
removed the `if (!hydrated) return;` guard — the race test failed exactly as
expected (`introduceCard` called once, when the assertion expected zero calls) —
then restored the file byte-for-byte (`diff` confirmed identical).

## #592 + #593 (error-handling) — fixed together, same root cause

`mountFillStartedRef.current = true` (renamed, see #594) is set BEFORE any fill logic
that can throw runs, and the effect had no try/catch — so (#592) a mid-pass throw
would permanently strand already-`introduceCard`'d cards (recorded in the store,
consuming today's cap, never reaching the visible queue, no retry since the ref
already latched), and (#593) the exception would propagate out of the effect
uncaught, with no error boundary around `/study` to catch it (out of scope for me
to add — I only own `hooks/useStudySession.ts`/`.test.ts`, not any route/component
file).

**Fix:** wrapped the normal-cap + interrupt-fill logic in `try { ... } catch (e) {
console.error(...) } finally { if (added.length > 0) setQueue(...) }`. The catch logs
the failure explicitly (never a silent swallow, per AGENTS.md's stop-the-line rule)
with an `[ERR-STUDY-SESSION-FILL-...]` prefix; moving the `setQueue` flush into
`finally` means whatever DID make it into `added` before the failure is still shown
to the user, rather than a partial success being silently discarded on top of being
partial. This structurally resolves #593 too: since the fill logic (the only code in
this effect that can throw — `selectQualifyingNewCard`, `introduceCard`,
`getNearDueCards`) is now fully contained, no exception from it can escape the effect
at all in the current code, closing the specific gap #593 named without requiring a
route-level error boundary (a separate architectural decision for whoever owns
`app/study/page.tsx`).

**Test:** added `describe("useStudySession — mount-fill effect error containment
(Tasks #592/#593)")` with two tests: one asserting `renderHook(...)` does not throw
and `console.error` is called with the exact prefix pattern; one asserting a card
introduced via the normal-cap path BEFORE a `getNearDueCards` throw is still present
in `result.current.queue` afterward. **Live Deletion Test**: temporarily removed the
try/catch/finally (replacing with an unconditional `if (true) { ... }` block plus
the bare unconditional `setQueue`) — both new tests failed exactly as expected (one
`.not.toThrow()` assertion failed with the real thrown error, the other's
`renderHook` call itself threw) — then restored the file byte-for-byte.

## #594 (code-quality) — ref renamed and re-commented

Renamed `mountFillDoneRef` → `mountFillStartedRef` and rewrote its comment to state
explicitly: "true once the mount-fill effect below has CLAIMED its one real attempt
— not once that attempt has successfully finished... set at the very start of the
guarded block, before any of the fill logic that can throw runs." This directly
compounds with — and no longer contradicts — the #592/#593 try/catch/finally fix,
which is exactly what happens when the ref is claimed before an attempt that can
still fail.

## #602 (code-quality) — readiness-invariant comment corrected

The old comment claimed allCardMap-emptiness "can only mean 'not loaded yet,' never
a legitimate steady state" — technically false in two reachable cases named by the
finding: a pack-load error, and an invalid `unitId` (both leave `allCards`/
`allCardMap` permanently empty). Rewrote the comment to describe allCardMap-emptiness
as "a reliable STARTING signal... but not proof-positive of 'still loading,'" and
explicitly names both edge cases, stating why they're harmless (the guard simply
never finds anything to fill from either — the same correct no-op outcome).

## #605 (async) — mixed live-read/snapshot pattern documented, not restructured

Confirmed the effect body (loops, closures, all store-backed calls) is 100%
synchronous JavaScript with zero `await`/yield points — `canIntroduceNewCard`,
`introduceCard`, `getNearDueCards` are all synchronous functions (verified their
type signatures: no `Promise` return types). Since JS is single-threaded and this
effect runs as one uninterruptible synchronous block, there is no actual window for
a "sync-triggered background patch" to interleave between the live `get()` reads and
the snapshot values (`cards`/`introductions`/`allCardMap`) — such a patch could only
take effect before the effect starts or after it fully finishes, never during it.
Documented this reasoning directly above `sessionIds`'s declaration rather than
restructuring the DI pattern (which would ripple into every store-backed param in
this hook and the off-limits `app/study/page.tsx` call site) — a proportionate,
in-scope fix for a severity-4 finding whose actual exploit window does not exist
within a single effect pass.

## #588 (edge-case, sev 2) — comment-only, no functional change

`mountFillStartedRef` making this a true one-shot per session instance means a later
legitimate `allCardMap` growth (e.g. a specialty-pack merge completing after mount)
would not trigger a second fill pass. Per the finding's own text ("no specialty pack
is registered ready:true today, so this path has no real caller today") and its
severity (2, well below AGENTS.md's severity-≥7 must-fix-now threshold — this is
debt-by-default territory), added a comment documenting the limitation as accepted,
with a pointer to revisit if that changes, rather than building re-fill machinery for
a hypothetical caller.

## #596 (async, sev 1) — reconfirmed, comment extended in place

The cross-tab race on `INTERRUPT_FLEX_DAILY_MAX` was already documented and accepted
under CLAUDE.md §5's client-only honor-system model (originally Task #577, Wave 3).
Added one sentence to the existing comment noting this wave's audit re-confirmed the
risk is unchanged with no new exploitation surface — no functional change, matching
the finding's own severity-1 framing.

## Verification
- `npx tsc --noEmit` — clean
- `npm test` — 1983/1983 passed (101 files, includes other streams' concurrent Wave 5 work)
- `npm run lint` — 0 errors, 7 pre-existing warnings (none in files this stream
  touched; one transient warning I introduced myself — an unused
  `eslint-disable-next-line react-hooks/set-state-in-effect` inside the new `finally`
  block — was caught by re-running lint and removed before closing)
- Live Deletion Tests run for #587 and #592/#593 (the two behavior-changing fixes),
  each confirmed to fail against the reverted pre-fix code and then restored
  byte-for-byte (`diff` against a `/tmp` backup confirmed identical each time)
- #594/#602/#605/#588/#596 were code-quality/documentation/comment fixes with no
  behavior change — verified by re-reading the final file and confirming the
  test suite is unaffected, not via Deletion Test (nothing to delete)
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again) —
  substituted the real Verification Gate as the brief instructed
- `git status` confirms only `hooks/useStudySession.ts` and
  `hooks/useStudySession.test.ts` changed within this stream (no off-limits files
  touched; other streams' concurrent changes to `app/study/page.tsx`,
  `store/srsStore.ts`, `tests/srsStore.test.ts`, `CLAUDE.md` etc. observed via
  system reminders during this session but never edited)

No messy/unexpected `git status` state encountered — no `git stash` was run at any point.

Debt entries logged: 0
Carry-forward tasks generated: 0
