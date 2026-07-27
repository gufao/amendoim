mod commands;
mod db;
mod keychain;
mod mcp;
mod models;

use commands::mcp::create_mcp_state;
use db::connection::create_connection_manager;
use db::executor::create_active_query_pids;
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

/// Window menu item that brings the main window back after it has been hidden.
/// Without it, an app whose only window is hidden is a dead end when the user
/// reaches it via Cmd+Tab instead of the Dock icon.
const SHOW_WINDOW_MENU_ID: &str = "amendoim-show-window";

/// Bring the main window back into view.
///
/// Safe to call from any thread: the underlying window messages are posted to
/// the event loop proxy when off the main thread (`send_user_message`).
pub(crate) fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        // Only surface a window the user cannot currently see. `set_focus` is
        // `activateIgnoringOtherApps:`, so calling it unconditionally would yank
        // focus out of whatever they are typing in on every single MCP query.
        let hidden = !window.is_visible().unwrap_or(true)
            || window.is_minimized().unwrap_or(false);
        if !hidden {
            return;
        }

        // Order matters: tao's `set_focus` is a no-op while the window still reads
        // as miniaturized or not visible, and it is the only call here that brings
        // the *application* forward.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(create_connection_manager())
        .manage(create_active_query_pids())
        .manage(create_mcp_state())
        .setup(|app| {
            // Build About menu with icon and metadata
            let about_metadata = AboutMetadataBuilder::new()
                .name(Some("Amendoim"))
                .version(Some(app.config().version.clone().unwrap_or("0.1.0".into())))
                .copyright(Some("MIT License"))
                .comments(Some("PostgreSQL database viewer for macOS"))
                .build();

            let app_menu = SubmenuBuilder::new(app, "Amendoim")
                .about(Some(about_metadata))
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

            let show_window_item = MenuItemBuilder::new("Amendoim")
                .id(SHOW_WINDOW_MENU_ID)
                .build(app)?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .close_window()
                .separator()
                .fullscreen()
                .separator()
                .item(&show_window_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app_handle, event| {
            if event.id() == SHOW_WINDOW_MENU_ID {
                show_main_window(app_handle);
            }
        })
        .on_window_event(|_window, _event| {
            // macOS convention: the red traffic-light button and Window > Close hide
            // the window and leave the app running in the Dock, instead of killing
            // the process. The window is never destroyed, so React state, open query
            // tabs, the Postgres pools and the MCP listener all survive — and
            // `RunEvent::ExitRequested { code: None }` (the "last window closed"
            // signal that used to terminate the app) never fires.
            //
            // Quitting is unaffected: Cmd+Q and the app menu Quit item both go
            // through AppKit's `terminate:`, which does not route through
            // `CloseRequested`, so `prevent_close` cannot trap the user.
            #[cfg(target_os = "macos")]
            {
                if !matches!(_event, tauri::WindowEvent::CloseRequested { .. })
                    || _window.label() != "main"
                {
                    return;
                }

                if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                    api.prevent_close();

                    // Fullscreen is handled by leaving it, NOT by also hiding.
                    // `hide()` is `order_out_sync`, which runs inline when already
                    // on the main thread, while `set_fullscreen` is
                    // `toggle_full_screen_async`, which always defers to the main
                    // queue. Doing both here would order the window out first and
                    // then toggle fullscreen on an already-hidden window, stranding
                    // the user in an empty Space — the exact thing we want to avoid.
                    // So: first close leaves fullscreen, a second one hides.
                    if _window.is_fullscreen().unwrap_or(false) {
                        let _ = _window.set_fullscreen(false);
                    } else {
                        let _ = _window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Connection commands
            commands::connection::test_connection,
            commands::connection::connect,
            commands::connection::disconnect,
            commands::connection::save_connection,
            commands::connection::delete_connection,
            commands::connection::list_connections,
            commands::connection::get_active_connection,
            commands::connection::is_connected,
            commands::connection::set_active_connection,
            commands::connection::get_connected_ids,
            // Schema commands
            commands::schema::list_schemas,
            commands::schema::list_tables,
            commands::schema::list_columns,
            commands::schema::list_indexes,
            // Query commands
            commands::query::execute_query,
            commands::query::preview_table,
            commands::query::export_csv,
            commands::query::save_text_file,
            commands::query::cancel_query,
            // MCP commands
            commands::mcp::start_mcp_server,
            commands::mcp::stop_mcp_server,
            commands::mcp::get_mcp_status,
            commands::mcp::install_mcp_client,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            // Dock icon clicked (or the app relaunched from Finder) while every
            // window is hidden: bring the main window back.
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Reopen { .. } = _event {
                    show_main_window(_app_handle);
                }
            }
        });
}
