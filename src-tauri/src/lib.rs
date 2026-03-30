mod commands;
mod db;
mod keychain;
mod mcp;
mod models;

use commands::mcp::create_mcp_state;
use db::connection::create_connection_manager;
use db::executor::create_active_query_pids;
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .close_window()
                .separator()
                .fullscreen()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
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
            // Schema commands
            commands::schema::list_schemas,
            commands::schema::list_tables,
            commands::schema::list_columns,
            commands::schema::list_indexes,
            // Query commands
            commands::query::execute_query,
            commands::query::preview_table,
            commands::query::export_csv,
            commands::query::cancel_query,
            // MCP commands
            commands::mcp::start_mcp_server,
            commands::mcp::stop_mcp_server,
            commands::mcp::get_mcp_status,
            commands::mcp::install_mcp_client,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
