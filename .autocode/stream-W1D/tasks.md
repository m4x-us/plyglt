# Stream W1D Task State

### Task #217: Fix reliability: config-sync effect has no debounce, allowing rapid toggles to race and silently revert.

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The config-sync effect (lines 31-35) has no debounce or request sequencing. Rapid toggle clicks can race — an older in-flight update_interrupt_config call resolving after a newer one could silently revert a toggle in Rust-side state with no user-visible indication, at components/InterruptHandler.tsx:config-sync effect:31.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at components/InterruptHandler.tsx:config-sync effect:31
- [ ] Add a debounce or sequence-number guard so only the latest config write wins

**Source:** Audit finding F032 — severity 5 — reliability

---

---

### Task #222: Fix architecture: InterruptHandler.tsx imports directly from store/, violating the components/ layer rule.

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Imports directly from store/ (settingsStore, srsStore), contradicting CLAUDE.md's layer rule: "components/ — Import from hooks/ and lib/ only." Pre-existing pattern, not introduced by this task, at components/InterruptHandler.tsx:module imports:1.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at components/InterruptHandler.tsx:module imports:1
- [ ] Consider a hook wrapper (e.g. useInterruptConfig) to restore the documented layer boundary

**Source:** Audit finding F037 — severity 4 — architecture

---

---

### Task #223: Fix brand-voice: tray tooltip strings use a forbidden exclamation mark and non-canonical "due" terminology.

**File:** src-tauri/src/lib.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Tray tooltips at lines 59 and 61 violate BRAND.md voice rules: "all caught up!" uses a forbidden exclamation mark, and "due" is used instead of the canonical terminology "ready". Pre-existing code, not touched by the #163/#164 diff, at src-tauri/src/lib.rs:tray tooltip strings:59.
NEW

**Acceptance Criteria:**
- [ ] Fix brand-voice issue at src-tauri/src/lib.rs:tray tooltip strings:59
- [ ] Rewrite tooltip strings to match BRAND.md voice and terminology

**Source:** Audit finding F038 — severity 2 — brand-voice

---

---

### Task #224: Fix architecture: app/learn/page.tsx calls localStorage directly, bypassing the storage abstraction.

**File:** app/learn/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Direct localStorage call at line 127, bypassing the lib/storage.ts platform-storage abstraction required by CLAUDE.md ("Never call localStorage directly from any file outside lib/storage.ts"). Pre-existing/systemic issue, not introduced by this task, at app/learn/page.tsx:n/a:127.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at app/learn/page.tsx:n/a:127
- [ ] Route through lib/storage.ts or a dedicated helper

**Source:** Audit finding F039 — severity 2 — architecture

---

---

