# Stream W2A Task State

### Task #191: Fix process: unresolved TODO proves the team knew the wake/unlock/idle wiring was incomplete when Task #163 was marked COMPLETE.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** OPEN

**What:**
A self-authored, unresolved TODO reads: "TODO #163: replace IDLE_THRESHOLD_SECS with st.idle_threshold_secs once the configurable field is added to InterruptState. The state lock block already reads the guard fields; just add idle_threshold_secs to that destructure." Its stated precondition has since been satisfied but the follow-up was never done. Remove the TODO once #187-#190 close it out, at src-tauri/src/os_events.rs:start_os_listeners (TODO comment):29.
NEW

**Acceptance Criteria:**
- [ ] Fix process issue at src-tauri/src/os_events.rs:start_os_listeners (TODO comment):29
- [ ] Remove the stale TODO comment once the wiring lands

**Source:** Audit finding F005 — severity 7 — process

---

---

### Task #198: Fix documentation: os_events.rs file header documents current behavior as complete rather than disclosing the unread/hardcoded fields.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P3
**Status:** OPEN

**What:**
File header (lines 4-6) documents current listener behavior as normal/complete rather than disclosing that 3 of 4 new settings fields are currently unread and one is hardcoded-overridden, at src-tauri/src/os_events.rs:file header:4.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at src-tauri/src/os_events.rs:file header:4

**Source:** Audit finding F012 — severity 4 — documentation

---

---

### Task #193: Fix documentation-trust: store/migrations.ts comment claims a functioning OS-trigger opt-out that does not exist at runtime.

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P1
**Status:** OPEN

**What:**
Comment at lines 158-159 claims a functioning opt-out for OS triggers that does not exist at runtime (per F001-F004), at store/migrations.ts:comment above SETTINGS_MIGRATIONS entry:158.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/migrations.ts:comment above SETTINGS_MIGRATIONS entry:158
- [ ] Update the comment once #187-#190 make the opt-out real, or soften the claim until then

**Source:** Audit finding F007 — severity 9 — documentation-trust

---

---

### Task #196: Fix documentation-trust: InterruptHandler.tsx comment "Keep the Rust thread in sync" is false for the 4 new fields.

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** OPEN

**What:**
Comment 'Keep the Rust thread in sync' is false with respect to the 4 new fields — nothing keeps os_events.rs in sync with them (F001-F004), at components/InterruptHandler.tsx:config-sync effect comment:30.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at components/InterruptHandler.tsx:config-sync effect comment:30
- [ ] Update comment once #187-#190 land

**Source:** Audit finding F010 — severity 7 — documentation-trust

---

---

### Task #194: Fix documentation-trust: Wake/Unlock/Idle toggle descriptions claim independent control that runtime code never honors.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P1
**Status:** OPEN

**What:**
The Wake/Unlock/Idle toggle descriptions (lines 104-111) claim these triggers can be independently disabled; runtime code never honors any of the three (F001-F003). Conflicts with BRAND.md's stress-free/trust principle, at app/settings/page.tsx:OS Triggers section JSX:104.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at app/settings/page.tsx:OS Triggers section JSX:104
- [ ] Verify UI copy matches real behavior once #187-#190 land

**Source:** Audit finding F008 — severity 9 — documentation-trust

---

---

### Task #192: Fix test-quality: zero Rust #[test] blocks exist anywhere in src-tauri/src/*.rs.

**File:** src-tauri/src/
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** OPEN

**What:**
Zero Rust #[test] blocks exist anywhere in src-tauri/src/*.rs. The exact layer containing the critical defect (F001-F004) has no test harness at all, so Task #164's added tests — which all stop at the JS/IPC-call boundary — had no way to catch it, at src-tauri/src/:n/a — entire crate:0.
NEW

**Acceptance Criteria:**
- [ ] Add a #[cfg(test)] module to os_events.rs and/or interrupt.rs covering the wake/unlock/idle gating logic
- [ ] Audit passes: bash scripts/deep-audit.sh src-tauri/src/os_events.rs

**Source:** Audit finding F006 — severity 7 — test-quality

---

---

### Task #215: Fix code-quality: "15 minutes" idle default hardcoded independently in four places with no shared constant.

**File:** src-tauri/src/os_events.rs, src-tauri/src/interrupt.rs, store/settingsStore.ts, store/migrations.ts
**Complexity:** 🔧 Full — 4 files, cross-cutting constant extraction
**Owner:** Architecture Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** OPEN

**What:**
The '15 minutes' idle default is hardcoded independently in four places (os_events.rs:31, interrupt.rs:52, settingsStore.ts:54, migrations.ts:167) with no shared constant. One copy is already permanently out of sync since it is the unread hardcoded override (F004), at idle-default constants:31.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at idle-default constants:31
- [ ] Extract a single shared default-minutes constant consumed by all four sites (via a shared TS/Rust boundary or documented single source of truth)

**Source:** Audit finding F030 — severity 6 — code-quality

---

---

### Task #216: Fix architecture: 7-positional-parameter interrupt-config contract duplicated identically across 5 files with no shared schema.

**File:** app/settings/page.tsx, lib/tauriInterrupt.ts, components/InterruptHandler.tsx, store/settingsStore.ts, src-tauri/src/interrupt.rs
**Complexity:** 🔧 Full — 5 files, contract redesign
**Owner:** Architecture Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** OPEN

**What:**
The 7-positional-parameter interrupt-config contract is duplicated identically across 5 files with no shared type/schema forcing sync. This exact coupling is the structural root cause that let os_events.rs silently fall out of sync with the other 4 files' understanding of the config shape (F001-F004), at update_interrupt_config parameter contract.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at update_interrupt_config parameter contract
- [ ] Consider a shared config object/struct (TS interface + matching Rust struct) instead of positional params, so adding a field forces every consumer to acknowledge it

**Source:** Audit finding F031 — severity 6 — architecture

---

---

