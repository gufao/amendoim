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
) -> Result<QueryResult, String> {
    let (pool, connection_id) = {
        let manager = state.lock().await;
        let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
        let pool = manager.get_active_pool()?.clone();
        (pool, connection_id)
    };

    // Get total count
    let count_sql = format!("SELECT count(*) as total FROM \"{}\".\"{}\"", schema, table);
    let count_row = sqlx::query(&count_sql)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Count error: {}", e))?;
    let total: i64 = count_row.try_get("total").unwrap_or(0);

    // Get data
    let select_sql = format!("SELECT * FROM \"{}\".\"{}\" LIMIT 1000", schema, table);
    let mut result = executor::execute_query(&pool, &select_sql, None, None, &pids, &connection_id).await?;
    result.total_rows = Some(total);

    Ok(result)
}

#[tauri::command]
pub async fn export_csv(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    sql: String,
) -> Result<String, String> {
    let (pool, connection_id) = {
        let manager = state.lock().await;
        let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
        let pool = manager.get_active_pool()?.clone();
        (pool, connection_id)
    };
    let result = executor::execute_query(&pool, &sql, None, None, &pids, &connection_id).await?;

    if result.columns.is_empty() {
        return Ok(String::new());
    }

    let mut csv = String::new();

    // Header
    let headers: Vec<&str> = result.columns.iter().map(|c| c.name.as_str()).collect();
    csv.push_str(&headers.join(","));
    csv.push('\n');

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
