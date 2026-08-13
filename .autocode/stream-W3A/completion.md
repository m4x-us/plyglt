CLOSED: #529
NOT_CLOSED: none

# Stream W3A Completion — Adam — 2026-08-13 (Wave 3 — Task #529)

Debt entries logged: 0
Carry-forward tasks generated: 0

---

## #529 — Wire shared gate into desktop's firing decision

**Layer-boundary constraint that shaped the design:** `components/` may only import from `hooks/`
and `lib/` (CLAUDE.md's Layer Map). `lib/interruptGate.ts` (Task #528, Charles, Wave 2) is a
`lib/` module, so `components/InterruptHandler.tsx` calls it directly. But the `userId`
(`store/authStore.ts`) and `deviceId` (`store/syncStore.ts`) it needs are `store/` state, which
a `components/` file must never import directly. `hooks/useInterruptConfig.ts` already exists
for exactly this purpose (its own header comment: "Wraps store/ imports so
components/InterruptHandler.tsx stays within the components/ → hooks/ layer boundary") — not in
this stream's explicit "Files You Own" list, but not off-limits this wave either, and editing it
was the only layer-compliant way to do this (same situation as Wave 2's `lib/tauriInterrupt.ts`
extension, also not explicitly listed but necessary and authorized by the task text itself).

**hooks/useInterruptConfig.ts:**
- Added `userId` (`useAuthStore((s) => s.userId)`) and `deviceId` (`useSyncStore((s) => s.deviceId)`)
  to the hook's return value. Both read via a selector (not full-object destructure) to avoid an
  unnecessary re-render on unrelated auth/sync-store field changes.
- `hooks/useInterruptConfig.test.ts`: mocked `@/store/authStore` and `@/store/syncStore` (selector-
  style mocks matching Zustand's real call shape) so this unit test never pulls in the real
  `store/authStore.ts` module (which wires a live Supabase `onAuthStateChange` listener and a
  desktop deep-link subscription at module load) — 2 new tests proving both fields pass through.

**components/InterruptHandler.tsx** (`interrupt:fire` handler, after the existing
`totalDue === 0` early-return and before the Task #526 `markInterruptFired()` call):
1. **Gate read**: if `userId` is set, calls `readInterruptGateState(userId)`. A `"known"` result
   with a still-future `effectiveUntil` **suppresses this fire** (`return`) — another device
   already fired or snoozed within the current interval. Any other result — `"unknown"`
   (`timeout`/`error`/`not_configured`), `"known"` with `effectiveUntil: null` (no gate history
   yet), or no `userId` at all (signed out) — falls through to firing locally, per
   docs/INTERRUPT_ARCHITECTURE.md §6's confirmed fire-anyway-on-timeout policy.
2. Existing Task #526 `markInterruptFired()` call is unchanged — still the local Rust clock
   confirmation, unconditional on the gate outcome once past the suppression check.
3. **Gate write**: if `userId` AND `deviceId` are both present, fire-and-forget (not awaited —
   deliberately never delays showing content that's already been decided)
   `recordInterruptGateEvent({ userId, deviceId, eventType: "fired", occurredAt: Date.now(),
   minutesUntilEligible: intervalHours * 60 })`. A rejected promise is caught and logged
   (`[IH-GATE-WRITE-...]`), never thrown. `deviceId` can be `null` on a device that has never
   committed a review yet (`store/syncStore.ts` generates it lazily on first
   `enqueueReviewEvent` call, not eagerly) — the write is skipped rather than inventing a
   device id for this unrelated purpose, per the brief's explicit instruction to reuse the
   existing value only.
4. `latestRef`/its sync effect extended with `intervalHours`, `userId`, `deviceId` so the
   once-subscribed `interrupt:fire` listener always reads current values (same pattern this
   file already uses for `dndStart`/`dndEnd`/etc., established by the Task #166 resubscription-
   race fix).

File size after this change: `components/InterruptHandler.tsx` 198 lines — no extraction needed
(well under the 400-line cap the brief flagged as a possible trigger).

**Tests added** (`components/InterruptHandler.test.tsx`, 8 new tests in a new
`describe("shared cross-device interrupt gate (Task #529)")` block, matching the task's exact
three "Done when" scenarios plus edge cases):
- Suppresses a local fire when another device's `fired` event is still in effect
  (`effectiveUntil` in the future) — `markInterruptFired`/`sendNativeNotification`/
  `recordInterruptGateEvent` all NOT called.
- Fires locally once `effectiveUntil` has passed.
- **Fires locally (fire-anyway fallback) when the gate read times out** — the task's explicit
  DoD scenario.
- Fires locally without ever calling `readInterruptGateState` when signed out.
- **A real local fire writes a `fired` event** — the task's other explicit DoD scenario;
  asserts `userId`, `deviceId`, `eventType`, and `minutesUntilEligible` (120 for a 2-hour
  `intervalHours`, proving the hours→minutes conversion).
- Does not record a gate event when signed in but `deviceId` is still `null`.
- A rejected `recordInterruptGateEvent` is logged (`IH-GATE-WRITE`) but never blocks the fire.
- Also added `useAuthStore`/`useSyncStore` real-store imports (reset to signed-out/no-device
  defaults in `beforeEach`) and a `@/lib/interruptGate` mock (`mockReadInterruptGateState`
  defaulting to `{ status: "known", effectiveUntil: null }` — safe-to-fire, no gate history —
  and `mockRecordInterruptGateEvent`) — every pre-existing test in this file (written before
  #529) exercises the "no userId → skip the gate, fire anyway" path by construction, so none
  needed changes.

## Verification Gate (2026-08-13)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 1889/1889 pass (up from 1863 after Wave 2) ✓
- `npm run lint`: 0 errors (7 pre-existing warnings, none in files this stream touched) ✓
- Off-limits files (`lib/tauriInterrupt.ts`, `app/study/page.tsx`, and their test files —
  Barry's W3B stream, #530) — confirmed untouched by this stream via `git status`; the
  modifications visible there belong to that parallel stream.

This closes Batch 21 (docs/INTERRUPT_ARCHITECTURE.md) for stream W3A. Once Barry's W3B (#530)
also reports done, the whole batch is complete.
