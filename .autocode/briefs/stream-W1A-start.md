# Adam — Stream W1A — Wave 1 — 2026-07-04

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W1A | #187 #188 #189 #190 #199 #209 #214 #219

You are Adam, a CTO working on a specific set of Batch 19 remediation tasks in parallel
with 3 other windows (this wave has 4 streams). These tasks all came from the /audit #164
verdict (FAIL, severity 9): Task #163's OS trigger settings feature (wake/unlock/idle toggles
+ idle threshold) is entirely non-functional because src-tauri/src/os_events.rs — the only
Rust code that fires wake/unlock/idle interrupts — never reads the config fields Task #163
built the whole UI/store/IPC chain to expose. Work exclusively on the files listed under
"Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #187
2. /task #188
3. /task #189
4. /task #190
5. /task #199
6. /task #209
7. /task #214
8. /task #219

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W1A
[ ] #187
[ ] #188
[ ] #189
[ ] #190
[ ] #199
[ ] #209
[ ] #214
[ ] #219

Update to [✓] as each completes. This lets Max glance at any window and know exactly
where you are.

## Files You Own (edit ONLY these)
src-tauri/src/os_events.rs
app/settings/page.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/learn/page.tsx
app/settings/page.test.tsx
app/study/page.tsx
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
lib/tauriInterrupt.ts
src-tauri/src/interrupt.rs
src-tauri/src/lib.rs
store/migrations.ts
store/settingsStore.ts
tests/migrations.test.ts
tests/settingsStore.test.ts
tests/tauri.test.ts

## Task Definitions

### Task #187: Fix functional-defect: wake_enabled is written by update_interrupt_config but never read anywhere else in the crate.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
wake_enabled is written by update_interrupt_config (interrupt.rs:115-118) but never read anywhere else in the crate. The wake-detection branch fires on `elapsed>WAKE_THRESHOLD_SECS && enabled && now>=snooze_until` — it omits the wake_enabled check entirely, so toggling 'Wake' off in Settings has zero runtime effect at src-tauri/src/os_events.rs:start_os_listeners (wake-detection branch):172.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:start_os_listeners (wake-detection branch):172
- [ ] Add `wake_enabled` to the guard-state destructure at os_events.rs:165-168 and gate the wake-detection branch on it
- [ ] Add a regression test tracing update_interrupt_config(wake_enabled: false) → no interrupt:fire on simulated wake

**Source:** Audit finding F001 — severity 9 — functional-defect

---

---

### Task #188: Fix functional-defect: unlock_enabled is written but never read.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
unlock_enabled is written but never read. The unlock-detection branch fires on `prev_locked && !is_locked && enabled && now>=snooze_until`, omitting unlock_enabled at src-tauri/src/os_events.rs:start_os_listeners (unlock-detection branch):181.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:start_os_listeners (unlock-detection branch):181
- [ ] Gate the unlock-detection branch on unlock_enabled
- [ ] Add a regression test tracing update_interrupt_config(unlock_enabled: false) → no interrupt:fire on simulated unlock

**Source:** Audit finding F002 — severity 9 — functional-defect

---

---

### Task #189: Fix functional-defect: idle_enabled is written but never read.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
idle_enabled is written but never read. The idle-detection branch fires on `prev_idle && !is_idle && enabled && now>=snooze_until`, omitting idle_enabled at src-tauri/src/os_events.rs:start_os_listeners (idle-detection branch):191.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:start_os_listeners (idle-detection branch):191
- [ ] Gate the idle-detection branch on idle_enabled
- [ ] Add a regression test tracing update_interrupt_config(idle_enabled: false) → no interrupt:fire on simulated idle-return

**Source:** Audit finding F003 — severity 9 — functional-defect

---

---

### Task #190: Fix functional-defect: IDLE_THRESHOLD_SECS is hardcoded to 900.0 instead of the configurable st.idle_threshold_secs.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
IDLE_THRESHOLD_SECS is hardcoded to 900.0 (line 31) and used at line 160 instead of the configurable st.idle_threshold_secs field. Changing the idle-threshold UI input in Settings has zero effect on runtime behavior at src-tauri/src/os_events.rs:module const IDLE_THRESHOLD_SECS / start_os_listeners:31.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:module const IDLE_THRESHOLD_SECS / start_os_listeners:31
- [ ] Read st.idle_threshold_secs from the guard-state destructure and use it in place of the hardcoded constant
- [ ] Add a test asserting a custom idle_threshold_secs value changes the actual idle-detection wait time

**Source:** Audit finding F004 — severity 8 — functional-defect

---

---

### Task #199: Fix functional-defect: OS Triggers UI section has no platform gate — renders non-functionally on Windows/Linux.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The OS Triggers section (lines 102-114) is gated only on interruptEnabled && isTauri, with no platform check. It renders (non-functionally) on Windows/Linux Tauri builds where os_events.rs is a documented total no-op for these fields, compounding F001-F004, at app/settings/page.tsx:OS Triggers section:102.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at app/settings/page.tsx:OS Triggers section:102
- [ ] Gate the section on a platform capability check (e.g. macOS-only) until Batch 15 Windows/Linux support lands

**Source:** Audit finding F014 — severity 8 — functional-defect

---

---

### Task #209: Fix input-validation: idle-threshold number input has no clamp/validation logic.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The idle-threshold number input's onChange has no clamp/validation logic; native min/max HTML attributes are UI-only and not enforced by any JS or Rust code path, at app/settings/page.tsx:idle-threshold number input onChange:110.
NEW

**Acceptance Criteria:**
- [ ] Fix input-validation issue at app/settings/page.tsx:idle-threshold number input onChange:110
- [ ] Clamp to [5,120] in the onChange handler

**Source:** Audit finding F024 — severity 5 — input-validation

---

---

### Task #214: Fix code-quality: idle-threshold min/max are inlined magic literals instead of named constants.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Magic literals 5 and 120 are inlined as min/max rather than named constants. AGENTS.md: "any hardcoded string that belongs in a named constant" is a Stop-the-Line violation, at app/settings/page.tsx:idle-threshold number input:110.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/settings/page.tsx:idle-threshold number input:110
- [ ] Extract IDLE_THRESHOLD_MIN_MINUTES / IDLE_THRESHOLD_MAX_MINUTES constants (e.g. in settingsStore.ts, matching INTERVAL_OPTIONS/SNOOZE_OPTIONS convention)

**Source:** Audit finding F029 — severity 2 — code-quality

---

---

### Task #219: Fix accessibility: idle-threshold label has no htmlFor/id association with its input.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The idle-threshold label has no htmlFor/id association. Task #164 worked around this in tests via DOM traversal instead of fixing the markup. Pre-existing pattern elsewhere in the file, but a missed opportunity to fix while touching this exact markup, at app/settings/page.tsx:idle-threshold label/input:109.
NEW

**Acceptance Criteria:**
- [ ] Fix accessibility issue at app/settings/page.tsx:idle-threshold label/input:109
- [ ] Add htmlFor/id association; simplify the test's queryIdleThresholdInput() helper to use getByLabelText once fixed

**Source:** Audit finding F034 — severity 2 — accessibility

---

## Context You Need

This wave fixes findings from a 7-agent independent audit (/audit #164, verdict FAIL,
severity 9, 39 findings). The central defect: `update_interrupt_config` in
`src-tauri/src/interrupt.rs` correctly writes `wake_enabled`, `unlock_enabled`,
`idle_enabled`, `idle_threshold_secs` into shared `InterruptState`, but
`src-tauri/src/os_events.rs`'s guard-state destructure (around line 165) only reads
`(enabled, snooze_until, mandatory)` — never the 4 new fields. Every wake/unlock/idle
detection branch in that file gates only on the master `enabled` flag. A self-authored
TODO comment in os_events.rs (around line 29) already documents this exact gap.

11 further tasks in Batch 19 (#191,#192,#193,#194,#196,#198,#210,#213,#215,#216,#225) are
DEFERRED — blocked by the P1 wiring tasks (#187-#190) landing first. They will surface in
Wave 2 once this wave closes.

## When You Finish
Write your completion summary to .autocode/stream-W1A/completion.md (append, do not
overwrite prior wave history in that file):
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W1A | #187 #188 #189 #190 #199 #209 #214 #219
