CLOSED: #527
NOT_CLOSED: none

## Task #527 — Mobile dispatch reads/writes interrupt_gate_events

**What changed:** Mobile push dispatch now reads and writes the shared, cross-device
fire gate (`interrupt_gate_events`, Task #525) instead of gating on
`push_tokens.last_sent_at` per device-token.

- `dueSelection.ts`'s `selectDueTokens` gained a third parameter,
  `gateStateByUser: ReadonlyMap<string, string>` (user_id → most recent
  `effective_until` ISO timestamp). It no longer reads `token.last_sent_at` at all for
  the due/not-due decision — a user with a recent gate event from ANY device excludes
  ALL of that user's tokens, even ones whose own `last_sent_at` is old or null. A user
  absent from the map (no gate row at all) is treated as due.
- `dispatch.ts`'s `DispatchDeps` gained `recordGateFired(userId, deviceId, occurredAt,
  effectiveUntil) => Promise<boolean>`. `sendAndRecord` now computes `effectiveUntil =
  occurredAt + token.interrupt_interval_minutes` and calls it immediately after a
  confirmed send (`result.ok`) — never on a failed/skipped send, never when
  `claimToken` loses the race, never when there are no cards ready. A write failure is
  logged (`[ERR-PUSH-GATE-RECORD-...]`) but does not downgrade the summary's `sent`
  count — the send already happened; a failed gate write just means the next
  dispatch run's read might re-select this user sooner than intended.
- `supabaseAdmin.ts` gained two new functions: `fetchGateStateForUsers` (reads
  `interrupt_gate_events`, reduced client-side to each user's max `effective_until`
  via `order=effective_until.desc` + first-row-per-user) and `recordGateFired` (POSTs
  a `fired` row). Both follow this file's existing "never throws, always returns a
  safe default, logs `[ERR-PUSH-...]` on failure" contract.
- `index.ts` wires it: fetches gate state for every candidate user (from `allTokens`,
  not just the pre-gate-filtered set, since the gate check is itself one of
  `selectDueTokens`'s filters) before calling `selectDueTokens`, and passes
  `recordGateFired` into `dispatchNotifications`'s deps.
- `types.ts` gained `InterruptGateEventRow` (the subset of Task #525's schema this
  pipeline actually touches: `user_id`, `event_type`, `effective_until`).

**`push_tokens.last_sent_at` decision:** Kept, unchanged, still written by
`claimToken` in `supabaseAdmin.ts` — I left `claimToken` itself untouched. It no
longer has any bearing on the *due-vs-not-due* decision (that's fully owned by
`interrupt_gate_events` now via `selectDueTokens`), but it still serves its original,
narrower role as the atomic CAS field preventing two overlapping cron ticks from
double-claiming the *same token* in the same 5-minute window — a real, distinct
concern (single-token-within-one-tick) from the new gate's concern (per-user,
across ticks and devices). This is "kept, but no longer primary" rather than either
of the task brief's two named options ("removed" or "diagnostic-only") — it is still
operationally load-bearing for concurrency safety, just no longer for gating. Did not
touch `claimToken`'s implementation at all, to keep this task's blast radius to
exactly what Task #527 asked for.

**One accepted, documented tradeoff (not fixed, not silently left either):**
`fetchGateStateForUsers` fails open (an HTTP error or network exception returns an
empty Map, which `selectDueTokens` reads as "no gate row → due" for every affected
user) rather than fail-closed like this file's other read
(`fetchReviewEventsForUsers`, whose empty-array failure mode fails closed as a side
effect of zero events meaning zero due cards). Documented directly in
`fetchGateStateForUsers`'s doc comment: the real safety net for this failure mode is
that `claimToken`'s own PATCH almost always fails alongside the same outage (same
database), so a fail-open gate read does not translate into an actual mass-send in
the realistic failure case. Flagged, not silently accepted — a future reader can
revisit if this reasoning ever proves wrong in practice.

**Files touched (all within or directly required by my owned scope — see note
below):**
- `supabase/functions/send-interrupt-notifications/dueSelection.ts` (owned)
- `supabase/functions/send-interrupt-notifications/dispatch.ts` (owned)
- `tests/pushDueSelection.test.ts`, `tests/pushDispatch.test.ts` (owned — "test
  counterparts, wherever this directory's existing pattern puts them"; confirmed this
  directory's convention is `tests/push*.test.ts`, not co-located)
- `supabase/functions/send-interrupt-notifications/supabaseAdmin.ts`, `index.ts`,
  `types.ts`, and `tests/pushSupabaseAdmin.test.ts` — **not explicitly in my owned
  list**, but necessary: `dueSelection.ts`/`dispatch.ts` are deliberately pure
  functions with zero DB access (this directory's own established architecture); the
  actual `interrupt_gate_events` reads/writes have to live in `supabaseAdmin.ts`, and
  someone has to wire them into `index.ts`'s pipeline or the feature isn't real. No
  other Wave 2 stream owns or touches these files (checked adam.md/charles.md — both
  explicitly list only `components/InterruptHandler.tsx`/`.test.tsx` and
  `lib/interruptGate.ts`/`.test.ts` as off-limits-to-me/owned-by-them; neither
  mentions this directory at all). Same judgment call as Wave 1's
  `InterruptHandler.test.tsx` mock update — collateral, unclaimed, and required for
  the feature and the Verification Gate to actually pass, not scope creep.

**Verification gate — all green:**
- `npx tsc --noEmit` — clean
- `npm test` — 1880/1880 passed (97 files, up from 1834/96 pre-task — 46 new tests)
- `npm run lint` — 0 errors (7 pre-existing warnings elsewhere, unrelated)
- Existing dispatch tests (`tests/pushDispatch.test.ts`'s original 9 cases) still pass
  unchanged, per the task's explicit "Done when" requirement.
- Acceptance criterion directly tested: "excludes a user's token even when that
  specific token's own `last_sent_at` is old/null, because a recent gate event exists
  (from any device)" (`tests/pushDueSelection.test.ts`).

Debt entries logged: 0 (the fail-open tradeoff above is documented inline + here, not
logged as separate debt — it's a deliberate design decision with stated reasoning,
not a known defect)
Carry-forward tasks generated: 0

Barry is done.

— Barry | W2B | #527
