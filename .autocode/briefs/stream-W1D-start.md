# Derek — Stream W1D — Wave 1 — 2026-07-04

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W1D | #217 #222 #223 #224

You are Derek, a CTO working on a specific set of Batch 19 remediation tasks in parallel
with 3 other windows (this wave has 4 streams). These tasks all came from the /audit #164
verdict (FAIL, severity 9): Task #163's OS trigger settings feature (wake/unlock/idle toggles
+ idle threshold) is entirely non-functional because src-tauri/src/os_events.rs — the only
Rust code that fires wake/unlock/idle interrupts — never reads the config fields Task #163
built the whole UI/store/IPC chain to expose. Work exclusively on the files listed under
"Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #217
2. /task #222
3. /task #223
4. /task #224

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W1D
[ ] #217
[ ] #222
[ ] #223
[ ] #224

Update to [✓] as each completes. This lets Max glance at any window and know exactly
where you are.

## Files You Own (edit ONLY these)
components/InterruptHandler.tsx
src-tauri/src/lib.rs
app/learn/page.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/settings/page.test.tsx
app/settings/page.tsx
app/study/page.tsx
components/InterruptHandler.test.tsx
lib/tauriInterrupt.ts
src-tauri/src/interrupt.rs
src-tauri/src/os_events.rs
store/migrations.ts
store/settingsStore.ts
tests/migrations.test.ts
tests/settingsStore.test.ts
tests/tauri.test.ts

## Task Definitions

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
Write your completion summary to .autocode/stream-W1D/completion.md (append, do not
overwrite prior wave history in that file):
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W1D | #217 #222 #223 #224
