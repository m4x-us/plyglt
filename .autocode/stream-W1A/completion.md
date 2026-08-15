CLOSED: #544 #545 #546 #548 #549 #550
NOT_CLOSED: none

## Summary

All six tasks touched the same paragraph of `dueEstimate.ts` (per the brief's own note
that #544/#545/#546/#548 sit together), so they were fixed as one coherent edit rather
than four sequential patches that would have rewritten the same comment repeatedly.

### #544 — ceiling to match the floor
Added `INTERRUPT_SESSION_CAP = 8` (re-declared locally, same pattern as
`INTERRUPT_SESSION_FLOOR`, since Deno functions can't import `lib/queue.ts`).
`buildNotificationPayload` now clamps `announced` to `[FLOOR, CAP]` via
`Math.min(Math.max(...), CAP)` instead of only flooring — a backlog of 40 cards now
announces "8 cards ready", matching what `app/study/page.tsx`'s capped queue can
actually deliver.

Root-cause note: `tests/interruptFloorSync.test.ts` (a pre-existing mechanical sync
guard, not owned by this stream) already imported `INTERRUPT_SESSION_CAP` from
`dueEstimate.ts` and would have failed to compile before this fix — confirming the gap
was real and already had a guard waiting for the constant to exist. It passes now with
`SERVER_INTERRUPT_SESSION_CAP === 8 === lib/queue.ts's INTERRUPT_SESSION_CAP`.

### #545 — honest wording for the true-zero case
`buildNotificationPayload` special-cases `cardCount === 0`: body reads `"Cards ready"`
(no number, canonical "ready" terminology, no exclamation mark per BRAND.md) and
`data.cardCount` reports the honest `0`, rather than claiming "6 cards ready" the
server cannot back for a brand-new Pro signup's first interrupt (near-due pool and
FSRS history both genuinely empty). Any `cardCount > 0` still floors/clamps into
`[FLOOR, CAP]` as before.

### #546 + #548 — doc comment rewrite (single pass, both directions)
Rewrote the `buildNotificationPayload` doc comment to say the client *targets* a
floor..cap range rather than *guarantees* it, and explicitly covers both hedge
directions: too-few (catalog exhaustion / stranded introduction pause, citing
`hooks/useStudySession.test.ts`'s own sub-floor test) and too-many (real backlog above
CAP, citing the vacation-return scenario). Also documents the new zero-estimate
wording decision inline so the next reader sees the reasoning, not just the code.

### #549 — dispatch.ts header comment
Added a note to the sequential-processing header comment acknowledging Batch 23
removed the zero-estimate skip, so every gated-eligible token now proceeds through
claimToken/send with no short-circuit — the burst-control rationale for staying
sequential still holds, it just hadn't been re-stated against the new volume.

### #550 — sentWithZeroEstimate observability field
Added `sentWithZeroEstimate: number` to `DispatchSummary` (types.ts) — a subset of
`sent`, incremented in `dispatch.ts`'s `sendAndRecord` (now takes an `estimateCardCount`
param) when `estimate.cardCount === 0` at send time. This restores the signal that
`skippedNoCards`'s removal lost: which sends were backed by real synced review history
vs. which used the floor/zero-case fabrication in `dueEstimate.ts`.

## Verification
- `npx tsc --noEmit` — clean
- `npm test` — 1942/1942 passed (101 files), including the pre-existing
  `tests/interruptFloorSync.test.ts` sync guard
- `npm run lint` — 0 errors (8 pre-existing warnings, none in files this stream touched)
- `bash scripts/deep-audit.sh` does not exist in this repo (no `scripts/deep-audit.sh`,
  nothing matching `*audit*` in `scripts/`) — could not run the literal acceptance-
  criteria command from the task briefs. Substituted the project's actual verification
  gate (tsc + full test suite + lint) per AGENTS.md's Verification Gate, and manually
  re-read every edited file against each finding's described defect before closing.

## Files changed
- `supabase/functions/send-interrupt-notifications/dueEstimate.ts` — #544, #545, #546, #548
- `supabase/functions/send-interrupt-notifications/dispatch.ts` — #549, #550
- `supabase/functions/send-interrupt-notifications/types.ts` — #550
- `tests/pushDueEstimate.test.ts` — updated/added tests for the clamp + zero-case wording
- `tests/pushDispatch.test.ts` — updated all `DispatchSummary` equality assertions for
  the new `sentWithZeroEstimate` field; updated zero-estimate body expectations

Debt entries logged: 0
Carry-forward tasks generated: 0

Dependency note for Wave 2: Task #550 → Task #540 (docs/INTERRUPT_ARCHITECTURE.md
update) is now unblocked — `sentWithZeroEstimate` exists on `DispatchSummary` and is
wired up in `dispatch.ts`, ready to be described in that doc.
