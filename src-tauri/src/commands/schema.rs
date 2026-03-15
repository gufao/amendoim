use tauri::State;

use crate::db::connection::SharedConnectionManager;
use crate::db::queries;
use crate::models::result::{ColumnInfo, IndexInfo, SchemaInfo, TableInfo};

#[tauri::command]
pub async fn list_schemas(
    state: State<'_, SharedConnectionManager>,
) -> Result<Vec<SchemaInfo>, String> {
    let manager = state.lock().await;
    let pool = manager.get_active_pool()?;
    queries::list_schemas(pool).await
}

#[tauri::command]
pub async fn list_tables(
    state: State<'_, SharedConnectionManager>,
    schema: String,
) -> Result<Vec<TableInfo>, String> {
    let manager = state.lock().await;
    let pool = manager.get_active_pool()?;
    queries::list_tables(pool, &schema).await
}

#[tauri::command]
pub async fn list_columns(
    state: State<'_, SharedConnectionManager>,
    schema: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let manager = state.lock().await;
    let pool = manager.get_active_pool()?;
    queries::list_columns(pool, &schema, &table).await
}

#[tauri::command]
pub async fn list_indexes(
    state: State<'_, SharedConnectionManager>,
    schema: String,
    table: String,
) -> Result<Vec<IndexInfo>, String> {
    let manager = state.lock().await;
    let pool = manager.get_active_pool()?;
    queries::list_indexes(pool, &schema, &table).await
}
