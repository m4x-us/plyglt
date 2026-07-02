# Adam — Stream W3A — Wave 3 — 2026-07-02

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W3A | #160

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #160  — Extract setup_tray() to src-tauri/src/tray.rs

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W3A
[→] #160 — Extract setup_tray() to src-tauri/src/tray.rs   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
src-tauri/src/tray.rs  (new — create this file)
src-tauri/src/lib.rs

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/tauri.ts
lib/tauriInterrupt.ts
components/InterruptHandler.tsx
app/settings/page.tsx
app/study/page.tsx
app/learn/page.tsx

## Task Definitions

### Task #160 | architecture | severity 5
**What:** Extract `setup_tray()` function (currently embedded in `src-tauri/src/lib.rs`, ~40 lines) into a new file `src-tauri/src/tray.rs`. Export `pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()>`. Import and call from `lib.rs`. Add Rule 2 header to `src-tauri/src/tray.rs`. No behavior change.
**Why:** `src-tauri/src/lib.rs` needs headroom for OS hook registration in Task #162 (~40 lines per trigger type). Pre-extract `setup_tray()` now so `lib.rs` stays under 120 lines after Batch 14 additions.
**File:** `src-tauri/src/lib.rs`, `src-tauri/src/tray.rs` (new)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files (1 new), Rust refactor
**Blocked by:** #159 | **Blocks:** #162
**Test required:** No behavior change — `cargo build` compiling is the test.
**Done when:** `src-tauri/src/tray.rs` exists with `pub fn setup_tray(...)` and Rule 2 header. `src-tauri/src/lib.rs` ≤ 120 lines. `cargo build` compiles.
**Owner:** Architecture Agent

## Current State of src-tauri/src/lib.rs

lib.rs is currently 118 lines. The setup_tray() function lives at lines 78–118:

```rust
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let study_item = MenuItem::with_id(app, "study", "Study Now  (5 cards)", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit plyglt", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&study_item, &sep, &quit_item])?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("plyglt")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| { ... })
        .on_menu_event(|app, event| match event.id.as_ref() { ... })
        .build(app)?;

    Ok(())
}
```

It is called at line 36: `setup_tray(app)?;`

It is currently `fn setup_tray` (private). After extraction it becomes `pub fn setup_tray` in tray.rs.

## What To Do

1. Create `src-tauri/src/tray.rs`:
   - Rule 2 header (2–3 sentences: owns tray icon setup, creates Study Now + Quit menu items,
     handles left-click and menu events to show window or emit tray:study)
   - Copy all `use` imports needed by setup_tray (MenuItem, PredefinedMenuItem, Menu,
     TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState) — read lib.rs to get exact paths
   - `pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()>` with full body

2. Edit `src-tauri/src/lib.rs`:
   - Add `mod tray;` near top (after existing `mod` declarations)
   - Add `use tray::setup_tray;` or call as `tray::setup_tray(app)?;`
   - Remove the full `fn setup_tray(...)` body (lines 78–118)
   - Remove `use` imports that are now only needed by tray.rs (if they're no longer
     used in lib.rs itself — check each one)
   - After removal lib.rs should be ≤ 80 lines

3. Run `cargo build` (from src-tauri/ or project root via `cd src-tauri && cargo build`)
   to verify compilation.

## Agent Memories

## Architecture Agent Memory (relevant excerpt)
Stack: Tauri 2 + Next.js + React 19 + Zustand 5 + TypeScript.

Rust layer: src-tauri/src/ contains lib.rs (entry point), interrupt.rs (interrupt engine),
license.rs (LS IPC), main.rs (thin binary crate). Task #159 (Wave 2) added Rule 2 // comment
headers to lib.rs, interrupt.rs, license.rs — comment-only, no code changes.

Rule 2 standard for Rust: `//` line comments at the very top of the file, before any
`use` statements or `mod` declarations. 2–3 sentences.

lib.rs currently registers: tauri-plugin-store, tauri-plugin-notification,
tauri-plugin-autostart, tauri-plugin-updater; wires interrupt and license IPC commands;
calls setup_tray(). After extraction, it calls tray::setup_tray() or imports setup_tray
from the tray module.

## Prior Wave Changes — Read Before Starting

W2B (Barry, Wave 2) modified `src-tauri/src/lib.rs` in Task #159:
  Added a Rule 2 // comment block at the very top (before `use` statements).
  Comment-only — no code changed. The comment occupies lines 1–3 now.

So lib.rs currently starts with:
  // lib.rs — Tauri application entry point for plyglt. Registers all plugins (store, notification,
  // autostart, updater), initialises the system tray with Study Now and Quit items, and wires all
  // IPC command handlers exposed by interrupt.rs and license.rs into the Tauri invoke handler.

Read lib.rs before editing — the exact line numbers for `use` statements and
`fn setup_tray` have shifted by 3 due to the header.

## When You Finish
Write your completion summary to .autocode/stream-W3A/completion.md:
  Tasks closed: [list task numbers]
  Tasks NOT completed: [list + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W3A | #160
