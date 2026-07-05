---
status: done
agent: charles
stream: W1C
wave: 1
---

# Charles — Stream W1C — Wave 1 — 2026-07-04

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W1C | #200 #202 #201 #205 #204 #206 #211 #212

You are Charles, a CTO working on a specific set of Batch 19 remediation tasks in parallel
with 3 other windows (this wave has 4 streams). These tasks all came from the /audit #164
verdict (FAIL, severity 9): Task #163's OS trigger settings feature (wake/unlock/idle toggles
+ idle threshold) is entirely non-functional because src-tauri/src/os_events.rs — the only
Rust code that fires wake/unlock/idle interrupts — never reads the config fields Task #163
built the whole UI/store/IPC chain to expose. Work exclusively on the files listed under
"Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #200
2. /task #202
3. /task #201
4. /task #205
5. /task #204
6. /task #206
7. /task #211
8. /task #212

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W1C
[ ] #200
[ ] #202
[ ] #201
[ ] #205
[ ] #204
[ ] #206
[ ] #211
[ ] #212

Update to [✓] as each completes. This lets Max glance at any window and know exactly
where you are.

## Files You Own (edit ONLY these)
components/InterruptHandler.test.tsx
tests/settingsStore.test.ts
tests/tauri.test.ts
tests/migrations.test.ts
store/settingsStore.ts
store/migrations.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/learn/page.tsx
app/settings/page.test.tsx
app/settings/page.tsx
app/study/page.tsx
components/InterruptHandler.tsx
lib/tauriInterrupt.ts
src-tauri/src/interrupt.rs
src-tauri/src/lib.rs
src-tauri/src/os_events.rs

## Task Definitions

### Task #200: Fix test-quality: InterruptHandler.test.tsx not updated for the 3-to-7-arg updateInterruptConfig signature change.

**File:** components/InterruptHandler.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Not updated by Task #164 despite InterruptHandler.tsx's call signature changing from 3 to 7 arguments (lines 27, 32). Only asserts calls[1]![0] (enabled); args 4-7 (wakeEnabled, unlockEnabled, idleEnabled, idleThresholdMinutes) are never inspected, at components/InterruptHandler.test.tsx:config-sync test block:188.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at components/InterruptHandler.test.tsx:config-sync test block:188
- [ ] Assert the full 7-argument call, including all 4 new fields, with distinct values per field to catch a swap bug

**Source:** Audit finding F015 — severity 7 — test-quality

---

---

### Task #202: Fix test-quality: tests/settingsStore.test.ts has zero coverage for the 4 new OS-trigger setters.

**File:** tests/settingsStore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Zero tests exist for setWakeEnabled/setUnlockEnabled/setIdleEnabled/setIdleThresholdMinutes or their defaults, unlike every sibling setter in this file, at tests/settingsStore.test.ts:n/a — missing coverage:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/settingsStore.test.ts:n/a — missing coverage:0
- [ ] Add defaults test + one setter test per new field, matching the existing sibling pattern

**Source:** Audit finding F017 — severity 6 — test-quality

---

---

### Task #201: Fix test-quality: tests/tauri.test.ts uses identical boolean values for wakeEnabled/unlockEnabled/idleEnabled, masking swap bugs.

**File:** tests/tauri.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Lines 81, 92, 98 all use identical true values for wakeEnabled/unlockEnabled/idleEnabled, and none assert the exact object shape passed to invoke('update_interrupt_config', ...). An argument-order swap or mis-cased key would silently break Rust deserialization undetected, at tests/tauri.test.ts:update_interrupt_config test cases:81.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/tauri.test.ts:update_interrupt_config test cases:81
- [ ] Use distinct values per field and assert invoke's exact call argument object shape

**Source:** Audit finding F016 — severity 5 — test-quality

---

---

### Task #205: Fix test-quality: web-mode updater test passes by coincidence with no spy on the plugin's check().

**File:** tests/tauri.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The "returns available:false in web mode without consulting the updater plugin" test passes by coincidence — there is no spy on the updater plugin's check(), so it would also pass via the catch-block side effect alone. Pre-existing test, not part of the #163/#164 diff, at tests/tauri.test.ts:'returns available:false in web mode...' test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/tauri.test.ts:'returns available:false in web mode...' test:0
- [ ] Add a spy asserting the plugin's check() is never called in web mode

**Source:** Audit finding F020 — severity 3 — test-quality

---

---

### Task #204: Fix test-quality: three "no-op at current version" migration tests would pass even if the version-guard were deleted.

**File:** tests/migrations.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Three tests (migrateSrsStore:40, migrateEntitlementStore:256, migrateSettingsStore:355) would still pass if the version-guard were deleted, because they only assert a narrow subset of fields that happen to survive an unconditional re-run of the migration chain. Predates the #163/#164 diff — background debt, at tests/migrations.test.ts:'is a no-op when already at current version' tests (srsStore, entitlementStore, settingsStore):40.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/migrations.test.ts:'is a no-op when already at current version' tests:40
- [ ] Broaden assertions to a field set that would fail if the version-guard were removed

**Source:** Audit finding F019 — severity 4 — test-quality

---

---

### Task #206: Fix test-quality: only the entitlement store has an explicit gap-free migration-chain guard test.

**File:** tests/migrations.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Only the entitlement store has an explicit gap-free migration-chain guard test; srsStore and settingsStore lack an equivalent test, at tests/migrations.test.ts:n/a — inconsistent coverage across stores:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/migrations.test.ts:n/a — inconsistent coverage across stores:0
- [ ] Add an equivalent "migrating from v0 does not throw" guard test for migrateSrsStore and migrateSettingsStore

**Source:** Audit finding F021 — severity 3 — test-quality

---

---

### Task #211: Fix input-validation: setIdleThresholdMinutes has no range validation unlike sibling bounded setters.

**File:** store/settingsStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
setIdleThresholdMinutes has no range validation, unlike intervalHours/snoozeMinutes in the same store, which use literal-union bounded types, at store/settingsStore.ts:setIdleThresholdMinutes:38.
NEW

**Acceptance Criteria:**
- [ ] Fix input-validation issue at store/settingsStore.ts:setIdleThresholdMinutes:38
- [ ] Consider a bounded type or runtime clamp consistent with sibling setters

**Source:** Audit finding F026 — severity 4 — input-validation

---

---

### Task #212: Fix input-validation: settings migration validates idleThresholdMinutes type only, not range.

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Validates type only, not range, for idleThresholdMinutes. A corrupted persisted value of -50 or 99999 passes through migration unchanged, tracing an unprotected chain end-to-end, at store/migrations.ts:SETTINGS_MIGRATIONS[2]:167.
NEW

**Acceptance Criteria:**
- [ ] Fix input-validation issue at store/migrations.ts:SETTINGS_MIGRATIONS[2]:167
- [ ] Clamp to [5,120] during migration, matching the UI-declared range

**Source:** Audit finding F027 — severity 6 — input-validation

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
Write your completion summary to .autocode/stream-W1C/completion.md (append, do not
overwrite prior wave history in that file):
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W1C | #200 #202 #201 #205 #204 #206 #211 #212
