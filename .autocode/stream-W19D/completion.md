CLOSED: #450 #451 #452 #453
NOT_CLOSED: none

## #450 — EntitlementValidator test-quality + gate widening

**Test fix:** the "mounts UpdateChecker" test previously asserted `expect(result).not.toBeNull()`
on `EntitlementValidator()`'s return value — trivially true for ANY non-null return
(a `<div/>`, a string, anything). Replaced with `expect(result.type).toBe(UpdateChecker)` +
`expect(result.props).toEqual({})`, proving the component actually returns exactly
`<UpdateChecker />` (imported the real, mocked `UpdateChecker` reference to compare against).

**Existence-only assertions:** both `.toBeGreaterThan(0)` assertions on `lastValidated`
(lines 128, 164 originally) replaced with bounded-range checks
(`toBeGreaterThanOrEqual(before)` / `toBeLessThanOrEqual(after)`, captured around the call) —
value-specific per the acceptance criteria's second option, not an `// existence-check:`
justification, since `Date.now()` here is bounded and checkable, not truly non-deterministic.

**Gate widening:** AGENTS.md's grep command now scans the whole repo
(`--include="*.test.*" --exclude-dir=node_modules --exclude-dir=.claude --exclude-dir=.next`)
instead of `tests/` only. Running the widened command surfaced my OWN new violations first —
my explanatory comments literally contained the strings `.toBeGreaterThan(0)` and
`.not.toBeNull()` as prose (matched by the naive grep), so I reworded them to describe the
banned patterns without reproducing the literal substrings.

**Scope discovery (important — read before assuming the gate is green):** after fixing my
own file, the widened command still finds ~30 pre-existing existence-only assertions across
12 component/hook test files this stream does not own (Stat.test.tsx, StudyDoneScreen.test.tsx,
BuyModal.test.tsx, InterruptHandler.test.tsx, DifficultyBar.test.tsx, UnitRow.test.tsx,
StudyCard.test.tsx, StudyResumePrompt.test.tsx, LevelSection.test.tsx, settings/Section.test.tsx,
settings/Toggle.test.tsx, useStudySession.test.ts). The task's acceptance criteria assumed
EntitlementValidator.test.tsx was the only instance outside `tests/`; the actual scan proves
otherwise. I did NOT fix these — they're outside "Files You Own" for this stream, several
are almost certainly owned by other Wave 19 windows right now, and mass-editing 12 files
across the whole test suite is a "Full" scope task, not a fit for a "Direct — 2 files"
classification. Logged as a new debt.md entry (2026-07-28, Task #450/W19D) with the full
file list, severity 4, complexity Full, so a future task picks this up deliberately rather
than someone assuming the widened gate is already green.

## #451 — security.md S1/S3 staleness

Pure documentation fix, no code/test changes. Verified both claims before writing anything:
- S1: `store/entitlementAddOns.ts:96` — `purchaseAddOn`'s first guard already is
  `if (!isSpecialtyPackCode(code)) return { ok: false, error: ERR_ADDON_INVALID_CODE }`.
  Confirmed fixed at Task #287; the old citation (`store/entitlementStore.ts:137`) predates
  Task #412's extraction into the new file.
- S3: `lib/specialtyPackLoader.ts`'s `deactivationGuard.isStale(entryGeneration)` is checked
  at both line 122 (pre-fetch) and line 177 (immediately pre-merge) — confirmed via grep,
  matching the task's Task #394/#409 claim exactly.

Moved both into a new `## Resolved Findings — S1 / S3 (Task #451/W19D, 2026-07-28 — both
already fixed, tracker was stale)` section (mirroring the existing dated
`Resolved Findings — Task #326` section's style) with corrected file:line citations, and
removed them from `## Open / Monitoring` (which now only has F5, F6, S2).

## #452 — hollow #435 hydration test

The "does not reconcile when hydration finishes normally" test never advanced fake timers
past `HYDRATION_FAILSAFE_MS`, so the failsafe's setTimeout callback — the only place that
registers the late-reconciliation listener — never fired; the reconciliation code being
present or entirely deleted produced an identical (passing) outcome.

**Design note:** a pure "nothing needs reconciling" scenario is fundamentally unable to
prove reconciliation code exists via its own final-state outcome — "correctly decided not
to restore anything" and "has no restoration logic at all" are observationally identical
in every combination I tried (confirmed by hand-tracing before settling on the fix below).
The fix instead adds test-only introspection: `makeFullStore` now exposes
`__finishListenerCount()` (the finish-listener `Set`'s size). The failsafe's own
late-reconciliation listener is a second, genuinely new registration on top of the base
`useSyncExternalStore` subscription — the Set's size grows from 1 to 2 specifically because
of it, once the timer is advanced. A raw call-count spy on `onFinishHydration` was tried
first and rejected: `useIsHydrated`'s subscribe closure isn't memoized, so
`useSyncExternalStore` tears down and re-establishes the BASE subscription on every
unrelated re-render (a real, harmless React implementation detail, not a bug) — this made
call counts noisy (3, not the expected 2) while the Set's net size stays stable across that
churn (unsub+resub is a no-op on size).

**Deletion Test performed and reverted:** temporarily changed `lib/storage.ts`'s
`if (getState && setState)` to `if (false && getState && setState)`, confirmed the new
assertion (`__finishListenerCount()` stays at 1, expected 2) fails, then reverted
(confirmed via `git diff` — empty). `lib/storage.ts` is not owned by this stream; edited
only for this transient verify-then-revert, matching the pattern from prior waves.

## #453 — useLicenseActivation pseudocode test

Replaced `lastValidated: expect.any(Number)` with a captured `before`/`after` window
(`Date.now()` around the `handleActivate()` call) and bounded assertions
(`toBeGreaterThanOrEqual(before)` / `toBeLessThanOrEqual(after)`) — mirroring
`hooks/useExportImport.test.ts`'s sibling pattern the task cited, adapted for a genuinely
non-deterministic `Date.now()` stamp (vs. that test's fixed literal `0`).

**Deletion Test performed and reverted:** temporarily changed
`hooks/useLicenseActivation.ts`'s `lastValidated: Date.now()` to `lastValidated: 0`,
confirmed the test now fails (`expected 0 to be greater than or equal to <timestamp>`),
then reverted (confirmed via `git diff` — empty). `hooks/useLicenseActivation.ts` is not
owned by this stream; edited only for this transient verify-then-revert.

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` (full suite) — 62 files, 1365 tests, all passed.
- `npm run lint` — zero errors (4 warnings: 3 pre-existing/unrelated, 1 new
  `react-hooks/exhaustive-deps` warning in `hooks/useLangPack.ts` from another window's
  concurrent Task #442 work, not mine).
- Widened Verification Gate grep — 0 hits in every file this stream touched; the ~30
  remaining hits are exactly the pre-existing debt logged above, all in files outside this
  stream's ownership.

Debt entries logged: 1 (the widened-gate scope discovery, `.autocode/debt.md`, 2026-07-28,
Task #450/W19D, severity 4, complexity Full)
Carry-forward tasks generated: 0 (logged as debt instead, per the debt-register convention —
"Full items require their own dedicated task")
