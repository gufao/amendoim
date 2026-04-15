use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::db::connection::SharedConnectionManager;
use crate::keychain;
use crate::models::connection::{ConnectionConfig, SavedConnections};

fn get_connections_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
    Ok(data_dir.join("connections.json"))
}

fn load_connections_from_disk(app: &AppHandle) -> Result<SavedConnections, String> {
    let path = get_connections_path(app)?;
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| format!("Failed to read connections: {}", e))?;
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse connections: {}", e))
    } else {
        Ok(SavedConnections::default())
    }
}

fn save_connections_to_disk(app: &AppHandle, connections: &SavedConnections) -> Result<(), String> {
    let path = get_connections_path(app)?;
    let data = serde_json::to_string_pretty(connections)
        .map_err(|e| format!("Failed to serialize connections: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write connections: {}", e))
}

/// Strips password before saving to disk
fn config_without_password(config: &ConnectionConfig) -> ConnectionConfig {
    ConnectionConfig {
        id: config.id.clone(),
        name: config.name.clone(),
        host: config.host.clone(),
        port: config.port,
        user: config.user.clone(),
        password: String::new(),
        database: config.database.clone(),
    }
}

/// Hydrates a config by fetching the password from Keychain
fn config_with_password(config: &ConnectionConfig) -> ConnectionConfig {
    let password = keychain::get_password(&config.id).unwrap_or_default();
    ConnectionConfig {
        password,
        ..config.clone()
    }
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<(), String> {
    crate::db::connection::ConnectionManager::test_connection(&config).await
}

#[tauri::command]
pub async fn connect(
    app: AppHandle,
    state: State<'_, SharedConnectionManager>,
    id: String,
) -> Result<(), String> {
    let connections = load_connections_from_disk(&app)?;
    let config = connections
        .connections
        .iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;

    let full_config = config_with_password(config);
    let mut manager = state.lock().await;
    manager.connect(&full_config).await
}

#[tauri::command]
pub async fn disconnect(
    state: State<'_, SharedConnectionManager>,
    id: String,
) -> Result<(), String> {
    let mut manager = state.lock().await;
    manager.disconnect(&id).await
}

#[tauri::command]
pub async fn save_connection(
    app: AppHandle,
    config: ConnectionConfig,
) -> Result<ConnectionConfig, String> {
    // Store password in Keychain
    keychain::store_password(&config.id, &config.password)?;

    // Save config WITHOUT password to disk
    let safe_config = config_without_password(&config);
    let mut connections = load_connections_from_disk(&app)?;

    if let Some(existing) = connections.connections.iter_mut().find(|c| c.id == config.id) {
        *existing = safe_config;
    } else {
        connections.connections.push(safe_config);
    }

    save_connections_to_disk(&app, &connections)?;

    // Return full config (with password) to frontend for immediate use
    Ok(config)
}

#[tauri::command]
pub async fn delete_connection(
    app: AppHandle,
    state: State<'_, SharedConnectionManager>,
    id: String,
) -> Result<(), String> {
    let mut manager = state.lock().await;
    let _ = manager.disconnect(&id).await;
    drop(manager);

    // Remove password from Keychain
    let _ = keychain::delete_password(&id);

    let mut connections = load_connections_from_disk(&app)?;
    connections.connections.retain(|c| c.id != id);
    save_connections_to_disk(&app, &connections)
}

#[tauri::command]
pub async fn list_connections(app: AppHandle) -> Result<Vec<ConnectionConfig>, String> {
    let connections = load_connections_from_disk(&app)?;
    // Return configs with passwords hydrated from Keychain
    Ok(connections
        .connections
        .iter()
        .map(config_with_password)
        .collect())
}

#[tauri::command]
pub async fn get_active_connection(
    state: State<'_, SharedConnectionManager>,
) -> Result<Option<String>, String> {
    let manager = state.lock().await;
    Ok(manager.active_id().map(|s| s.to_string()))
}

#[tauri::command]
pub async fn set_active_connection(
    state: State<'_, SharedConnectionManager>,
    id: String,
) -> Result<(), String> {
    let mut manager = state.lock().await;
    manager.set_active(&id)
}

#[tauri::command]
pub async fn is_connected(
    state: State<'_, SharedConnectionManager>,
    id: String,
) -> Result<bool, String> {
    let manager = state.lock().await;
    Ok(manager.is_connected(&id))
}

#[tauri::command]
pub async fn get_connected_ids(
    state: State<'_, SharedConnectionManager>,
) -> Result<Vec<String>, String> {
    let manager = state.lock().await;
    Ok(manager.connected_ids())
}
