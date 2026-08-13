---
status: done
agent: barry
stream: W3B
wave: 3
---

# Barry — Stream W3B — Wave 3 — 2026-08-13

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W3B | #530

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

This is the last wave of Batch 21 (docs/INTERRUPT_ARCHITECTURE.md) — once #529 (the
other Wave 3 stream) and #530 both close, the whole batch is done.

## Your Tasks (run in this exact order)
1. /task #530  — Snooze writes a shared event

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W3B
[→] #530 — Snooze writes a shared event   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/tauriInterrupt.ts
app/study/page.tsx
(and relevant test files — tests/tauri.test.ts, app/study/page.test.tsx)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
(Adam's W3A stream owns these for #529)

## Task Definitions

### Task #530 | feature | severity 5
**What:** Desktop's snooze action (currently `lib/tauriInterrupt.ts`'s `snoozeInterrupt`, which only ever touches local in-memory Rust state via `interrupt.rs`'s `snooze_interrupt` command) also writes a `snoozed` event via Task #528's write function, so a snooze on one device is visible to every other device (including, once mobile ships, a phone) via the same shared gate.
**Why:** Without this, a user who snoozes on their phone gets no relief on their desktop a few minutes later, and vice versa — directly the scenario Max raised. This is a genuinely new capability for mobile (which has no snooze concept at all today), not just syncing an existing one. See `docs/INTERRUPT_ARCHITECTURE.md` §8.
**File:** `lib/tauriInterrupt.ts`, `app/study/page.tsx` (the "Snooze X min" button call site), relevant test files
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (2 source + their 2 test counterparts)
**Blocked by:** #528 (COMPLETE, Wave 2) | **Blocks:** Nothing
**Done when:** Clicking Snooze writes a `snoozed` event with the correct `effective_until` (now + snooze minutes). A test proves a device checking the gate shortly after respects a snooze event it didn't itself create (simulated as if from another device).
**Owner:** Architecture Agent

## Prior Wave Changes — Read Before Starting

**#528 (completed by Charles, Wave 2) — the exact write function you call:**

```ts
export async function recordInterruptGateEvent(params: {
  userId: string;
  deviceId: string;
  eventType: "fired" | "snoozed";
  occurredAt: number;          // unix ms
  minutesUntilEligible: number; // snooze minutes, for your call
}): Promise<{ ok: true } | { ok: false; error: string }>
```
For your snooze call: `eventType: "snoozed"`, `occurredAt: Date.now()`,
`minutesUntilEligible` = the snooze duration in minutes (already available where
`snoozeInterrupt` is called today — check `app/study/page.tsx`'s existing "Snooze X
min" button and `store/settingsStore.ts`'s `snoozeMinutes` setting for the exact
source value). `effective_until` is computed *inside* `recordInterruptGateEvent` from
`occurredAt + minutesUntilEligible * 60_000` — you don't compute it yourself.

**Where to get `userId` and `deviceId`:** `userId` from `store/authStore.ts`'s
`userId: string | null`. `deviceId` from `store/syncStore.ts`'s `deviceId` (generated
once, persisted — reuse it, don't generate a new one). If `userId` is null (signed
out), skip the shared-gate write entirely — the existing local Rust snooze
(`interrupt.rs`'s `snooze_interrupt`) still applies regardless; the shared write is
additive, not a replacement, same relationship #529's gate-check has to the existing
local firing logic.

**#526 (completed by Adam, Wave 2) — a sibling function's pattern to match:**
`lib/tauriInterrupt.ts` already has `markInterruptFired()` (added Wave 2, no args,
same file you're touching) as the most recent addition to this file's wrapper
collection — read it directly for the established error-handling/logging shape
(`[ERR-IPC-...]`-tagged `console.error` + throw) before adding your own change to
`snoozeInterrupt`, so the two stay stylistically consistent within the same file.

## Agent Memories

## Architect Agent Memory (first 150 lines)
[Full first 150 lines of .autocode/agents/architect.md — layer structure. Most
relevant: `lib/tauriInterrupt.ts` is a `lib/` gateway file — it may import from
`lib/interruptGate.ts` (a sibling `lib/` module) directly; `app/study/page.tsx` stays
within the ≤150-line route cap CLAUDE.md documents — if your change would push it over,
follow the project's existing extraction-to-a-hook pattern rather than let the route
grow past the limit.]

## When You Finish
Write your completion summary to .autocode/stream-W3B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #530
NOT_CLOSED: none

(If not closed, list it with a one-line reason instead.)

After those two lines, write whatever prose detail is useful:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Barry is done." (or describe what's incomplete). This is
the last task in Batch 21 for your stream — once you and Adam (W3A) both report done,
the whole batch closes.

— Barry | W3B | #530
