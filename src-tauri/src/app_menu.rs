// app_menu.rs — Builds plyglt's native macOS menu bar (the menu at the top of the screen —
// distinct from tray.rs's tray dropdown menu). Standard App/Edit/Window submenus plus a
// "Settings…" item (Cmd+,) that emits menu:settings so the frontend can navigate there.
// Called once from lib.rs during Tauri app setup; no other module imports this file.

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager,
};

pub fn setup_app_menu(app: &mut tauri::App) -> tauri::Result<()> {
    let settings_item = MenuItemBuilder::with_id("open-settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_menu = SubmenuBuilder::new(app, "plyglt")
        .about(None)
        .separator()
        .item(&settings_item)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&window_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        if event.id.as_ref() == "open-settings" {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("menu:settings", ());
            }
        }
    });

    Ok(())
}
