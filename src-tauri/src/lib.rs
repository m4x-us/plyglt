// lib.rs — Tauri application entry point for plyglt. Registers all plugins (store, notification,
// autostart, updater), delegates the native macOS menu bar to app_menu.rs and the tray dropdown
// to tray.rs, and wires all IPC command handlers exposed by interrupt.rs and license.rs into the
// Tauri invoke handler. Also starts os_events.rs listeners (wake, unlock, idle→active) on macOS
// after the main interrupt poll thread.
// Called by the Tauri runtime on startup; no other Rust file imports this module.

#[cfg(target_os = "macos")]
mod app_menu;
mod interrupt;
mod license;
mod os_events;
mod tray;

use std::sync::{Arc, Mutex};
use interrupt::{
    enter_mandatory_mode, exit_mandatory_mode, mark_interrupt_fired, snooze_interrupt,
    update_interrupt_config, InterruptState,
};
use license::{ls_activate_license, ls_deactivate_license, ls_validate_license, open_url};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let interrupt_state = Arc::new(Mutex::new(InterruptState::default()));
    let state_for_thread = Arc::clone(&interrupt_state);
    let state_for_os = Arc::clone(&interrupt_state);

    tauri::Builder::default()
        .manage(interrupt_state)
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Native macOS-only Aqua app menu bar (.services(), .hide_others(), .show_all() have
            // no Windows/Linux equivalent) — was previously called unconditionally on every
            // platform, contradicting this module's own header comment. Live Windows VM
            // investigation (2026-08-12, Task #166) found the tray icon completely unresponsive
            // (no hover tooltip, no left/right-click) on a genuinely fresh launch; gating this
            // to macOS removes one real, verified cross-platform-correctness bug from the
            // Windows binary regardless of whether it turns out to be the tray root cause.
            #[cfg(target_os = "macos")]
            app_menu::setup_app_menu(app)?;
            tray::setup_tray(app)?;
            interrupt::start(app.handle().clone(), state_for_thread);
            os_events::start_os_listeners(app.handle().clone(), state_for_os);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_tray_badge,
            update_interrupt_config,
            snooze_interrupt,
            mark_interrupt_fired,
            enter_mandatory_mode,
            exit_mandatory_mode,
            ls_activate_license,
            ls_validate_license,
            ls_deactivate_license,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle, count: u32) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let tooltip = if count == 0 {
            "plyglt — nothing ready".to_string()
        } else {
            format!("plyglt — {} card{} ready", count, if count == 1 { "" } else { "s" })
        };
        let _ = tray.set_tooltip(Some(tooltip));
        #[cfg(target_os = "macos")]
        {
            let title = if count == 0 {
                None
            } else if count > 99 {
                Some("99+".to_string())
            } else {
                Some(count.to_string())
            };
            let _ = tray.set_title(title.as_deref());
        }
    }
}
