---
status: done
agent: barry
stream: W1B
wave: 1
---

# Barry — Stream W1B — Wave 1 — 2026-08-13

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W1B | #523

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #523  — Fix computeDue() to count introduction/new cards

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W1B
[→] #523 — Fix computeDue() to count introduction/new cards   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
hooks/useInterruptConfig.ts
hooks/useInterruptConfig.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
src-tauri/src/interrupt.rs
src-tauri/src/os_events.rs
store/settingsStore.ts
store/migrations.ts
app/settings/page.tsx
supabase/migrations/ (Charles's new interrupt_gate_events file)

## Task Definitions

### Task #523 | correctness | severity 5
**What:** `hooks/useInterruptConfig.ts`'s `computeDue()` only sums `store/srsStore.ts`'s `getStats(unitCards).due` (cards with `reps > 0 && isDue(now)`). Extend it to also count cards due via `getIntroductionDueCardIds` (the intensive introduction cadence) and qualifying new cards via `getNewCards` — the same content `lib/queue.ts`'s `buildQueue` already pulls in for a session, just missing from the fire-gate.
**Why:** Today, on a day where a user has only an introduction-phase card needing its next appearance (per BRAND.md's "appears every interrupt on Day 1" cadence table) and zero traditional FSRS reviews due, `computeDue()` returns 0 and the interrupt never fires — silently breaking the introduction engine's own cadence promise. See `docs/INTERRUPT_ARCHITECTURE.md` §2.
**File:** `hooks/useInterruptConfig.ts`, `hooks/useInterruptConfig.test.ts` (new or extended)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, single-scope logic fix
**Blocked by:** Nothing | **Blocks:** Nothing (independent of the rest of this batch)
**Done when:** A test proves `computeDue` returns non-zero when the only due content is an introduction-cadence card or a qualifying new card (today's implementation would return 0 for both — this is the Deletion Test). `npx tsc --noEmit`, full test suite, lint all clean.
**Owner:** Architecture Agent

## Agent Memories

## Architect Agent Memory (first 150 lines)
[Full first 150 lines of .autocode/agents/architect.md — layer structure, key files/blast
radius. Relevant here: `store/srsStore.ts` is the project's highest blast-radius file (20
importers) — read, don't modify it; this task only reads its existing exports
(`getIntroductionDueCardIds`, `getNewCards`), it doesn't change srsStore.ts itself.
`hooks/` compose `store/` + `lib/` per CLAUDE.md's Layer Map — this task stays within that
boundary.]

## When You Finish
Write your completion summary to .autocode/stream-W1B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #523
NOT_CLOSED: none

(If not closed, list it with a one-line reason instead.)

After those two lines, write whatever prose detail is useful:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W1B | #523
