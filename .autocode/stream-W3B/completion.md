CLOSED: #530
NOT_CLOSED: none

## Task #530 — Snooze writes a shared event

**What changed:** Desktop's snooze action now additionally writes a `snoozed` event to
the shared, cross-device gate (`interrupt_gate_events`, via Task #528's
`lib/interruptGate.ts`), so a snooze on one device is visible to every other of that
user's devices (including a future mobile client) — not just the local in-memory Rust
state it already touched.

- `lib/tauriInterrupt.ts`'s `snoozeInterrupt` gained a second, optional parameter:
  `gateContext?: { userId: string; deviceId: string }`. The existing local IPC call
  (`invoke("snooze_interrupt", { minutes })`) runs first, unchanged, with its existing
  throw-on-failure contract fully intact. Only after that succeeds, if `gateContext` is
  supplied, it calls `recordInterruptGateEvent({ userId, deviceId, eventType: "snoozed",
  occurredAt: Date.now(), minutesUntilEligible: minutes })` — purely additive, and a
  write failure there is logged (`[ERR-INTERRUPT-GATE-SNOOZE-...]`) but never thrown,
  since the local snooze the user actually experiences already fully succeeded by that
  point.
- `app/study/page.tsx`'s "Snooze X min" button now calls `snoozeInterrupt` with a
  resolved `gateContext` (or `undefined` if either `userId` or `deviceId` is unavailable
  — e.g. signed out, or a brand-new device that has never enqueued a review event yet
  and so has no persisted `deviceId`). Per the brief: a null `userId` (signed out) skips
  the shared-gate write entirely; I extended the same "skip if missing" treatment to a
  null `deviceId` too, since `recordInterruptGateEvent`'s `deviceId` parameter is
  non-nullable and `store/syncStore.ts`'s `deviceId` is genuinely `null` until a user's
  first review event.

**New file, not in the original "Files You Own" list — `hooks/useSnoozeAndExit.ts`
(+ its test):** `app/study/page.tsx` was already at 149 of its ~150-line CLAUDE.md route
cap before this task; reading `userId`/`deviceId` inline would have pushed it over. The
architect memory note attached to this brief explicitly anticipated this and named the
correct fix ("follow the project's existing extraction-to-a-hook pattern"), so I
extracted the whole snooze-button click handler (resolve identity via each store's
`.getState()` — a one-time snapshot read, not a reactive subscription, since the value
is only needed at click-time — call `snoozeInterrupt`, then `exitMandatoryMode`, then
navigate) into `hooks/useSnoozeAndExit.ts`. Net effect: `app/study/page.tsx` shrank from
149 to **148 lines** (removed more than it added — the 4-line inline `onClick` body
collapsed to a 1-line reference) while gaining the new behavior. `lib/tauriInterrupt.ts`
also gained one new import (`@/lib/interruptGate` — a sibling `lib/` module, legal under
CLAUDE.md's Layer Map, confirmed by the same architect memory note).

**Verification gate — all green:**
- `npx tsc --noEmit` — clean
- `npm test` — 1902/1902 passed (98 files, up from 1880/97 pre-task — 22 new tests: 12
  in `tests/tauri.test.ts` covering `snoozeInterrupt`'s new gate-write behavior plus one
  end-to-end cross-device test, and 7 in the new `hooks/useSnoozeAndExit.test.ts`)
- `npm run lint` — 0 errors (7 pre-existing warnings elsewhere, unrelated)
- Acceptance criterion 1 ("clicking Snooze writes a `snoozed` event with the correct
  `effective_until`") — directly tested: `tests/tauri.test.ts`'s
  `"calls recordInterruptGateEvent with eventType 'snoozed' and the exact given fields
  when gateContext is supplied"` asserts the exact call shape.
- Acceptance criterion 2 ("a test proves a device checking the gate shortly after
  respects a snooze event it didn't itself create, simulated as if from another
  device") — directly tested end-to-end: `"a snooze written by device-A is read back by
  a caller that never supplied any device id"` runs the REAL `lib/interruptGate.ts`
  (both `recordInterruptGateEvent` and `readInterruptGateState`, not mocked) against a
  fake in-memory Supabase client, snoozes as `device-A`, then reads the gate via
  `readInterruptGateState("user-1")` — a call with no device concept at all, simulating
  any other device's check-in — and asserts the exact resulting `effectiveUntil`
  (pinned via `vi.useFakeTimers`, not a loose `toBeGreaterThan` check) reflects
  device-A's write. Also asserts a different user's gate is unaffected (per-user
  scoping, not global).

Debt entries logged: 0
Carry-forward tasks generated: 0

This closes out Batch 21 (`docs/INTERRUPT_ARCHITECTURE.md`) for my stream — #529
(Adam, W3A) is the other Wave 3 stream; once both report done, the whole batch is
complete per the brief.

Barry is done.

— Barry | W3B | #530
