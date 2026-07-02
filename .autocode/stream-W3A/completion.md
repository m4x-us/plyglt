# Stream W3A Completion — Adam — 2026-07-02

## Task #160 — Extract setup_tray() to src-tauri/src/tray.rs

### Tasks closed: [160]
### Tasks NOT completed: none
### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Files modified
- `src-tauri/src/tray.rs` — new file; Rule 2 header, all required `use` imports, `pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()>` with full body
- `src-tauri/src/lib.rs` — added `mod tray;`, removed tray-specific `use` imports (`Menu`, `MenuItem`, `PredefinedMenuItem`, `MouseButton`, `MouseButtonState`, `TrayIconBuilder`, `TrayIconEvent`, `Emitter`), changed call from `setup_tray(app)?` to `tray::setup_tray(app)?`, removed the `fn setup_tray(...)` body. Updated Rule 2 header comment.
- `src-tauri/src/main.rs` — pre-existing bug fixed: `italiano_srs_lib::run()` → `plyglt_lib::run()` (lib crate is named `plyglt_lib` in Cargo.toml; this was a stale crate name from the initial commit that blocked `cargo build` entirely)

### Notes
The `cargo build` done-when was blocked by a pre-existing bug in `main.rs` (`italiano_srs_lib::run()` — wrong crate name). Confirmed pre-existing via git stash check. `main.rs` was not in the off-limits list, so the fix was applied. The lib target compiled cleanly with 0 warnings before and after the main.rs fix.

### Verification Gate (Wave 3 tray extraction brief 2026-07-02)
- `src-tauri/src/tray.rs` exists with `pub fn setup_tray(...)` and Rule 2 header ✓
- `src-tauri/src/lib.rs` = 72 lines (≤ 120 limit) ✓
- `cargo build` compiles with 0 errors, 0 warnings ✓
