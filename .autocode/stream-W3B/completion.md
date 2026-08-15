CLOSED: #570 #564 #580
NOT_CLOSED: none

## Wave 3, Stream W3B — components/InterruptHandler.tsx audit remediation (2026-08-15)

### #570 (severity 8) — markInterruptFired/recordInterruptGateEvent fired before the permission check
`components/InterruptHandler.tsx`'s `interrupt:fire` handler previously called
`markInterruptFired()` and `recordInterruptGateEvent({eventType: "fired", ...})`
unconditionally, before branching into the mandatory/passive paths — so a
passive interrupt with notification permission denied still advanced the
Rust cooldown clock and wrote a "fired" event to the shared cross-device
`interrupt_gate_events` table, silently suppressing future interrupts on
every device the user owns for a fire the user never saw.

**Fix:** extracted the two calls into a local `markFired()` closure and moved
its call site into each branch:
- **Mandatory branch:** calls `markFired()` unconditionally, same as before —
  this branch always shows real content (the study session itself), so the
  original guarantee is correct and unaffected.
- **Passive branch:** `markFired()` now only runs after `granted` is
  confirmed `true` AND `sendNativeNotification` has actually been awaited —
  inside the same `try` block, so a `sendNativeNotification` throw (caught by
  the existing `[ERR-NOTIF-...]` handler) also skips marking, matching "only
  mark fired once the notification genuinely reached the user."

**Test:** extended the existing `"does not send a notification when
permission is refused"` test (its own name already matched the task's
suggested target) to also assert `mockMarkInterruptFired` and
`mockRecordInterruptGateEvent` are NOT called — this is the exact gap the
brief named. Renamed it to flag it as the Task #570 regression test. All 9
pre-existing `markInterruptFired`/gate tests in the file still pass
unmodified (mandatory-path unconditional marking, passive-path marking on
grant, IPC-failure logging, cross-device gate suppression, etc.) — none of
them depended on call *order* relative to the permission check, only on the
final call count/args, so the reorder is invisible to them.

### #564 (severity 7) — desktop notification never capped its announced count
`announcedDue` floored to `INTERRUPT_SESSION_FLOOR` (6) but had no ceiling —
`totalDue` sums FSRS-due cards across the whole catalog and is genuinely
unbounded, so a backlog day could announce e.g. "40 cards ready" while
`app/study/page.tsx` caps the opened session at `INTERRUPT_SESSION_CAP` (8).
Same defect class Task #544 already fixed on the server (`dueEstimate.ts`),
left unfixed on this client sibling (Rule 19 — symmetric hardening gap).

**Fix:** imported `INTERRUPT_SESSION_CAP` from `lib/queue.ts` (read-only
import from a file I don't own this wave, per the brief) and changed
`announcedDue` to `Math.min(Math.max(totalDue, INTERRUPT_SESSION_FLOOR),
INTERRUPT_SESSION_CAP)` — identical clamp shape to `dueEstimate.ts`'s
`buildNotificationPayload`.

**Test:** made the srsStore mock's due count test-overridable (added a
hoisted mutable `srsStoreState = { due: 1 }`, reset to `1` in `beforeEach`,
referenced from the mock's `getStats` — previously hardcoded to a static
`{ due: 1 }` with no way for an individual test to raise it). New test sets
`srsStoreState.due = 40` and asserts the notification reads exactly `"8
cards ready — 2 min study break?"`, not `"40 cards ready..."`.

### #580 (severity 2) — notification body overclaims content is ready
Pre-existing, low-severity gap: the notification body ("N cards ready")
doesn't account for `docs/INTERRUPT_ARCHITECTURE.md` §10.4's documented case
(a stranded introduction pause combined with an empty near-due pool can
leave the opened session genuinely empty). Per the brief, this is
comment-only — added a one-line note directly above `announcedDue`
cross-referencing §10.4 and explicitly recording the "not worth wiring
client-side pause state into this notification for this rare edge case"
scoping decision, so a future reader doesn't rediscover the gap and treat it
as unaddressed.

**Does #570 change this calculus?** No — I checked. #570 only changes *when*
`markFired()` runs relative to the permission check; it doesn't touch
whether the opened session itself can be empty (that's the
introduction-engine pause state `hooks/useStudySession.ts`'s mount effect
reads, §10.4's actual subject). The two are orthogonal: #570 is about the
gate-event bookkeeping being honest about whether a notification was shown;
#580 is about the notification's own copy being honest about what the
session behind it will contain. Fixing #570 doesn't close #580's gap or make
it worse.

---

## Verification gate

- `npx tsc --noEmit` — **3 pre-existing errors, none in my files or caused by
  my changes** — `tests/pushDueEstimate.test.ts:150`, `tests/queue.test.ts:93`,
  `tests/queue.test.ts:187`, all `TS2532: Object is possibly 'undefined'`.
  Confirmed via `git status` that `lib/queue.ts` and both those test files
  are modified by a concurrent window this wave (not in my Files You Own or
  Off-Limits list conflict — `lib/queue.ts` is explicitly off-limits to me).
  `npx eslint components/InterruptHandler.tsx components/InterruptHandler.test.tsx`
  and a filtered `tsc` grep both confirm zero errors in either file I touched.
- `npx eslint components/InterruptHandler.tsx components/InterruptHandler.test.tsx` — 0 errors
- `npx vitest run components/InterruptHandler.test.tsx` — **24/24 passed**
  (22 pre-existing + 2 new regression tests)
- Full `npm test` — **1960/1960 passed, 101 files.** (`vitest` doesn't do
  full TypeScript type-checking, so the 3 `tsc` errors above — in
  another stream's in-progress, off-limits files — don't show up as test
  failures here; confirmed nothing in `components/InterruptHandler.*`
  regressed.)

Debt entries logged: 0
Carry-forward tasks generated: 0

No files outside `components/InterruptHandler.tsx` and
`components/InterruptHandler.test.tsx` were touched.

Barry is done.

— Barry | W3B | #564 #570 #580
