CLOSED: #638 #642
NOT_CLOSED: none

# Derek — Stream W8D — Wave 8 — Completion (2026-08-17)

## #638 — negative cardCount masked as a legitimate floor case (severity 2)

Read `buildNotificationPayload` (`dueEstimate.ts`) and confirmed `computeDueEstimate` — the
only production caller, always chained directly in `dispatch.ts`'s `dispatchNotifications` —
can never produce a negative `cardCount` (it only ever increments a counter from 0). The
finding's own framing ("genuinely unreachable") is accurate.

**Judgment call:** the parameter type `{cardCount: number, ...}` is a plain object literal, not
structurally tied to `computeDueEstimate`'s return — nothing statically prevents a *future*
caller from passing corrupted data. I chose the small correctness improvement (throw) over
strengthening the comment alone, because the fix is essentially free given the existing
architecture: `dispatchNotifications`'s per-token loop already wraps this exact call in a
try/catch (`summary.erroredUnexpectedly`), which the file's own comments describe as existing
precisely so "a bug in any future addition to this chain should abort processing for ONE token,
never the rest of the batch." Throwing costs nothing beyond what that backstop already absorbs,
while the previous behavior (log + clamp to `INTERRUPT_SESSION_FLOOR`) would send a real user a
notification claiming "6 cards ready" backed by data that's already known to be corrupted —
masking a bug as normal behavior with only a log line as the trace. This matches
AGENTS.md/CLAUDE.md's general "don't silently proceed on corrupted invariants" posture.

**Fix:** `buildNotificationPayload` now throws `Error("buildNotificationPayload received a
negative cardCount: ${estimate.cardCount}")` instead of logging and falling through to the
clamp. Updated the one existing test in `tests/pushDueEstimate.test.ts` that asserted the old
clamp-and-log behavior to assert the throw instead (old test name/behavior fully superseded, not
kept alongside).

**Live Deletion Test performed**: reverted `dueEstimate.ts` via `git checkout --` (patch saved
first), ran the updated test alone — failed with the pre-fix behavior (no throw). Reapplied via
`git apply`, re-ran the full file — 16/16 pass. Also confirmed `dispatchNotifications`'s existing
per-token try/catch correctly absorbs the new throw (`tests/pushDispatch.test.ts` — 22/22 still
pass unchanged, since none of its fixtures produce a negative estimate).

## #642 — recordGateFired failure after a zero-estimate send undermines the daily cap (severity 3)

Read `sendAndRecord`'s existing `recordGateFired` handling (both branches) and
`dueSelection.ts`'s `selectDueTokens`, plus `supabaseAdmin.ts`'s `claimToken` CAS logic to
determine the real consequence of a failed write.

**Key finding that resolved the judgment call:** the two cases are NOT symmetric, even though
the pre-existing code treated them identically ("log it, move on"). `claimToken`'s own per-token
CAS guard always throttles on the token's plain `interrupt_interval_minutes` — it is never told
about the widened daily backoff. The ONLY mechanism that actually enforces "at most once per
day" for a zero-estimate send is `selectDueTokens` excluding the user via the
`interrupt_gate_events` row `recordGateFired` writes. So:
- Non-zero-estimate case: a failed write only costs cross-device coordination (a second device
  might also ping the user before the next successful write) — annoying, but this exact
  token/device is still correctly re-throttled by its own normal interval regardless.
- Zero-estimate case: a failed write, left unretried, reproduces the EXACT
  recurring-content-free-push-every-interval notification-fatigue bug (BRAND.md's stress-free
  principle — a real uninstall risk) that Task #623 exists to fix, for as long as the write keeps
  failing for that user.

Given that asymmetry, I concluded the same "log and accept" framing does NOT proportionately
apply to the zero-estimate case, and implemented a real fix rather than only documenting the
tradeoff.

**Fix:** wrapped the `recordGateFired` call in a bounded retry loop (3 total attempts, no
backoff delay). No delay was a deliberate choice: this loop is already sequential per token
(the file's own header comment on burst-control, reinforced by my own Task #621 reasoning from
Wave 7), so an unbounded or sleep-based retry would itself become exactly the volume problem
that comment discusses — an immediate retry costs one more `await`, nothing more, and still
recovers the dominant real-world failure mode for a single REST POST (a transient connection
blip). Applied uniformly to both zero and non-zero cases (simpler than branching the retry logic
by estimate) — the non-zero case gets a small resilience improvement as a side benefit, but the
retry's actual mandate comes from the zero-estimate case's more severe consequence, documented
explicitly in the code comment. The failure log (only emitted after all 3 attempts are
exhausted) now states the attempt count for operator clarity.

**Tests added to `tests/pushDispatch.test.ts`:** (1) updated the existing failure-log test to
match the new "(3 attempts)" message and reflect that every attempt failed; (2) a new test
confirming a late-succeeding retry (fails twice, succeeds on the 3rd attempt) results in no
failure log and `sent:1`; (3) a new test confirming the loop stops immediately on the first
success (never calls a 4th time when the 1st attempt already succeeds); (4) a new test
confirming exactly 3 attempts (not more) when every attempt fails.

**Live Deletion Test performed**: reverted `dispatch.ts` via `git checkout --` (patch saved
first), ran the 3 new/changed tests — all 3 failed against the pre-fix single-attempt code
(exact-message mismatch on the failure-log test; called-1-time-not-3 on the two retry-count
tests). Reapplied via `git apply`, re-ran the full file — 22/22 pass.

## Verification Gate (whole owned file set)

- `npx tsc --noEmit`, filtered to exclude the one pre-existing error in
  `components/InterruptHandler.tsx` (off-limits, another stream's file — see below): **0 errors
  in any file I own or touched.**
- `npx eslint` run directly against exactly my 4 owned files
  (`dueEstimate.ts`, `dispatch.ts`, `tests/pushDueEstimate.test.ts`, `tests/pushDispatch.test.ts`):
  **0 errors, 0 warnings.**
- `npx vitest run tests/pushDueEstimate.test.ts tests/pushDispatch.test.ts` — **38/38 pass**
  (16 + 22).
- `npm test` (full suite): **13 failures, all in `app/study/page.test.tsx`, none in a file I
  touched.** Root cause: `app/study/page.tsx` calls `useIsHydratedStrict` from `@/lib/storage`,
  but `lib/storage.ts` and/or `tests/storage.test.ts`'s mock are mid-edit by another stream and
  don't yet export it consistently (`No "useIsHydratedStrict" export is defined on the
  "@/lib/storage" mock`). Also observed a real syntax error in `components/InterruptHandler.tsx`
  at the time I ran `npx tsc --noEmit` (`'catch' or 'finally' expected`) — both
  `app/study/page.tsx`/`lib/storage.ts`/`tests/storage.test.ts` and
  `components/InterruptHandler.tsx`/`components/InterruptHandler.test.tsx` are explicitly listed
  under this brief's own "Off-Limits Files" and confirmed modified via `git status --short` —
  another stream's in-progress work, not mine. Flagging for visibility per the brief's own
  instruction ("confirm via git status before assuming that").
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again this wave).

No `git stash` was run at any point — both live Deletion Tests used `git checkout --
<single-owned-file>` (patch saved first) followed by `git apply` to restore, never touching any
file outside my ownership.
