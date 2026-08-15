CLOSED: #578 #579 #585 #586
NOT_CLOSED: none

## Task #578 — negative cardCount silently clamps with no logging

**File:** `supabase/functions/send-interrupt-notifications/dueEstimate.ts`

Added a defensive `console.error` in `buildNotificationPayload`, guarded on `estimate.cardCount < 0`,
firing before the `Math.min(Math.max(...))` clamp runs. Follows this file's sibling `dispatch.ts`'s
`[ERR-{CODE}-${Date.now()}]` convention: `[ERR-DUE-ESTIMATE-NEGATIVE-${Date.now()}]`. Clamp output
behavior is unchanged (still floors to `INTERRUPT_SESSION_FLOOR`) — this is diagnosability only, per
the task's explicit instruction not to change correctness behavior for a currently-unreachable path.

Tests added in `tests/pushDueEstimate.test.ts`: one asserting the exact log message + call count for
`cardCount: -3`, one asserting nothing is logged for a normal (`7`) value — proves the guard fires only
on the negative branch, not on every call.

## Task #579 — INTERRUPT_FLEX_DAILY_MAX has no mechanical doc-sync test

**File:** `tests/queue.test.ts`

Read `lib/queue.ts`'s current definition first, per the brief's explicit warning not to assume the
derivation hadn't changed: `INTERRUPT_FLEX_DAILY_MAX = INTERRUPT_SESSION_MAX_NEW * 3` is still the
live formula (confirmed Adam's Wave 3 stream, if it touched #562, didn't change this constant).
`docs/INTERRUPT_ARCHITECTURE.md` §10.1's documented value (`9`, `INTERRUPT_SESSION_MAX_NEW * 3`) still
matches exactly — **no doc edit was needed or made**, so `docs/INTERRUPT_ARCHITECTURE.md` is untouched
by this stream (verified via `git status`).

Added a new `describe("INTERRUPT_FLEX_DAILY_MAX derivation")` block in `tests/queue.test.ts` with two
tests: one asserting the formula (`=== INTERRUPT_SESSION_MAX_NEW * 3`) so the constant can never
silently drift from its derivation without a test failing, and one pinning today's literal value (`9`)
so a change to the *inputs* (e.g. `INTERRUPT_SESSION_MAX_NEW` itself) is visible even though the
formula-only test would still pass.

## Task #585 — lib/queue.ts silently drops stale ids

**File:** `lib/queue.ts`

`buildQueue` has two id→card lookup points that silently dropped unmatched ids: the `dueIds.map(...).filter(...)`
line, and the `getIntroductionDueCardIds` loop. Added a `console.warn` at each, following the same
`[ERR-{CODE}-${Date.now()}]` convention used elsewhere in `lib/` (e.g. `lib/packLoader.ts`'s
`[ERR-SEED-*]` lines): `[ERR-QUEUE-STALE-DUE-ID-...]` and `[ERR-QUEUE-STALE-INTRO-ID-...]`. Used
`console.warn` rather than `console.error` per the task's own judgment call — a stale id can be benign
(e.g. a deprecated card filtered from a pack update) rather than a hard failure.

Tests added in `tests/queue.test.ts`: one per lookup path, each injecting a `"ghost-id"`/`"ghost-intro-id"`
that has no matching `Card`, asserting (a) the id is silently dropped from the queue output as before
(behavior preserved) and (b) exactly one warning is logged with the expected message shape. Two more
tests assert no warning fires when every id resolves — proving the log is conditional, not unconditional
noise on every `buildQueue` call.

## Task #586 — inFlightSyncPromise not keyed by userId

**File:** `hooks/useSync.ts`

Replaced the single module-scope `let inFlightSyncPromise: Promise<SyncNowResult> | null` with
`const inFlightSyncPromises = new Map<string, Promise<SyncNowResult>>()`, keyed by `userId`. `syncNow()`
now looks up/sets/deletes by the calling `userId` instead of a single shared slot. Chose the Map approach
(the brief's first option) over an ignore-guard: it's a direct, small change and generalizes correctly —
concurrent calls for the *same* user still join one shared execution (preserving the original Task #520
race-condition fix this guard exists for), while a different user's call always gets its own independently-
tracked promise. Extended the existing module-scope comment to explain why keying matters (a sign-out
immediately followed by sign-in as a different user could otherwise hand the second user's caller the
first user's still-in-flight result).

Added one test to `hooks/useSync.test.ts`'s existing "concurrency guard" describe block: starts user-1's
sync with a controlled (never-auto-resolving) `downloadReviewEvents` mock, switches `mockAuthState.userId`
to `"user-2"` and re-renders, then calls `syncNow()` again and asserts it resolves independently (calls
`downloadReviewEvents("user-2")`, doesn't hang on user-1's still-pending promise). Resolves user-1's
deferred afterward and confirms its own promise separately resolves with `downloadReviewEvents("user-1")`.

**Deletion Test run directly against the fix** (temporarily reverted `hooks/useSync.ts` to the old
single-`let` guard, reran just this new test, restored afterward — confirmed via `git diff --stat`
showing the file back to its intended post-fix state): with the old code the new test **times out**
(the second `syncNow()` call hangs forever waiting on the first user's still-open promise) rather than
merely asserting a wrong value — about as strong a falsifiability proof as this class of bug allows.

## Verification gate (whole repo, not just my files)

- `npx tsc --noEmit` — clean, 0 errors (after fixing 3 `noUncheckedIndexedAccess` errors my own new
  `mock.calls[0][0]` test code introduced — switched to the codebase's existing `mock.calls[0]?.[0]`
  style, matching `tests/apnsClient.test.ts`/`tests/entitlement.test.ts`)
- `npm test` — 101 files, 1962 tests, all passed (1952 → 1962, +10 new tests across the four tasks)
- `npm run lint` — 0 errors (7 pre-existing warnings in unrelated files, not touched by this stream)
- `git status` — confirms every file I modified is one I own (`hooks/useSync.ts`,
  `hooks/useSync.test.ts`, `lib/queue.ts`, `tests/queue.test.ts`,
  `supabase/functions/send-interrupt-notifications/dueEstimate.ts`, `tests/pushDueEstimate.test.ts`);
  `docs/INTERRUPT_ARCHITECTURE.md` was correctly left untouched since #579 didn't require the doc edit.
  Other modified files in the working tree (`app/study/page.tsx`, `components/InterruptHandler.tsx`,
  `store/srsStore.ts`, etc.) belong to other Wave 3 streams running in parallel — none touched by me.
