CLOSED: #623 #624
NOT_CLOSED: none

## Summary

Both tasks closed. Read `dispatch.ts` and `dueEstimate.ts` in full, plus their existing tests
(`tests/pushDispatch.test.ts`, `tests/pushDueEstimate.test.ts`, `tests/interruptFloorSync.test.ts`),
before starting, per the brief's instruction. Verification gate — all green:
- `npx tsc --noEmit` — clean
- `npm test` — 101 files, 1997 tests passed (a transient block of ~41 failures was observed
  mid-session, entirely in `components/InterruptHandler.test.tsx` and
  `hooks/useInterruptConfig.test.ts` — both off-limits to me this wave, Adam's Wave 6 Task #610
  mid-edit adding a `useIsHydrated` hydration gate to `useInterruptConfig`; confirmed via
  `git status` and the exact failing-test list that zero failures touched my owned files;
  re-ran after their edit settled and the full suite passed clean)
- `npm run lint` — 0 errors, 7 pre-existing warnings, none in files I touched
- Existence-assertion grep gate — clean on all 5 owned files

`git status` showed only expected, recognized changes throughout (my own edits plus other
streams' concurrent work on their own owned files) — no `git stash` used or needed.

Debt entries logged: 0
Carry-forward tasks generated: 0

## Task #623 — server zero-card skip removal causing notification fatigue

**Investigated first, per the task's own instruction:** read `dispatch.ts`'s existing comments
in full (the "Batch 23 removed the zero-estimate skip" rationale at the top of the file and
inline at the `buildNotificationPayload` call site) and `types.ts`'s `sentWithZeroEstimate`
doc comment (which itself references the removed `skippedNoCards` field and the reasoning for
removing it). Confirmed: the skip was removed specifically because the server's due estimate
is a documented LOWER BOUND (`computeDueEstimate` only sees synced `review_events` — it cannot
see client-only introduction-cadence content, near-due reviews, or flex-introducible new
cards), so a naive zero-skip silently dropped real, client-fillable interrupts — exactly the
bug this task's own text warns against reintroducing.

**Decision: option (b), throttle frequency, not option (a), reintroduce a skip.** Reintroducing
any form of skip based on the server's estimate alone reintroduces that exact bug by
construction — the server fundamentally cannot distinguish "genuinely nothing anywhere" from
"nothing synced yet, client will fill it," so no skip condition built from `computeDueEstimate`
alone can ever be safe. A frequency throttle sidesteps this: it changes WHEN the user is
next eligible for a proactive nudge, never WHETHER the current one is sent.

**Implementation:** every gated-eligible token still sends unconditionally (`sendAndRecord` in
`dispatch.ts` is unchanged in that respect — no new skip). What changed: the shared
cross-device gate write (`recordGateFired`, Task #527's `interrupt_gate_events.effective_until`)
now widens to a new `ZERO_ESTIMATE_GATE_MINUTES` constant (24 hours, in `dueEstimate.ts`
alongside the existing `INTERRUPT_SESSION_FLOOR`/`CAP` constants) instead of the token's own
normal `interrupt_interval_minutes`, specifically when that send's estimate was zero.
`Math.max(ZERO_ESTIMATE_GATE_MINUTES, token.interrupt_interval_minutes)` guards the edge case
of a user whose own configured interval already exceeds 24h — never shrinks the gate. Net
effect: "one contentless push per day" instead of "every interval, indefinitely" — directly
matching the task's own named example option, with zero new DB schema (reuses the existing
gate-write path dispatch.ts already had for every send).

**Explicitly considered and rejected — a consecutive-count-aware backoff:** ("first N in a
row") would be more precise but requires new persisted per-user state (a DB column tracking
consecutive zero-estimate sends), which is outside this wave's file ownership (no migration
files, `supabaseAdmin.ts`, or `types.ts` schema changes are mine to make this wave). Documented
this as a real limitation in the code comment (`dueEstimate.ts`) rather than silently — a flat
per-send backoff, not a smarter consecutive-aware one, and named as a candidate for a future
task if a smarter backoff is ever wanted.

**Documented, accepted tradeoff:** a user who resumes studying shortly after receiving a
zero-estimate push won't get ANOTHER proactive server nudge until the 24h window elapses, even
if they've since accumulated real due content server-side. This is a real cost, but bounded and
honest: they can always open the app manually, and proactive pushes have always been a
best-effort supplement per `docs/INTERRUPT_ARCHITECTURE.md`, never the only path to studying.

**Tests added** (`tests/pushDispatch.test.ts`, extending the existing `recordGateFired` describe
block): (1) a zero-estimate send widens the gate to exactly 24h, not the token's normal 90-min
interval; (2) a non-zero-estimate send is unaffected, still uses the token's own interval;
(3) a token whose own interval already exceeds 24h keeps its own (longer) interval, not shrunk
to the daily backoff. **Live Deletion Test run** (my own owned production file): reverted
`dispatch.ts`'s `gateMinutes` ternary back to unconditionally using
`token.interrupt_interval_minutes`, re-ran — the new "widens the gate to 24 hours" test failed
exactly as expected (asserted 24h-out effective_until, got 90-min-out). Restored and re-verified
all 19 tests in the file pass.

## Task #624 — FLOOR/CAP constant duplication, no deploy-time guard

**Investigated per the task's own instruction, before deciding:** checked
`.github/workflows/ci.yml` and `.github/workflows/release.yml` (grepped case-insensitively for
"supabase"/"deploy" — zero matches in either file), and `package.json`'s `scripts` block (no
`supabase`, `deploy`, or CLI-invocation script of any kind). `supabase/config.toml`'s own
comment on this exact function ("hit live on the first real deploy, 2026-08-14") independently
confirms deploys happen via a human running the Supabase CLI directly — there is no CI/build
pipeline in this repo touching Supabase Edge Functions at all, so there is no hook point a
deploy-time guard could attach to within this repo's own tooling.

**Decision: accepted risk, documented — no code/CI change, per the task's own explicit escape
hatch** ("If a real deploy-time guard is feasible within your scope, add it. If it genuinely
isn't... document that limitation clearly in a comment on the constants themselves"). Extended
the existing sync-comment on `INTERRUPT_SESSION_FLOOR`/`INTERRUPT_SESSION_CAP` in
`dueEstimate.ts` with: (1) explicit confirmation that `tests/interruptFloorSync.test.ts` is the
only existing guard and is test-suite-only; (2) the exact investigation findings above (which
files were checked, what was found); (3) a concrete recommendation for if/when deploys are ever
automated into CI (`npm test` or the specific sync test, gating the deploy); (4) an honest
statement that until then, a human deploying via the CLI without first running the test suite
is the one remaining way these two copies can drift.

No test changes were needed for this task — it's a documentation-only fix, matching the task's
own anticipated "accepted risk" outcome. Verified via `npx tsc --noEmit` and re-running the full
suite that the doc-only edit didn't disturb anything.

## Note on `scripts/deep-audit.sh`

Still does not exist in this repo (same finding as every prior wave's stream) — substituted the
real Verification Gate as every task's acceptance criteria itself instructed.
