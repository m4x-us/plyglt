# Stream W1A Task State

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

---

