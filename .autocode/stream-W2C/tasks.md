# Stream W2C Task State

### Task #528 | feature | severity 5
**What:** New pure client-side module (e.g. `lib/interruptGate.ts`, no React/Zustand — matches `lib/syncClient.ts`'s existing pattern) exposing a read function ("what's the most recent `effective_until` for this user") and a write function ("record a `fired`/`snoozed` event"), both plain authenticated Supabase REST calls against `interrupt_gate_events` (Task #525) — reusing desktop's existing authenticated Supabase session from Task #169, no new auth plumbing. Read calls use a short, non-blocking timeout (starting point 500ms–1s per `docs/INTERRUPT_ARCHITECTURE.md` §6 — Max confirmed this exact range 2026-08-13, not a hard blocker on the precise value) with a documented fallback contract (caller decides what to do on timeout — this module just surfaces "gate state" or "unknown, timed out," it doesn't itself decide fire-vs-suppress).
**Why:** The shared-gate read/write logic needs to live somewhere both the OS-event path and the snooze button can call — a dedicated `lib/` module keeps it testable in isolation (mocked Supabase calls) rather than duplicated inline in two different UI entry points.
**File:** New `lib/interruptGate.ts`, `lib/interruptGate.test.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no UI wiring yet (that's #529/#530)
**Blocked by:** #525 (COMPLETE, Wave 1) | **Blocks:** #529, #530
**Done when:** Read function returns the gate state or an explicit timeout/unknown signal within the configured timeout, tested with a mocked slow/failing Supabase client. Write function correctly computes `effective_until` for both `fired` (occurred_at + interval) and `snoozed` (occurred_at + snooze minutes) event types. No React, no Zustand imports (matches CLAUDE.md's Layer Map for `lib/`).
**Owner:** Architecture Agent
