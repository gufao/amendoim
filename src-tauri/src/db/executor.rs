use sqlx::{Column, PgPool, Row, TypeInfo};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

use crate::models::result::{ColumnMeta, QueryResult};

/// Maps connection_id -> PostgreSQL backend PID for active queries
pub type ActiveQueryPids = Arc<Mutex<HashMap<String, i32>>>;

pub fn create_active_query_pids() -> ActiveQueryPids {
    Arc::new(Mutex::new(HashMap::new()))
}

pub async fn execute_query(
    pool: &PgPool,
    sql: &str,
    limit: Option<i64>,
    offset: Option<i64>,
    active_pids: &ActiveQueryPids,
    connection_id: &str,
) -> Result<QueryResult, String> {
    let start = Instant::now();

    // Acquire a dedicated connection so that the PID we track matches the
    // connection that actually executes the query (pool.fetch_one and
    // pool.fetch_all could hand out different connections).
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| format!("Failed to acquire connection: {}", e))?;

    // Get and store the backend PID for cancellation support
    let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
        .fetch_one(&mut *conn)
        .await
        .map_err(|e| format!("Failed to get backend PID: {}", e))?;

    active_pids.lock().await.insert(connection_id.to_string(), pid);

    let result = execute_query_inner(&mut *conn, sql, limit, offset, start).await;

    // Always clean up PID, even on error
    active_pids.lock().await.remove(connection_id);

    result
}

async fn execute_query_inner(
    conn: &mut sqlx::PgConnection,
    sql: &str,
    limit: Option<i64>,
    offset: Option<i64>,
    start: Instant,
) -> Result<QueryResult, String> {
    // For SELECT queries, wrap with limit/offset if not already present
    let sql_upper = sql.trim().to_uppercase();
    let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH");

    let final_sql = if is_select && limit.is_some() {
        let has_limit = sql_upper.contains(" LIMIT ");
        if has_limit {
            sql.to_string()
        } else {
            let mut q = sql.trim_end_matches(';').to_string();
            if let Some(l) = limit {
                q = format!("{} LIMIT {}", q, l);
            }
            if let Some(o) = offset {
                q = format!("{} OFFSET {}", q, o);
            }
            q
        }
    } else {
        sql.to_string()
    };

    if is_select {
        let rows = sqlx::query(&final_sql)
            .fetch_all(&mut *conn)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        let execution_time_ms = start.elapsed().as_millis();

        let columns: Vec<ColumnMeta> = if let Some(first_row) = rows.first() {
            first_row
                .columns()
                .iter()
                .map(|col| ColumnMeta {
                    name: col.name().to_string(),
                    data_type: col.type_info().name().to_string(),
                })
                .collect()
        } else {
            Vec::new()
        };

        let mut result_rows: Vec<HashMap<String, serde_json::Value>> = Vec::new();
        for row in &rows {
            let mut map = HashMap::new();
            for col in row.columns() {
                let name = col.name().to_string();
                let value = pg_value_to_json(row, col.ordinal(), col.type_info().name());
                map.insert(name, value);
            }
            result_rows.push(map);
        }

        let row_count = result_rows.len();

        Ok(QueryResult {
            columns,
            rows: result_rows,
            row_count,
            total_rows: None,
            execution_time_ms,
            affected_rows: None,
        })
    } else {
        // Split multiple statements by semicolons so each can be executed
        // individually (prepared statements only support one command at a time).
        let statements: Vec<&str> = final_sql
            .split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        let mut total_affected = 0u64;
        for stmt in &statements {
            let result = sqlx::query(stmt)
                .execute(&mut *conn)
                .await
                .map_err(|e| format!("Query error: {}", e))?;
            total_affected += result.rows_affected();
        }

        let execution_time_ms = start.elapsed().as_millis();

        Ok(QueryResult {
            columns: Vec::new(),
            rows: Vec::new(),
            row_count: 0,
            total_rows: None,
            execution_time_ms,
            affected_rows: Some(total_affected),
        })
    }
}

pub async fn cancel_query(
    pool: &PgPool,
    active_pids: &ActiveQueryPids,
    connection_id: &str,
) -> Result<(), String> {
    let pid = {
        let pids = active_pids.lock().await;
        pids.get(connection_id).copied()
    };

    let pid = pid.ok_or("No active query to cancel")?;

    sqlx::query("SELECT pg_cancel_backend($1)")
        .bind(pid)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to cancel query: {}", e))?;

    Ok(())
}

fn pg_value_to_json(row: &sqlx::postgres::PgRow, ordinal: usize, type_name: &str) -> serde_json::Value {
    match type_name {
        "BOOL" => row
            .try_get::<bool, _>(ordinal)
            .ok()
            .map(serde_json::Value::Bool)
            .unwrap_or(serde_json::Value::Null),
        "INT2" => row
            .try_get::<i16, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        "INT4" => row
            .try_get::<i32, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        "INT8" => row
            .try_get::<i64, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        "FLOAT4" => row
            .try_get::<f32, _>(ordinal)
            .ok()
            .and_then(|v| serde_json::Number::from_f64(v as f64))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        "FLOAT8" => row
            .try_get::<f64, _>(ordinal)
            .ok()
            .and_then(|v| serde_json::Number::from_f64(v))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        "JSON" | "JSONB" => row
            .try_get::<serde_json::Value, _>(ordinal)
            .unwrap_or(serde_json::Value::Null),
        "UUID" => row
            .try_get::<uuid::Uuid, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        "TIMESTAMPTZ" => row
            .try_get::<chrono::DateTime<chrono::Utc>, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::String(v.to_rfc3339()))
            .unwrap_or(serde_json::Value::Null),
        "TIMESTAMP" => row
            .try_get::<chrono::NaiveDateTime, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string()))
            .unwrap_or(serde_json::Value::Null),
        "DATE" => row
            .try_get::<chrono::NaiveDate, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        "TIME" | "TIMETZ" => row
            .try_get::<chrono::NaiveTime, _>(ordinal)
            .ok()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        _ => row
            .try_get::<String, _>(ordinal)
            .ok()
            .map(serde_json::Value::String)
            .unwrap_or(serde_json::Value::Null),
    }
}
