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
mod push;
// tray-icon and native menu APIs (tauri::tray, tauri::menu) are desktop-only — the mobile
// build of the tauri crate doesn't expose them at all (confirmed via a real `tauri ios dev`
// compile: `tauri::menu`/`tauri::tray` unresolved-import errors, Task #522). `desktop` is a
// cfg alias Tauri's own build script provides (already relied on above via `mobile` in
// `#[cfg_attr(mobile, tauri::mobile_entry_point)]`).
#[cfg(desktop)]
mod tray;

use std::sync::{Arc, Mutex};
use interrupt::{
    enter_mandatory_mode, exit_mandatory_mode, mark_interrupt_fired, snooze_interrupt,
    update_interrupt_config, InterruptState,
};
use license::{ls_activate_license, ls_deactivate_license, ls_validate_license, open_url};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Must run before anything constructs an HTTP client (tauri_plugin_updater does this eagerly
    // during .plugin() registration below). Without an explicit crypto provider installed, the
    // first reqwest client construction panics with "No rustls crypto provider is configured" —
    // a real, verified crash-on-launch found live on iOS (Task #522, 2026-08-13): two reqwest
    // major versions exist in the dependency graph (this crate's 0.12, tauri-plugin-updater's
    // transitive 0.13), and neither one wins a default installation on its own. install_default()
    // returning Err just means a provider is already installed (fine, not an error to surface).
    let _ = rustls::crypto::ring::default_provider().install_default();

    let interrupt_state = Arc::new(Mutex::new(InterruptState::default()));
    let state_for_thread = Arc::clone(&interrupt_state);
    let state_for_os = Arc::clone(&interrupt_state);

    // tauri_plugin_autostart has no mobile equivalent — iOS/Android apps cannot register as a
    // login item, and the plugin's own `init()` doesn't compile against the mobile tauri crate
    // (confirmed via a real `tauri ios dev` build, Task #522). Built as a mutable builder rather
    // than one fluent chain so this one plugin registration can be conditionally skipped without
    // restructuring every other `.plugin(...)` call.
    // `mut` is only needed on desktop, where the block below reassigns `builder` — mobile skips
    // that block, so mobile compiles report a false-positive unused_mut without this allow.
    #[cfg_attr(not(desktop), allow(unused_mut))]
    let mut builder = tauri::Builder::default()
        .manage(interrupt_state)
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
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
            #[cfg(desktop)]
            tray::setup_tray(app)?;
            interrupt::start(app.handle().clone(), state_for_thread);
            os_events::start_os_listeners(app.handle().clone(), state_for_os);
            // APNs tap-handling proxy must be installed during launch, before any
            // notification-response delivery — not lazily from a JS-invoked command
            // (a cold-start tap would be lost). See push.rs's module header.
            #[cfg(target_os = "ios")]
            push::install(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            push::register_for_push_notifications,
            push::get_push_token,
            push::take_pending_push_tap,
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

// Single definition kept (rather than two cfg-gated function bodies) so the invoke_handler
// registration below never needs its own cfg conditional — `AppHandle::tray_by_id` doesn't
// exist at all on the mobile tauri crate (Task #522), so mobile gets a no-op body instead.
#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle, count: u32) {
    #[cfg(desktop)]
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
    #[cfg(not(desktop))]
    let _ = (app, count);
}
