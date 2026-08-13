CLOSED: #528
NOT_CLOSED: none

Debt entries logged: 0
Carry-forward tasks generated: 0

## Task #528 — lib/interruptGate.ts client module

**Files created:** `lib/interruptGate.ts`, `lib/interruptGate.test.ts`

Followed `lib/syncClient.ts`'s established pattern exactly (read directly
before starting, per architect memory): single gateway import from
`@/lib/supabaseClient`'s `getSupabaseClient()`, `{ ok: true } | { ok: false;
error }` result shapes, `[ERR-*-${Date.now()}]`-tagged `console.error` on
failure, no React/Zustand imports (verified by both `npx tsc --noEmit` and
`npm run lint` on this file — zero errors).

### Exact exports (Wave 3's #529/#530 call these directly)

```ts
export type InterruptGateEventType = "fired" | "snoozed";
export const DEFAULT_GATE_READ_TIMEOUT_MS = 750; // ms — midpoint of docs/INTERRUPT_ARCHITECTURE.md §6's confirmed 500ms–1s range

export type GateReadResult =
  | { status: "known"; effectiveUntil: number | null } // unix ms; null = no gate history yet for this user
  | { status: "unknown"; reason: "timeout" | "error" | "not_configured"; error?: string };

export type GateWriteResult = { ok: true } | { ok: false; error: string };

export async function readInterruptGateState(
  userId: string,
  timeoutMs: number = DEFAULT_GATE_READ_TIMEOUT_MS
): Promise<GateReadResult>

export async function recordInterruptGateEvent(params: {
  userId: string;
  deviceId: string;
  eventType: InterruptGateEventType;
  occurredAt: number;          // unix ms
  minutesUntilEligible: number; // interval minutes for 'fired', snooze minutes for 'snoozed'
}): Promise<GateWriteResult>
```

**Read function** (`readInterruptGateState`): queries
`select effective_until from interrupt_gate_events where user_id = ? order
by effective_until desc limit 1` — uses the `(user_id, effective_until
desc)` index Task #525 built for exactly this. Bounded by `timeoutMs` via
`Promise.race` against a timer that also fires `AbortController.abort()` on
the underlying Postgrest query (so a real fetch is actually cancelled, not
just ignored). On timeout, a query error, or a rejected promise (e.g. a real
AbortError) it returns an explicit `{ status: "unknown", reason: ... }` —
**it never guesses or decides fire-vs-suppress itself**; that fallback
decision (docs/INTERRUPT_ARCHITECTURE.md §6: fall back to local last-known
state and fire anyway, never suppress-on-timeout) belongs to the caller.
`{ status: "known", effectiveUntil: null }` is the explicit "no gate history
yet for this user" case — distinct from `"unknown"`.

**Write function** (`recordInterruptGateEvent`): inserts one row with
`effective_until = occurredAt + minutesUntilEligible * 60_000` — the same
additive formula for both event types per §5, with the caller supplying
whichever minute value applies (`interval-at-time-of-firing` for `'fired'`,
snooze minutes for `'snoozed'`). This module intentionally has no opinion on
interval/snooze-minute constants (those live in `store/settingsStore.ts`, a
layer above `lib/` this file must never import from).

### Verification performed

- `npx vitest run --coverage lib/interruptGate.test.ts` — 13/13 tests pass,
  **100% statements/branches/functions/lines** on the new file (includes a
  mocked slow/never-resolving client to test the timeout path via
  `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`, a rejected-promise
  case for both `Error` and non-`Error` rejection values, and both `'fired'`
  and `'snoozed'` effective_until arithmetic checked against exact computed
  timestamps).
- `npx tsc --noEmit` — clean when checked immediately after writing these
  two files.
- `npm run lint` — zero errors/warnings on `lib/interruptGate.ts` and
  `lib/interruptGate.test.ts` specifically.
- `npm test` (full suite) — 1864/1864 pass, including this file's 13.

### Note: pre-existing, out-of-scope TS errors from parallel windows

A later full `npx tsc --noEmit` run (after other windows' concurrent edits
landed in the shared working tree) shows 6 errors in
`tests/pushDueSelection.test.ts` against `dueSelection.ts` — both explicitly
off-limits to this stream (owned by parallel W2A/W2B windows per this
brief's Off-Limits Files list, currently mid-edit per `git status`: modified
`components/InterruptHandler.tsx`, `lib/tauriInterrupt.ts`,
`supabase/functions/send-interrupt-notifications/*`). Confirmed via `git
status` that I have not touched any of those files — untouched by this
stream, not caused by this task, and not mine to fix.
