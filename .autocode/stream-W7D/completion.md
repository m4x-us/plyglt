CLOSED: #621
NOT_CLOSED: none

# Derek — Stream W7D — Wave 7 — Completion

## #621 — dispatch.ts's zero-estimate send-volume concern (severity 3)

Read `dispatch.ts`'s `dispatchNotifications`/`sendAndRecord` in full, plus `dueSelection.ts`'s
`selectDueTokens` (the function that decides which tokens even become `candidateTokens` for a
given invocation) and `dueEstimate.ts`'s `ZERO_ESTIMATE_GATE_MINUTES` (24h).

**Investigation and conclusion:** the specific concern the stale comment raised — Batch 23
removing the zero-estimate skip means every gated-eligible token now proceeds through
`claimToken`+send with no compensating throttle — is substantially mitigated as a side effect
of Task #623 (Wave 6, already merged). Mechanism: `sendAndRecord`'s zero-estimate branch widens
the shared cross-device gate to `ZERO_ESTIMATE_GATE_MINUTES` (24h) instead of the token's normal
interval after a zero-estimate send. `dueSelection.ts`'s `selectDueTokens` excludes any user
whose gate `effective_until` is still in the future from `candidateTokens` entirely — this is
the same gate table `dispatchNotifications` writes to. So a user who gets one zero-estimate send
is removed from candidacy for a full day, not just until their next normal
`interrupt_interval_minutes` elapses (which, at a 90-minute default, could otherwise mean
repeat zero-cost-turned-real-cost sends up to ~16×/day per user). This converts the added load
from "every zero-estimate token, every interval, indefinitely" into "at most one extra
claim+send per active user per 24h" — a small, bounded, steady-state addition.

I verified this isn't just a claim on paper: the 24h-widening behavior is already directly unit
tested in `tests/pushDispatch.test.ts` (`"widens the gate to 24 hours (not the token's normal
90-minute interval) after a zero-estimate send"`, `"still uses the token's own normal interval...
when the estimate is non-zero"`, `"does not shrink the gate below a token's own interval when
that interval already exceeds 24 hours"` — all pre-existing, all still passing), and
`selectDueTokens`'s gate-exclusion logic is independently real (`dueSelection.ts:95-97`,
`return now.getTime() >= new Date(effectiveUntil).getTime()`).

**What I did NOT find fully covered by the mitigation:** a burst of many *different* users all
reaching zero-estimate for the first time in the same cron tick (the 24h gate only takes effect
*after* a user's first such send, so it doesn't smooth out that specific instant). I judged this
residual case does not warrant a dedicated throttle right now — it's bounded by the same
existing sequential-processing burst control this file already has (unrelated to the
zero-estimate question), there's no measured latency problem motivating it, and this project's
own stated philosophy (visible in the pre-existing comment I replaced) is "revisit only if real
dispatch volume makes this a measured latency problem" — adding throttling complexity against an
unmeasured, now-substantially-bounded risk would be exactly the kind of speculative complexity
CLAUDE.md/AGENTS.md caution against.

**Fix implemented:** updated the file-header comment in `supabase/functions/send-interrupt-notifications/dispatch.ts`
to replace the stale "has simply not yet been measured" framing with the actual reasoning above
— the #623 mechanism, the math on why it bounds volume to per-day rather than per-interval, why
sequential processing remains the correct burst-shape control independent of this question, and
an explicit, narrower condition for when a real throttle should be reconsidered (the
first-time-simultaneous-cohort case, not the general zero-estimate case). This is a
documentation-only change — no production logic was modified, since the investigation concluded
the risk is genuinely, not just plausibly, mitigated.

**Verification:** doc-only change, so no new assertion and no Deletion Test applies. Ran
`tests/pushDispatch.test.ts` directly (19/19 pass, including the three #623 gate-widening tests
this reasoning depends on) to confirm the mechanism I'm citing is real and currently enforced,
not just described.

## Verification Gate

- `npx tsc --noEmit` — 0 errors (confirmed `dispatch.ts` is NOT in the Deno-only exclude list —
  only `supabase/functions/*/index.ts` is excluded — so this file is covered by the normal gate)
- `npm run lint` — 0 errors (9 pre-existing warnings across unrelated files, several in files
  another stream is actively editing this wave — not mine)
- `npx vitest run tests/pushDispatch.test.ts` — 19/19 pass
- `npm test` (full suite) — **2 test files failed, both pre-existing and NOT mine**:
  `tests/srsStore.test.ts` and `tests/seam_studyLoop.test.ts`, both failing with
  `ReferenceError: SESSION_EXPIRY_MS is not defined` inside `store/srsStore.ts`. Confirmed via
  `git status --short` that `store/srsStore.ts`, `hooks/useStudySession.ts`, and
  `hooks/useStudySession.test.ts` are all modified and all explicitly listed under this brief's
  own "Off-Limits Files" (owned by another stream, actively in progress this wave). I did not
  touch any of them. Per the brief's own Verification Gate instruction ("a failure in a file you
  did not touch is not yours to fix, but confirm via git status before assuming that") — this is
  not my finding to fix; flagging it here for visibility. Every other test file (99/101) passes,
  including my own.
- `scripts/deep-audit.sh` does not exist in this repo (confirmed again this wave).

No `git stash` was run. `git status --short` before starting was clean except for other
streams' own in-progress work on files this brief already scoped as off-limits.
