CLOSED: #591 #601 #604 #598
NOT_CLOSED: none

# Derek — Stream W5D — Wave 5 — Completion

## #591 — sendNativeNotification success ≠ OS actually displayed it (severity 5)

Investigated whether `@tauri-apps/plugin-notification` (v2.3.3, checked directly against its
own `dist-js/index.d.ts`) exposes any stronger delivery signal than the async wrapper's
resolution. It does not: `sendNotification(options): void` is fire-and-forget with no
delivery callback, receipt, or "shown" event. `lib/tauri.ts`'s `sendNativeNotification`
doesn't even await the underlying call — its returned promise resolving only proves the
dynamic import + synchronous plugin call didn't throw.

Given no stronger signal exists, documented this as an accepted best-effort limitation with a
comment at the `markFired()` call site in the passive-notification branch
(`components/InterruptHandler.tsx`), matching this project's honor-system-style trade-offs
elsewhere (CLAUDE.md §5) rather than inventing an unverifiable OS-level check. No behavior
change — this was a judgment call the task brief explicitly allowed for ("the honest fix may
be a code comment").

Verification: doc-only change, no new test required; existing 25 tests in
`InterruptHandler.test.tsx` still green.

## #601 — interrupt:fire listener has no top-level try/catch (severity 5)

Wrapped the entire `listen("interrupt:fire", async (isMandatory) => { ... })` callback body in
a top-level `try/catch` that logs via `console.error` with an `[ERR-INTERRUPT-FIRE-...]`
prefix, per AGENTS.md's stop-the-line rule ("every catch block must surface the error to the
user or log it explicitly"). Previously only specific sub-calls (`enterMandatoryMode`,
`markInterruptFired`, `recordInterruptGateEvent`, the notification-send branch) were
individually guarded — an uncaught throw from `computeDue(units)` or
`readInterruptGateState(userId)` produced a silent unhandled rejection with zero trace.

Added a new test: "logs the failure and does not crash when readInterruptGateState rejects"
(`components/InterruptHandler.test.tsx`, describe block "top-level error handling (Task
#601)"). **Live Deletion Test performed**: reverted the `.tsx` fix via
`git checkout -- components/InterruptHandler.tsx` (saved as a patch first), re-ran the new
test alone — it failed with the raw `Error: network down` propagating out of the test,
confirming the assertion is real. Reapplied the patch via `git apply`, re-ran the full test
file — 25/25 pass.

## #604 — canIntroduceNewCard's guarantee is not uniform across call sites (severity 4)

Read both real call-site shapes: `hooks/useStudySession.ts`'s two sites call
`canIntroduceNewCard` and act on the result in the same synchronous tick (an atomic
check-then-act). `hooks/useInterruptConfig.ts`'s `computeDue` is structurally different — its
result is estimated once, handed to the native OS notification layer
(`components/InterruptHandler.tsx`), and only "consumed" whenever (if ever) the user taps that
notification, an unbounded gap during which store state can change arbitrarily.

This is inherent to push-notification timing, not something a small code change inside
`computeDue` can close without redesigning the notification pipeline (out of this task's
single-file scope, matching the project's existing acceptance of Task #580's similar
notification-undercount limitation). Judgment: no safe small correctness improvement exists
here that wouldn't require restructuring how/when the estimate is consumed — the actual safety
net is that `hooks/useStudySession.ts`'s mount effect already re-checks `canIntroduceNewCard`
fresh, same-tick, at session-open time, so a stale "yes" from `computeDue` never bypasses a
live check before a card is actually introduced. Documented this explicitly in a comment on
`computeDue` (`hooks/useInterruptConfig.ts`).

Verification: doc-only change; existing 16 tests in `useInterruptConfig.test.ts` still green
(no Deletion Test applicable — no new assertion was added).

## #598 — newCardDue misleadingly named after being reassigned for near-due reviews (severity 2)

Renamed `newCardDue` → `hasQualifyingContent` throughout `computeDue`
(`hooks/useInterruptConfig.ts`) via `replace_all`. The old name was accurate only at its first
assignment (a qualifying new card); the same variable gets reassigned later in the function
when a near-due FSRS review — not a new card — is the actual reason the interrupt can fire
(Batch 23's near-due mirror). Pure rename, zero arithmetic change; confirmed with a full read
of the post-edit function that every comment near each reassignment site is still accurate
under the new name.

Verification: `grep newCardDue hooks/useInterruptConfig.test.ts` — no matches, confirming the
test file never referenced the old internal variable name directly (it only asserts on
`computeDue`'s return value). 16/16 tests in that file still pass unchanged.

## Verification Gate (whole owned file set)

- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors (7 pre-existing warnings in unrelated files, untouched by this
  wave)
- `npm test` — 101 files / 1984 tests, all green (includes 25/25 in
  `InterruptHandler.test.tsx` and 16/16 in `useInterruptConfig.test.ts`)
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again this wave, per the
  architect memory note) — the Verification Gate above is the real acceptance criterion.

No `git stash` was run at any point. `git status` was clean before starting except for this
wave's own in-progress edits across other streams' owned files (not touched).
