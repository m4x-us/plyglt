# Stream W1C Task State

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

---

