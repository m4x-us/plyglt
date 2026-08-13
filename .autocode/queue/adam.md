---
status: done
agent: adam
stream: W3A
wave: 3
---

# Adam — Stream W3A — Wave 3 — 2026-08-13

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W3A | #529

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

This is the last wave of Batch 21 (docs/INTERRUPT_ARCHITECTURE.md) — once #529 and #530
(the other Wave 3 stream) close, the whole batch is done.

## Your Tasks (run in this exact order)
1. /task #529  — Wire shared gate into desktop's firing decision

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W3A
[→] #529 — Wire shared gate into desktop's firing decision   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
(or a new co-located hook, per the task's own File field, if this pushes
InterruptHandler.tsx past its size cap — CLAUDE.md documents the project's existing
extraction pattern for this situation)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/tauriInterrupt.ts
app/study/page.tsx
(and their test files — Barry's W3B stream owns these for #530)

## Task Definitions

### Task #529 | feature | severity 6
**What:** Wire Task #528's gate-check into desktop's actual firing decision: before firing (OS event or scheduled poll path), check the shared gate via `lib/interruptGate.ts`; on timeout/unknown, fall back to local last-known state and fire anyway (per `docs/INTERRUPT_ARCHITECTURE.md` §6's recommendation — fire-anyway-on-timeout over suppress-on-timeout, confirmed by Max 2026-08-13). On an actual fire with content, write a `fired` event via #528.
**Why:** This is the task that actually makes cross-device coordination real — #525/#527/#528 build the pieces, this is where desktop starts using them for real firing decisions instead of only its local clock.
**File:** `components/InterruptHandler.tsx` (or a new co-located hook if this pushes the file past its size cap, matching the project's existing extraction pattern for oversized files)
**Severity:** 6 | **DoD Tier:** 3
**Complexity:** ⚡ Direct — 1 file, no matched scope-trigger word (rubric-mechanical label; genuinely cross-cutting in effect since it's the task that makes #526/#528 actually load-bearing, not reflected by file count alone)
**Blocked by:** #526, #528 (both COMPLETE, Wave 2) | **Blocks:** Nothing
**Done when:** Tests prove: a fresh `fired` event from another device (simulated) suppresses a local fire that would otherwise have happened; a gate-check timeout still allows a local fire (fire-anyway fallback); a real local fire writes a `fired` event. Full verification gate clean.
**Owner:** Architecture Agent

## Prior Wave Changes — Read Before Starting

**#528 (completed by Charles, Wave 2) — the exact module/functions you call:**

`lib/interruptGate.ts` exports:
```ts
export type GateReadResult =
  | { status: "known"; effectiveUntil: number | null } // unix ms; null = no history yet
  | { status: "unknown"; reason: "timeout" | "error" | "not_configured"; error?: string };

export async function readInterruptGateState(
  userId: string,
  timeoutMs: number = 750 // DEFAULT_GATE_READ_TIMEOUT_MS
): Promise<GateReadResult>

export async function recordInterruptGateEvent(params: {
  userId: string;
  deviceId: string;
  eventType: "fired" | "snoozed";
  occurredAt: number;          // unix ms
  minutesUntilEligible: number; // interval minutes for 'fired'
}): Promise<{ ok: true } | { ok: false; error: string }>
```
It never decides fire-vs-suppress itself — `"unknown"` (timeout/error) is an explicit
signal for YOU to apply the fire-anyway fallback. `"known"` with `effectiveUntil: null`
means no gate history exists yet for this user (never fired/snoozed from any device) —
treat as safe to fire. `"known"` with a real timestamp: compare against `Date.now()`.

**Where to get `userId` and `deviceId` (not in the task text, needed to actually call
the above):** `userId` comes from `store/authStore.ts`'s `userId: string | null` field
— if null (signed out / sync not set up), the gate check has nothing to check against;
treat this the same as an "unknown" result (fall back to local-only behavior, fire
anyway if otherwise due) rather than blocking interrupts entirely for signed-out users.
`deviceId` comes from `store/syncStore.ts`'s `deviceId` field (generated once via
`crypto.randomUUID()` on first use, persisted after) — reuse it, do not generate a new
one for this purpose.

**#526 (completed by Adam, Wave 2, in this same file) — what's already there:**
`InterruptHandler.tsx`'s `interrupt:fire` handler already calls
`lib/tauriInterrupt.ts`'s `markInterruptFired()` (no args) right after the
`totalDue === 0` guard, for both mandatory and passive paths. Your gate-check logic
slots in around this same point — the existing `markInterruptFired()` call represents
"tell Rust locally a fire happened"; your new gate read/write is the *additional*,
separate cross-device check/record layer, not a replacement for it. Both need to
happen on a real fire.

**#532 (completed by Adam, Wave 1) — confirms no impact on you:** `dndStart`/`dndEnd`
and `isInDnd()`'s signature are unchanged from before this whole batch — no adjustment
needed to the existing DND guard already in this file.

## Agent Memories

## Architect Agent Memory (first 150 lines)
[Full first 150 lines of .autocode/agents/architect.md — layer structure. Most
relevant: `components/` imports from `hooks/`/`lib/` only — call `lib/interruptGate.ts`
directly (it's a `lib/` module) or via a small `hooks/` wrapper if that reads cleaner;
either is consistent with the Layer Map, just don't reach into Supabase client code
directly from the component.]

## When You Finish
Write your completion summary to .autocode/stream-W3A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #529
NOT_CLOSED: none

(If not closed, list it with a one-line reason instead.)

After those two lines, write whatever prose detail is useful:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete). This is
the last task in Batch 21 for your stream — once you and Barry (W3B) both report done,
the whole batch closes.

— Adam | W3A | #529
