---
status: done
agent: charles
stream: W2C
wave: 2
---

# Charles — Stream W2C — Wave 2 — 2026-08-13

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W2C | #528

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #528  — New lib/interruptGate.ts client module

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W2C
[→] #528 — New lib/interruptGate.ts client module   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/interruptGate.ts (new)
lib/interruptGate.test.ts (new)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
supabase/functions/send-interrupt-notifications/dueSelection.ts
supabase/functions/send-interrupt-notifications/dispatch.ts

## Task Definitions

### Task #528 | feature | severity 5
**What:** New pure client-side module (e.g. `lib/interruptGate.ts`, no React/Zustand — matches `lib/syncClient.ts`'s existing pattern) exposing a read function ("what's the most recent `effective_until` for this user") and a write function ("record a `fired`/`snoozed` event"), both plain authenticated Supabase REST calls against `interrupt_gate_events` (Task #525) — reusing desktop's existing authenticated Supabase session from Task #169, no new auth plumbing. Read calls use a short, non-blocking timeout (starting point 500ms–1s per `docs/INTERRUPT_ARCHITECTURE.md` §6 — Max confirmed this exact range 2026-08-13, not a hard blocker on the precise value) with a documented fallback contract (caller decides what to do on timeout — this module just surfaces "gate state" or "unknown, timed out," it doesn't itself decide fire-vs-suppress).
**Why:** The shared-gate read/write logic needs to live somewhere both the OS-event path and the snooze button can call — a dedicated `lib/` module keeps it testable in isolation (mocked Supabase calls) rather than duplicated inline in two different UI entry points.
**File:** New `lib/interruptGate.ts`, `lib/interruptGate.test.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no UI wiring yet (that's #529/#530)
**Blocked by:** #525 (COMPLETE, Wave 1) | **Blocks:** #529, #530
**Done when:** Read function returns the gate state or an explicit timeout/unknown signal within the configured timeout, tested with a mocked slow/failing Supabase client. Write function correctly computes `effective_until` for both `fired` (occurred_at + interval) and `snoozed` (occurred_at + snooze minutes) event types. No React, no Zustand imports (matches CLAUDE.md's Layer Map for `lib/`).
**Owner:** Architecture Agent

## Prior Wave Changes — Read Before Starting

**#525 (completed by yourself, Charles, in Wave 1) — the exact schema to code against:**

New file: `supabase/migrations/20260813000000_interrupt_gate_events.sql`

Table `public.interrupt_gate_events`:

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `user_id` | `uuid` | not null | — (FK → `auth.users(id)`, `on delete cascade`) |
| `event_type` | `text` | not null | — (CHECK constrained to `'fired'` or `'snoozed'`) |
| `occurred_at` | `timestamptz` | not null | — |
| `effective_until` | `timestamptz` | not null | — |
| `device_id` | `text` | not null | — |
| `created_at` | `timestamptz` | not null | `now()` |

RLS: `interrupt_gate_events_select_own`/`interrupt_gate_events_insert_own`, both
`auth.uid() = user_id` — this module runs client-side with the user's own authenticated
session (unlike mobile's server-side dispatch, which uses the service-role key), so RLS
is the actual enforcement boundary here. Your read query should be a plain `select
max(effective_until) from interrupt_gate_events where user_id = ?` (matches the
`(user_id, effective_until desc)` index built for exactly this). Your write function
computes `effective_until` itself before inserting — for `'fired'`, `occurred_at +`
whatever interval is currently configured; for `'snoozed'`, `occurred_at +` the snooze
minutes — the table has no trigger or default that computes this for you.

## Agent Memories

## Architect Agent Memory (first 150 lines)
[Full first 150 lines of .autocode/agents/architect.md — layer structure. Most
relevant: `lib/` must never import from `store/`/`hooks/`/`components/`/`app/`
(CLAUDE.md's Layer Map, enforced by a poka-yoke test elsewhere in this codebase) — this
module reuses desktop's existing authenticated Supabase client/session mechanism from
Task #169's sync work (check `lib/syncClient.ts` for the established pattern of how a
`lib/` module gets an authenticated Supabase client without importing React/Zustand).]

## When You Finish
Write your completion summary to .autocode/stream-W2C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #528
NOT_CLOSED: none

(If not closed, list it with a one-line reason instead.)

After those two lines, write whatever prose detail is useful:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]
  The exact exported function names/signatures (Wave 3's #529 and #530 both call these
  directly — be precise)

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W2C | #528
