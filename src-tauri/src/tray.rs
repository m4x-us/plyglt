// tray.rs — Owns system tray setup for plyglt. Creates the Study Now and Quit menu items,
// registers a left-click handler (show main window) and menu event handlers (show window
// and emit tray:study, or quit), then builds the tray icon with id "main-tray".
// Called once from lib.rs during Tauri app setup; no other module imports this file.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let study_item = MenuItem::with_id(app, "study", "Study Now  (5 cards)", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit plyglt", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&study_item, &sep, &quit_item])?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("plyglt")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            // Temporary diagnostic (Task #166 live Windows VM investigation, 2026-08-12): the
            // tray icon was completely unresponsive on a fresh launch (no hover tooltip, no
            // left/right-click) — this logs every event the OS actually delivers, so a real
            // console build (main.rs's windows_subsystem override is temporarily disabled to
            // make this visible) tells us whether Explorer is sending click events at all.
            eprintln!("[plyglt] tray: icon event received: {:?}", event);
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
        .on_menu_event(|app, event| {
            eprintln!("[plyglt] tray: menu event received: id={:?}", event.id.as_ref());
            match event.id.as_ref() {
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
            }
        })
        .build(app)?;

    eprintln!("[plyglt] tray: setup_tray completed successfully (icon id=main-tray)");
    Ok(())
}
