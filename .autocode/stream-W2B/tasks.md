# Stream W2B Task State

### Task #159 | docs | severity 3
**What:** Add Rule 2 plain English comment headers to 3 Rust source files currently missing them: `src-tauri/src/lib.rs` (main Tauri entry point — registers all plugins, sets up tray, wires IPC handlers), `src-tauri/src/interrupt.rs` (InterruptState struct + 30-second poll thread + 4 IPC commands: update_interrupt_config, snooze_interrupt, enter_mandatory_mode, exit_mandatory_mode), `src-tauri/src/license.rs` (Lemon Squeezy IPC commands: activate_license, deactivate_license, validate_license, open_url). Each header: 2–3 sentences describing what the file owns, its responsibilities, and what depends on it.
**Why:** Rule 2 — every file starts with a plain English explanation. Rust files are not exempt. Batch 14 adds more Rust code; headers must be in place first.
**File:** `src-tauri/src/lib.rs`, `src-tauri/src/interrupt.rs`, `src-tauri/src/license.rs`
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** 🔧 Full — 3 files, comment headers
**Blocked by:** #173, #174 | **Blocks:** #160, #161
**Test required:** No — Rule 2 is structural, not behavioral.
**Done when:** Each of the 3 files starts with a `//` comment block (≥2 sentences). No code changed. `cargo build` still compiles.
**Owner:** Architecture Agent
