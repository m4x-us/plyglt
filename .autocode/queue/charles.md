---
status: done
stream: W8C
wave: 8
---

# Charles — Stream W8C — Wave 8 — 2026-08-16

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W8C | #633 #641 #635

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

Your first two tasks are both async-safety gaps in components/InterruptHandler.tsx — read the whole file in full first.

**#633 first (severity 6).** The `updateInterruptConfig` effect's `configSeqRef` staleness guard (`if (seq !== configSeqRef.current) return;`) only exists inside the `.catch()` handler — if an OLDER `updateInterruptConfig()` call resolves SUCCESSFULLY after a newer one has already started (plausible when a user toggles a setting twice quickly), nothing stops the older call's success path from silently overwriting the Rust-side config with stale values. Add the identical staleness check to the success path too — the `.then()`-equivalent (this is an async function without explicit `.then()`, so add the check right after the `await updateInterruptConfig(...)` call succeeds, before whatever happens next — check if anything currently happens after the await besides implicit completion; if the call has no further side effects on success today, document briefly why the check is still worth adding defensively for future changes, or skip it if truly inert — use your judgment after reading the exact code). Add a regression test: two overlapping config-update calls, older resolving after newer, assert the FINAL state matches the newer call's values, not the older one's.

**#641 next (severity 5).** The `interrupt:fire` listener has no re-entrancy guard or mutual-exclusion lock. `src-tauri/src/interrupt.rs` documents `emit_interrupt` as fire-and-forget with no queueing/retry. If the event fires twice in rapid succession, two concurrent async executions of the callback body could both pass the early-return guards and both proceed — potentially two duplicate mandatory locks or notifications for one logical interrupt. Add a simple in-flight guard (a `useRef<boolean>` or similar, set at the start of the listener callback and cleared in a `finally`) so a second concurrent fire is a no-op while the first is still processing. Follow the existing `configSeqRef` pattern in this same file for the general shape (a ref-based guard, not a state-triggered one). Add a regression test: fire the listener twice in rapid succession (before the first async chain resolves), assert only one full execution occurs (e.g. `markInterruptFired` called once, not twice).

**#635 last (severity 3, different file, test-only).** Two tests in hooks/useInterruptConfig.test.ts — 'does not flex when reviews are due' and 'falls through to a near-due card when the flex introduction is blocked but a near-due card exists' — pass the Deletion Test negatively: each produces the identical asserted result even if the specific guard clause its own name claims to prove were deleted. The underlying `computeDue` logic itself is NOT shown incorrect — this is purely a test-strengthening task. For each: find a way to make the assertion depend on the specific guard actually running (a spy proving the branch executed, similar to the existing 'Task #558' pattern already in this same file a few lines away — read it for the exact technique).

## Your Tasks (run in this exact order)
1. /task #633  — Fix async: The staleness check `if (seq !== configSeqRef.current) return;` exists only inside the .catch() handler of the updateInt
2. /task #641  — Fix async: The interrupt:fire listener has no re-entrancy guard or mutual-exclusion lock. src-tauri/src/interrupt.rs documents emit
3. /task #635  — Fix tests: Two tests - 'does not flex when reviews are due' and 'falls through to a near-due card when the flex introduction is blo

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W8C
[→] #633 — Fix async: The staleness check `if (seq !== configSeqRef.current) return;` exists only inside the .catch() handler of the updateInt   ← starting now
[ ] #641 — Fix async: The interrupt:fire listener has no re-entrancy guard or mutual-exclusion lock. src-tauri/src/interrupt.rs documents emit
[ ] #635 — Fix tests: Two tests - 'does not flex when reviews are due' and 'falls through to a near-due card when the flex introduction is blo

## Files You Own (edit ONLY these)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
hooks/useInterruptConfig.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel, or read-only reference)
.autocode/debt.md
app/study/page.test.tsx
app/study/page.tsx
hooks/useStudySession.test.ts
hooks/useStudySession.ts
lib/storage.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/dueEstimate.ts
tests/pushDispatch.test.ts
tests/pushDueEstimate.test.ts
tests/storage.test.ts

## Task Definitions

### Task #633

### Task #633: Fix async: The staleness check `if (seq !== configSeqRef.current) return;` exists only inside the .catch() handler of the updateInt

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The staleness check `if (seq !== configSeqRef.current) return;` exists only inside the .catch() handler of the updateInterruptConfig() call. If an OLDER call resolves SUCCESSFULLY after a newer one has already started - plausible on a real IPC round-trip when a user toggles a setting twice in quick succession - there is no check preventing the older call's success path from silently overwriting the Rust-side config with stale values. The comment above the guard claims protection against exactly this class of race, but the guard as written only covers the reject path. at components/InterruptHandler.tsx:updateInterruptConfig effect / configSeqRef guard:73.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at components/InterruptHandler.tsx:updateInterruptConfig effect / configSeqRef guard:73
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F007 — severity 6 — async

---

### Task #641

### Task #641: Fix async: The interrupt:fire listener has no re-entrancy guard or mutual-exclusion lock. src-tauri/src/interrupt.rs documents emit

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The interrupt:fire listener has no re-entrancy guard or mutual-exclusion lock. src-tauri/src/interrupt.rs documents emit_interrupt as fire-and-forget with no queueing/retry. If the event fires twice in rapid succession, two concurrent async executions of the callback can both pass the early-return guards and both proceed, potentially producing two duplicate mandatory locks or notifications for one logical interrupt. at components/InterruptHandler.tsx:interrupt:fire listener:102.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at components/InterruptHandler.tsx:interrupt:fire listener:102
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F015 — severity 5 — async

---

### Task #635

### Task #635: Fix tests: Two tests - 'does not flex when reviews are due' and 'falls through to a near-due card when the flex introduction is blo

**File:** hooks/useInterruptConfig.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Two tests - 'does not flex when reviews are due' and 'falls through to a near-due card when the flex introduction is blocked but a near-due card exists' - pass the Deletion Test negatively: each would produce the identical asserted result even if the specific guard clause its own name claims to prove were deleted. No live behavioral defect is implicated - the underlying computeDue logic itself is not shown incorrect. at hooks/useInterruptConfig.test.ts:computeDue tests:217.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useInterruptConfig.test.ts:computeDue tests:217
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useInterruptConfig.test.ts

**Source:** Audit finding F009 — severity 3 — tests

---

## Verification Gate (run before writing completion.md)
- `npx tsc --noEmit` — zero errors
- `npm test` — all tests pass (other streams are editing other files concurrently; a failure
  in a file you did not touch is not yours to fix, but confirm via `git status` before assuming)
- `npm run lint` — zero errors
- `scripts/deep-audit.sh` does not exist in this repo (confirmed every prior wave) — the real
  Verification Gate above is the actual acceptance criterion for every task.
- For every NEW assertion you add, run the Deletion Test: temporarily revert the production
  fix and confirm your new test fails, then restore it and confirm it passes. State explicitly
  in your completion.md which tasks got a live Deletion Test vs. traced-by-hand verification.

IMPORTANT — do not run `git stash` on your own initiative. If `git status` looks messy or
shows changes you don't recognize, report it in your completion.md rather than resolving it
yourself with a repo-wide command.

This wave includes several tasks that ask for a genuine design decision (not a mechanical
fix). Explain your reasoning clearly in completion.md — do not silently pick an option
without stating why.

## When You Finish
Write your completion summary to .autocode/stream-W8C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W8C | #633 #641 #635
