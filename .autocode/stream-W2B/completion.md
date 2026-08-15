CLOSED: #540
NOT_CLOSED: none

## Task #540 — docs/INTERRUPT_ARCHITECTURE.md updated for Batch 22/23's content-supply floor

**What changed:** The doc previously only covered Batch 21 (the cross-device
firing *schedule/gate* — sections 1–9). It never mentioned Batch 22/23's
separate, later contract: once a fire is allowed, what content it's
guaranteed to hold (the 6-card floor, 3-new-card cap, 8-card ceiling, and the
server-side push floor). Added a new §10, "Interrupt content-supply floor
(Batch 22–23, remediated Wave 1 2026-08-15)," describing the CURRENT live
behavior — not the original Batch 23 spec text — since Wave 1 corrected two
real bugs in what originally shipped:

- **10.1** — the client-side constants table (`lib/queue.ts`):
  `INTERRUPT_SESSION_FLOOR`(6), `INTERRUPT_SESSION_MAX_NEW`(3),
  `INTERRUPT_SESSION_CAP`(8), and the Wave-1-added
  `INTERRUPT_FLEX_DAILY_MAX`(9), each with its real reasoning (not just the
  numbers).
- **10.2** — the mount-effect fill order in `hooks/useStudySession.ts`
  (flex-introduce new cards first, then near-due reviews), and the "floor is
  a target, not a guarantee" framing (Task #561).
- **10.3** — the flex fill's gating, explicitly flagged as **correcting**
  the original Batch 23 shipment: the stranded-pause check was already
  correct, but the unbounded `Number.MAX_SAFE_INTEGER` daily-cap bypass was a
  real bug (Task #551) — fixed by passing `INTERRUPT_FLEX_DAILY_MAX` instead,
  with no `store/srsStore.ts` change needed since `canIntroduceNewCard`
  already counts introductions across all of today's sessions. Also
  documents `hooks/useInterruptConfig.ts`'s `computeDue` mirroring the same
  gate (Task #539).
- **10.4** — the never-empty backstop, explicitly flagged as **correcting**
  the original shipment: it used to bypass the stranded pause unconditionally
  (a real bug, Task #538); now gated on the same check, so a
  stranded-pause + empty-near-due-pool day can leave a session genuinely
  empty — documented as a deliberate product decision (the named BRAND.md
  pause invariant outranks the never-empty guarantee in that one
  combination), not silently glossed over.
- **10.5** — the near-due over-fetch fix (Task #541): requesting the full
  pool (`Number.MAX_SAFE_INTEGER`) instead of an unproven
  `FLOOR + sessionIds.size` heuristic, and why the cost is negligible
  (`getNearDueCards` already sorts the whole catalog before slicing).
- **10.6** — the server-side mirror in `dueEstimate.ts`: the clamp to
  `[FLOOR, CAP]` (Task #544, corrects the original floor-only shipment) and
  the honest "Cards ready" / `cardCount: 0` zero-case (Task #545, corrects
  the original always-claim-6 shipment) — plus `types.ts`/`dispatch.ts`'s
  `sentWithZeroEstimate` field (Task #550) explicitly named as the
  replacement for the removed `skippedNoCards`, restoring the observability
  that removal cost.
- **10.7** — a summary table of every file this system touches, in the same
  style as the existing §9 table.

Kept consistent with the rest of the document: numbered `## N.` sections,
tables for enumerable facts, a "Status:" line, explicit "corrects the
original Batch 23 shipment" callouts (matching how §2–§4 already frame
"where the current code violates/gets right" the stated principle) rather
than presenting the corrected behavior as if it always worked this way.

**Verification gate:**
- `npx tsc --noEmit` — clean (docs-only change; ran anyway per the brief's
  substitute gate)
- `npm run lint` — 0 errors (7 pre-existing warnings, unrelated files)
- `npm test` — see below (backgrounded; this file confirms result once the
  run completes, no code was touched by this task so no regression is
  expected)

Debt entries logged: 0
Carry-forward tasks generated: 0

No source files were touched — `docs/INTERRUPT_ARCHITECTURE.md` only, as
scoped.

Barry is done.

— Barry | W2B | #540
