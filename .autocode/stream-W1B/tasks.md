# Stream W1B Task State

### Task #195: Fix documentation-trust: updateInterruptConfig JSDoc says "the Rust background thread" (singular), obscuring two threads exist.

**File:** lib/tauriInterrupt.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
JSDoc states 'the Rust background thread' (singular), obscuring that there are two independent Rust threads (interrupt.rs's own loop and os_events.rs) and that neither of them consumes wake_enabled/unlock_enabled/idle_enabled/idle_threshold_secs as the singular-thread framing implies, at lib/tauriInterrupt.ts:JSDoc above updateInterruptConfig:21.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/tauriInterrupt.ts:JSDoc above updateInterruptConfig:21
- [ ] Rewrite JSDoc to name both threads and their actual field consumption

**Source:** Audit finding F009 — severity 8 — documentation-trust

---

---

### Task #221: Fix reliability: exitMandatoryMode has no try/catch and its call sites handle failure inconsistently.

**File:** lib/tauriInterrupt.ts, app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
exitMandatoryMode() (tauriInterrupt.ts:60-63) has no try/catch, unlike sibling updateInterruptConfig/snoozeInterrupt in the same file. app/study/page.tsx:73 has zero error handling around its call (unhandled-rejection risk, user could be stuck in a locked window); app/study/page.tsx:121 uses try/finally but no catch. Predates the #163/#164 diff — pre-existing debt, at exitMandatoryMode and call sites:60.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at exitMandatoryMode and call sites:60
- [ ] Add try/catch with an ERR-* ref log matching the sibling pattern in the same file

**Source:** Audit finding F036 — severity 4 — reliability

---

---

### Task #197: Fix documentation: interrupt.rs file header not updated to list the 4 new InterruptState fields.

**File:** src-tauri/src/interrupt.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
File header (lines 1-6) describing InterruptState has not been updated to list the 4 new fields (wake_enabled, unlock_enabled, idle_enabled, idle_threshold_secs), at src-tauri/src/interrupt.rs:file header:1.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at src-tauri/src/interrupt.rs:file header:1

**Source:** Audit finding F011 — severity 4 — documentation

---

---

### Task #218: Fix reliability: update_interrupt_config silently no-ops on a poisoned mutex with no error surfaced.

**File:** src-tauri/src/interrupt.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Silently no-ops on a poisoned mutex (lines 111-119); the JS caller receives a resolved promise and believes the config was applied even though nothing was written, at src-tauri/src/interrupt.rs:update_interrupt_config:111.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at src-tauri/src/interrupt.rs:update_interrupt_config:111
- [ ] Log or surface an error when the lock cannot be acquired, per Rule 8 (Log Everything)

**Source:** Audit finding F033 — severity 5 — reliability

---

---

### Task #203: Fix test-quality: banned .not.toBeNull() assertion with no existence-check comment.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
expect(queryIdleThresholdInput()).not.toBeNull() is a banned assertion form per AGENTS.md's Stop-the-Line list, with no inline `// existence-check: [reason]` comment. The value under test is not non-deterministic, so the documented exception does not apply, at app/settings/page.test.tsx:idle-threshold input presence test:302.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at app/settings/page.test.tsx:idle-threshold input presence test:302
- [ ] Either add a specific-value assertion in place of .not.toBeNull(), or justify with an inline existence-check comment

**Source:** Audit finding F018 — severity 3 — test-quality

---

---

### Task #207: Fix documentation: new Task #164 tests inserted out of numeric order in page.test.tsx.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
New Task #164 tests were inserted labeled 'Test 4'/'Test 5' ahead of the pre-existing 'Test 3' comment block, producing non-sequential numbering, at app/settings/page.test.tsx:n/a — test ordering:0.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at app/settings/page.test.tsx:n/a — test ordering:0
- [ ] Renumber the "Test N" comments to match file order

**Source:** Audit finding F022 — severity 2 — documentation

---

---

### Task #208: Fix documentation: page.test.tsx file header not updated for new OS-trigger test coverage.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
File header comment was not updated to reflect the newly added OS-trigger test coverage, at app/settings/page.test.tsx:file header comment:1.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at app/settings/page.test.tsx:file header comment:1

**Source:** Audit finding F023 — severity 3 — documentation

---

---

### Task #220: Fix scope: license/notification/mandatory-mode tests in page.test.tsx are unrelated to Task #163's OS-trigger feature.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
License/notification/mandatory-mode tests (12-25) are unrelated to Task #163's OS-trigger feature — scope bleed into Task #164, though separately authorized by the user mid-task to close a coverage gap, at app/settings/page.test.tsx:tests 12-25:0.
NEW

**Acceptance Criteria:**
- [ ] Review whether these tests should be documented as their own coverage initiative rather than attributed to Task #164's scope

**Source:** Audit finding F035 — severity 2 — scope

---

---

