// lib.rs — Tauri application entry point for plyglt. Registers all plugins (store, notification,
// autostart, updater), initialises the system tray with Study Now and Quit items, and wires all
// IPC command handlers exposed by interrupt.rs and license.rs into the Tauri invoke handler.
// Called by the Tauri runtime on startup; no other Rust file imports this module.

mod interrupt;
mod license;

use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use interrupt::{
    enter_mandatory_mode, exit_mandatory_mode, snooze_interrupt, update_interrupt_config,
    InterruptState,
};
use license::{ls_activate_license, ls_deactivate_license, ls_validate_license, open_url};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let interrupt_state = Arc::new(Mutex::new(InterruptState::default()));
    let state_for_thread = Arc::clone(&interrupt_state);

    tauri::Builder::default()
        .manage(interrupt_state)
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            setup_tray(app)?;
            interrupt::start(app.handle().clone(), state_for_thread);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_tray_badge,
            update_interrupt_config,
            snooze_interrupt,
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
            "plyglt — all caught up!".to_string()
        } else {
            format!("plyglt — {} card{} due", count, if count == 1 { "" } else { "s" })
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

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let study_item = MenuItem::with_id(app, "study", "Study Now  (5 cards)", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit plyglt", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&study_item, &sep, &quit_item])?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("plyglt")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "study" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("tray:study", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
