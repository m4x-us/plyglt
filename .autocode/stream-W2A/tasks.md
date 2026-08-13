# Stream W2A Task State

### Task #526 | feature | severity 5
**What:** `components/InterruptHandler.tsx`'s `interrupt:fire` handler calls the new `mark_interrupt_fired` Tauri command (Task #524) at the exact point it decides to actually show content — after the `totalDue === 0` early-return, for both the mandatory and passive-notification paths.
**Why:** Closes the loop Task #524 opens: the Rust side stops auto-advancing the clock on emit, so nothing advances it at all until this task wires up the confirmation. Both tasks are needed together for the desktop clock semantics to actually work end to end.
**File:** `components/InterruptHandler.tsx`, `components/InterruptHandler.test.tsx`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, one new IPC call at an existing decision point
**Blocked by:** #524 (COMPLETE, Wave 1) | **Blocks:** #529
**Done when:** A test proves `mark_interrupt_fired` is called exactly when real content is shown (both mandatory and passive branches) and NOT called when `totalDue === 0` short-circuits. `npx tsc --noEmit`, full test suite, lint clean.
**Owner:** Architecture Agent
