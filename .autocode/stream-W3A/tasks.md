# Stream W3A Task State

### Task #160 | architecture | severity 5
**What:** Extract `setup_tray()` function (currently embedded in `src-tauri/src/lib.rs`, ~40 lines) into a new file `src-tauri/src/tray.rs`. Export `pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>>`. Import and call from `lib.rs`. Add Rule 2 header to `src-tauri/src/tray.rs`. No behavior change.
**Why:** `src-tauri/src/lib.rs` needs headroom for OS hook registration in Task #162 (~40 lines per trigger type). Pre-extract `setup_tray()` now so `lib.rs` stays under 150 lines after Batch 14 additions.
**File:** `src-tauri/src/lib.rs`, `src-tauri/src/tray.rs` (new)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files (1 new), Rust refactor
**Blocked by:** #159 | **Blocks:** #162
**Test required:** No behavior change — `cargo build` compiling is the test.
**Done when:** `src-tauri/src/tray.rs` exists with `pub fn setup_tray(...)` and Rule 2 header. `src-tauri/src/lib.rs` ≤ 120 lines (makes room for Task #162 additions). `cargo build` compiles. App launches normally.
**Owner:** Architecture Agent
