mod commands;
mod db;
mod keychain;
mod models;

use db::connection::create_connection_manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(create_connection_manager())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
