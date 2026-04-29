use sqlx::Row;
use tauri::State;

use crate::db::connection::SharedConnectionManager;
use crate::db::executor;
use crate::db::executor::ActiveQueryPids;
use crate::models::result::QueryResult;

#[tauri::command]
pub async fn execute_query(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    sql: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<QueryResult, String> {
    let (pool, connection_id) = {
        let manager = state.lock().await;
        let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
        let pool = manager.get_active_pool()?.clone();
        (pool, connection_id)
    };
    executor::execute_query(&pool, &sql, limit, offset, &pids, &connection_id).await
}

#[tauri::command]
pub async fn preview_table(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    schema: String,
    table: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<QueryResult, String> {
    let (pool, connection_id) = {
        let manager = state.lock().await;
        let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
        let pool = manager.get_active_pool()?.clone();
        (pool, connection_id)
    };

    // Estimate total via pg_class.reltuples (instant, no full scan).
    // Falls back to None if the table was never analyzed (reltuples < 0).
    let estimate_sql = "SELECT c.reltuples::bigint AS total \
                        FROM pg_class c \
                        JOIN pg_namespace n ON n.oid = c.relnamespace \
                        WHERE n.nspname = $1 AND c.relname = $2";
    let estimate: Option<i64> = sqlx::query(estimate_sql)
        .bind(&schema)
        .bind(&table)
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("Estimate error: {}", e))?
        .and_then(|row| row.try_get::<i64, _>("total").ok())
        .filter(|n| *n >= 0);

    let select_sql = format!("SELECT * FROM \"{}\".\"{}\"", schema, table);
    let effective_limit = limit.or(Some(100));
    let mut result = executor::execute_query(&pool, &select_sql, effective_limit, offset, &pids, &connection_id).await?;
    result.total_rows = estimate;
    result.total_rows_estimated = estimate.is_some();

    Ok(result)
}

#[tauri::command]
pub async fn export_csv(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    sql: String,
    limit: Option<i64>,
    offset: Option<i64>,
    include_header: Option<bool>,
) -> Result<String, String> {
    let (pool, connection_id) = {
        let manager = state.lock().await;
        let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
        let pool = manager.get_active_pool()?.clone();
        (pool, connection_id)
    };
    let result = executor::execute_query(&pool, &sql, limit, offset, &pids, &connection_id).await?;

    if result.columns.is_empty() {
        return Ok(String::new());
    }

    let mut csv = String::new();
    let headers: Vec<&str> = result.columns.iter().map(|c| c.name.as_str()).collect();

    if include_header.unwrap_or(true) {
        csv.push_str(&headers.join(","));
        csv.push('\n');
    }

    // Rows
    for row in &result.rows {
        let values: Vec<String> = headers
            .iter()
            .map(|h| {
                match row.get(*h) {
                    Some(serde_json::Value::String(s)) => {
                        // Escape quotes in CSV
                        format!("\"{}\"", s.replace('"', "\"\""))
                    }
                    Some(serde_json::Value::Null) => String::new(),
                    Some(v) => v.to_string(),
                    None => String::new(),
                }
            })
            .collect();
        csv.push_str(&values.join(","));
        csv.push('\n');
    }

    Ok(csv)
}

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
) -> Result<(), String> {
    let (pool, connection_id) = {
        let manager = state.lock().await;
        let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
        let pool = manager.get_active_pool()?.clone();
        (pool, connection_id)
    };
    executor::cancel_query(&pool, &pids, &connection_id).await
}
