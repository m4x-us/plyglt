CLOSED: #526
NOT_CLOSED: none

# Stream W2A Completion — Adam — 2026-08-13 (Wave 2 — Task #526)

Debt entries logged: 0
Carry-forward tasks generated: 0

---

## #526 — Desktop JS calls mark_interrupt_fired

**lib/tauriInterrupt.ts** (new export, matching the existing wrapper pattern for
`updateInterruptConfig`/`snoozeInterrupt`/`enterMandatoryMode`/`exitMandatoryMode`):

```ts
export async function markInterruptFired(): Promise<void>
```

No arguments — the Rust `mark_interrupt_fired` command (Task #524, Wave 1) is a state-only
Tauri command, no payload. No-op in web (`!isTauri` early return). Throws
`Mark interrupt fired IPC failed (ERR-IPC-<timestamp>)` on IPC failure, after logging the
same ref ID to console.error — identical error-surfacing contract as its four siblings in
the same file. **This is the exact function name/signature Wave 3's #529 will call too**, per
the brief's own note.

**components/InterruptHandler.tsx:**
- Imported `markInterruptFired` alongside the existing `enterMandatoryMode`/
  `updateInterruptConfig` imports from `lib/tauriInterrupt`.
- Added a single call site, right after the `if (totalDue === 0) return;` early-return and
  before the `if (isMandatory)` branch — covers both the mandatory and passive-notification
  paths with one call, since both paths are guaranteed to execute past that point once real
  content is due. Wrapped in try/catch: a failed IPC call is logged (`[IH-MARKFIRED-...]`) but
  never blocks the interrupt from being shown — same "soft-lock is better than a silent no-op"
  philosophy this file already applies to `enterMandatoryMode` failures.
- Placement means `markInterruptFired()` fires regardless of whether the passive path's
  notification-permission check ultimately succeeds or is denied — the trigger is "there is
  real content and we are now acting on it," not "a notification literally rendered." This
  matches the DoD's own phrasing (gated only on the `totalDue === 0` short-circuit, not on the
  downstream permission outcome) and keeps the change to one call site instead of duplicating
  logic across both branches.

**Tests added:**
- `components/InterruptHandler.test.tsx` — new `describe("markInterruptFired (Task #526)")`
  block, 5 tests: not called when `totalDue === 0`; not called when the DND guard suppresses
  the fire before `totalDue` is even checked; called exactly once on the mandatory path; called
  exactly once on the passive path; IPC failure is logged but does not block showing the
  interrupt (mirrors the existing `enterMandatoryMode`-failure test's shape). Also added
  `mockMarkInterruptFired` to the file's `vi.hoisted` block and the `@/lib/tauriInterrupt` mock,
  and reset it in `beforeEach`.
- `tests/tauri.test.ts` — new `describe("markInterruptFired — IPC error surfacing")` block (3
  tests: rejects with "IPC failed" on a mocked Tauri invoke rejection, resolves on success and
  calls `invoke("mark_interrupt_fired", undefined)`, no-op/resolves in web mode) — this file is
  `lib/tauriInterrupt.ts`'s own dedicated test file and wasn't in the brief's "Files You Own"
  list, but the brief explicitly directed adding the wrapper to that module, and shipping new
  exported production code with zero direct test coverage would violate AGENTS.md's "any
  user-visible feature with zero tests covering its happy path" stop-the-line rule — added
  tests there rather than only indirectly through the InterruptHandler mock.

## Verification Gate (2026-08-13)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 1863/1863 pass (up from 1843 after Wave 1) ✓
- `npm run lint`: 0 errors (7 pre-existing warnings, none in files this stream touched) ✓
- Off-limits files (`supabase/functions/send-interrupt-notifications/dueSelection.ts`,
  `dispatch.ts`, `lib/interruptGate.ts`, `lib/interruptGate.test.ts`) — confirmed untouched via
  `git status`; the modifications visible there belong to Barry/Charles's parallel Wave 2 streams.
