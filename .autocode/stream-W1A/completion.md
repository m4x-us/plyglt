CLOSED: #524 #531 #532
NOT_CLOSED: none

# Stream W1A Completion — Adam — 2026-08-13 (Wave 1 — Tasks #524, #531, #532)

Debt entries logged: 0
Carry-forward tasks generated: 0

---

## #524 — Desktop Rust: unified interval gate + clock-only-advances-on-real-fire

**src-tauri/src/interrupt.rs:**
- Added `pub fn interval_elapsed(now, last_triggered, interval_secs) -> bool` — the single
  shared gate every trigger path now uses (interval_secs == 0 means never fire).
- Scheduled poll thread (`start()`): now uses `interval_elapsed`; **no longer writes
  `last_triggered_secs` on a check/emit** — removed the "mark triggered before emitting"
  line entirely.
- `snooze_interrupt`: still sets `snooze_until_secs`, but **no longer touches
  `last_triggered_secs`**. Logic extracted to a pure, testable `apply_snooze(state, now, minutes)`.
- **New Tauri command: `mark_interrupt_fired(state)`** (pure core: `mark_fired_now(state, now)`)
  — this is now the ONLY thing in the codebase that writes `last_triggered_secs`. Registered
  in `lib.rs`'s `invoke_handler![...]` list.
- Added `#[cfg(test)] mod tests` (previously interrupt.rs had none) — 11 new tests covering
  `interval_elapsed`, the poll guard, and the "only mark_interrupt_fired writes the clock" invariant.

**src-tauri/src/os_events.rs:**
- Every wake/unlock/idle-return detector on all three platforms (macOS poll loop, Windows
  wndproc `on_event`/`check_idle`, Linux `on_wake`/`on_unlock`/`check_idle`) now also reads
  `interval_secs`/`last_triggered_secs` from state and requires
  `interval_elapsed(now, last_triggered, interval_secs)` before firing — OS events are check-in
  moments against the same schedule the scheduled poll uses, never an independent trigger.
- `emit_interrupt()` simplified to `fn emit_interrupt(app: &AppHandle, mandatory: bool)` — no
  longer takes `state`/`now` params since it no longer mutates `last_triggered_secs`.
- Updated module header, `emit_interrupt` doc comment, and the old "OS events intentionally
  bypass interval_secs" comment (now says the opposite, with the Task #524 rationale).
- Extended the existing pure-guard-function test pattern: `wake_fires`/`unlock_fires`/
  `idle_fires`/`event_wake_fires` all gained `(interval_secs, last_triggered)` params gated
  through `interval_elapsed`; added `ALWAYS_ELAPSED` constant so pre-#524 tests keep isolating
  what they originally tested, plus 6 new tests specifically proving OS events respect the
  interval (the exact bug this task fixes).

**Known, intentional interim state (explicitly scoped by the task, not a bug):** until Task
#526 (a later wave) wires `mark_interrupt_fired` from `components/InterruptHandler.tsx`, the
scheduled poll's "interrupt:fire" event can re-emit every 30s once the interval has elapsed,
since nothing calls the new command yet. This matches docs/INTERRUPT_ARCHITECTURE.md §3's model
exactly: checks can recur cheaply; only a real fire with content counts. Once #526 lands, an
empty check will correctly cost nothing.

Verification: `cargo check` and `cargo test` both clean — 35/35 Rust tests pass. Windows/Linux
`cfg` blocks are compile-checked by CI only (same caveat as Tasks #166/#167), not locally
verified here (macOS host).

---

## #531 — Unify desktop interrupt interval default to 90 minutes

- `src-tauri/src/interrupt.rs`: `InterruptState::default().interval_secs` changed from `3 * 3600`
  to `90 * 60`.
- `store/settingsStore.ts`: `INTERVAL_OPTIONS` extended from `[2, 3, 4, 6]` to `[1.5, 2, 3, 4, 6]`
  (hours); `intervalHours` default changed from `3` to `1.5`. `IntervalHours` type is derived
  from `INTERVAL_OPTIONS` so this required no separate type change.
- No `SETTINGS_VERSION` bump / migration entry needed — this is a default-value change only
  (not a shape change), and zustand's `persist` middleware only applies the `create()` default
  when there is no persisted state at all. Existing users' already-persisted `intervalHours`
  (including anyone who kept the old `3` default) is untouched, matching the task's "Done when."
- `app/settings/page.tsx`'s interval buttons render `{h}h` — a new "1.5h" button appears
  alongside 2h/3h/4h/6h with no code change needed there.
- Tests: added a `vi.resetModules()` + fresh dynamic import test in `tests/settingsStore.test.ts`
  proving the true module-level default (not the file's `beforeEach`-forced value) is `1.5`.

---

## #532 — Merge DND start/end and waking-hours into one shared, synced setting

**Hard constraint that shaped the design:** `hooks/useInterruptConfig.ts` (off-limits, owned by
Barry's W1B stream, already `status: done`) destructures `dndStart`/`dndEnd` by these exact
field names from `useSettingsStore()` and re-exports `isInDnd(dndStart, dndEnd, now?)` with its
existing signature. I could not touch that file, so **the wire shape of `dndStart`/`dndEnd` and
`isInDnd`'s signature are unchanged** — verified `hooks/useInterruptConfig.test.ts` and
`components/InterruptHandler.test.tsx` (also off-limits) both still pass untouched.

**What actually changed (semantics + a real conversion bridge, not a field rename):**
- `store/settingsStore.ts`: `dndStart`/`dndEnd` are now documented as THE single canonical
  shared quiet-hours setting for both platforms — replacing the "two independently-configured
  concepts" framing — rather than desktop-only DND.
- **Default realigned**: `dndStart` changed from `"22:00"` to `"21:00"` — the exact complement
  of mobile's `push_tokens.waking_hours_start_local`/`_end_local` default (8–21). Pre-#532, the
  two platforms' defaults were one hour off from being true complements of each other; now a
  fresh install on either platform represents the identical effective window.
- **New exported conversion functions** (the real "shared setting" plumbing):
  - `dndWindowToWakingHours(dndStart, dndEnd) -> { wakingHoursStartLocal, wakingHoursEndLocal }`
  - `wakingHoursToDndWindow(wakingHoursStartLocal, wakingHoursEndLocal) -> { dndStart, dndEnd }`
  Both are pure, symmetric for whole-hour values, clamp into `push_tokens`' `0-23` smallint
  constraint, and document the accepted minute-precision loss (desktop is "HH:MM", mobile is
  whole-hour-only) — same "document the known asymmetry" convention already used elsewhere in
  this codebase (e.g. `os_events.rs`'s Linux IdleHint gap). These are ready for the future
  desktop sync layer (docs/INTERRUPT_ARCHITECTURE.md §5, "Task #169 area") to call — **no live
  cross-device write-through exists yet**, since that layer isn't built; I did not overclaim
  this in `app/settings/page.tsx`'s UI copy (added a doc comment there instead, left the
  user-facing text unchanged since it was already accurate).
- `store/migrations.ts`: the v1 migration's `dndStart` fallback (for pre-v1 data missing the
  field entirely — i.e. already-corrupt/legacy blobs, not real migrated user data) realigned
  from `"22:00"` to `"21:00"` for consistency with the new canonical default.
- **No `push_tokens` migration needed** — the existing columns already have the right shape and
  semantics to be the "mobile side" of this shared setting; I used the brief's "if needed"
  qualifier and determined it wasn't. No new Supabase migration file created (avoids any
  filename collision with Charles's `20260813000000_interrupt_gate_events.sql`, also untouched).
- **No `SETTINGS_VERSION` bump** — same reasoning as #531: default/semantic change, not a shape
  change; existing persisted `dndStart`/`dndEnd` values are untouched.

**Exact new shape for later waves depending on this (per the brief's own note):**
- `dndStart: string`, `dndEnd: string` — UNCHANGED field names and "HH:MM" shape.
- `isInDnd(dndStart: string, dndEnd: string, now = new Date()): boolean` — UNCHANGED signature.
- New: `dndWindowToWakingHours(dndStart: string, dndEnd: string): { wakingHoursStartLocal: number; wakingHoursEndLocal: number }`
- New: `wakingHoursToDndWindow(wakingHoursStartLocal: number, wakingHoursEndLocal: number): { dndStart: string; dndEnd: string }`
- New default: `dndStart = "21:00"`, `dndEnd = "08:00"` (was `"22:00"`/`"08:00"`).

Tests: 9 new tests in `tests/settingsStore.test.ts` (fresh-default test for dndStart/dndEnd,
round-trip conversion, precision-loss truncation, out-of-range clamping, malformed-input
fallback) plus 1 updated assertion in `tests/migrations.test.ts` (the v1 fallback default).

---

## Verification Gate (2026-08-13, run after all three tasks)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 1843/1843 pass (up from 1841 pre-#531/#532's new tests) ✓
- `npm run lint`: 0 errors (7 pre-existing warnings, all in files this stream did not touch) ✓
- `npx vitest run --coverage`: stmts 91.32%, branches 86.96%, funcs 91.34%, lines 93.08% — all
  above the AGENTS.md floor (84/79/81/82) ✓
- `cargo check` / `cargo test` (src-tauri, macOS host): 0 warnings, 35/35 tests pass ✓
- Existence-only-assertion grep gate: 1 pre-existing hit in `tests/syncStore.test.ts`
  (`deviceId!.length).toBeGreaterThan(0)`), predates this stream's work (last touched by an
  unrelated Task #169 commit, `78fab47`) — not a file this stream owns or edited, left as-is.
- Off-limits files (`hooks/useInterruptConfig.ts`, `hooks/useInterruptConfig.test.ts`,
  `components/InterruptHandler.tsx`/`.test.tsx`, `supabase/migrations/`) — confirmed untouched
  via `git status`; their existing tests re-run clean against my changes.
