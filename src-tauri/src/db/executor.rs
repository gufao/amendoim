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
            total_rows_estimated: false,
            execution_time_ms,
            affected_rows: None,
        })
    } else {
        // Split multiple statements by semicolons so each can be executed
        // individually (prepared statements only support one command at a time).
        // The splitter respects string literals, dollar quoting, and comments
        // so that semicolons inside JSON values or text don't cut a statement.
        let statements = split_sql_statements(&final_sql);

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
            total_rows_estimated: false,
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

/// Split a SQL string into individual statements at top-level semicolons,
/// respecting single-quoted strings (with `''` escape), double-quoted
/// identifiers, dollar-quoting (`$$...$$` or `$tag$...$tag$`), line comments
/// (`-- ...\n`), and block comments (`/* ... */`, nested allowed).
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements: Vec<String> = Vec::new();
    let mut current = String::new();
    let bytes = sql.as_bytes();
    let n = bytes.len();
    let mut i = 0;
    let mut in_single = false;
    let mut in_double = false;
    let mut in_line_comment = false;
    let mut block_depth: u32 = 0;
    let mut dollar_tag: Option<String> = None;
    while i < n {
        if let Some(tag) = &dollar_tag {
            if sql[i..].starts_with(tag.as_str()) {
                current.push_str(tag);
                i += tag.len();
                dollar_tag = None;
                continue;
            }
            let ch = sql[i..].chars().next().unwrap();
            current.push(ch);
            i += ch.len_utf8();
            continue;
        }
        let c = bytes[i];
        if in_line_comment {
            let ch = sql[i..].chars().next().unwrap();
            current.push(ch);
            i += ch.len_utf8();
            if ch == '\n' {
                in_line_comment = false;
            }
            continue;
        }
        if block_depth > 0 {
            if c == b'/' && i + 1 < n && bytes[i + 1] == b'*' {
                block_depth += 1;
                current.push_str("/*");
                i += 2;
                continue;
            }
            if c == b'*' && i + 1 < n && bytes[i + 1] == b'/' {
                block_depth -= 1;
                current.push_str("*/");
                i += 2;
                continue;
            }
            let ch = sql[i..].chars().next().unwrap();
            current.push(ch);
            i += ch.len_utf8();
            continue;
        }
        if in_single {
            if c == b'\'' {
                if i + 1 < n && bytes[i + 1] == b'\'' {
                    current.push_str("''");
                    i += 2;
                    continue;
                }
                current.push('\'');
                i += 1;
                in_single = false;
                continue;
            }
            let ch = sql[i..].chars().next().unwrap();
            current.push(ch);
            i += ch.len_utf8();
            continue;
        }
        if in_double {
            if c == b'"' {
                if i + 1 < n && bytes[i + 1] == b'"' {
                    current.push_str("\"\"");
                    i += 2;
                    continue;
                }
                current.push('"');
                i += 1;
                in_double = false;
                continue;
            }
            let ch = sql[i..].chars().next().unwrap();
            current.push(ch);
            i += ch.len_utf8();
            continue;
        }
        match c {
            b'\'' => {
                in_single = true;
                current.push('\'');
                i += 1;
            }
            b'"' => {
                in_double = true;
                current.push('"');
                i += 1;
            }
            b'-' if i + 1 < n && bytes[i + 1] == b'-' => {
                in_line_comment = true;
                current.push_str("--");
                i += 2;
            }
            b'/' if i + 1 < n && bytes[i + 1] == b'*' => {
                block_depth = 1;
                current.push_str("/*");
                i += 2;
            }
            b'$' => {
                // Try to parse $tag$ where tag follows PG identifier rules
                // (letter/underscore/non-ASCII first, then alnum/underscore/non-ASCII).
                let mut j = i + 1;
                let mut is_first = true;
                let mut valid = true;
                while j < n {
                    let b = bytes[j];
                    if b == b'$' {
                        break;
                    }
                    let is_alpha = b.is_ascii_alphabetic() || b == b'_' || b >= 0x80;
                    let is_digit = b.is_ascii_digit();
                    if is_first {
                        if !is_alpha {
                            valid = false;
                            break;
                        }
                        is_first = false;
                    } else if !(is_alpha || is_digit) {
                        valid = false;
                        break;
                    }
                    j += 1;
                }
                if valid && j < n && bytes[j] == b'$' {
                    let tag = sql[i..=j].to_string();
                    current.push_str(&tag);
                    i = j + 1;
                    dollar_tag = Some(tag);
                } else {
                    current.push('$');
                    i += 1;
                }
            }
            b';' => {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    statements.push(trimmed.to_string());
                }
                current.clear();
                i += 1;
            }
            _ => {
                let ch = sql[i..].chars().next().unwrap();
                current.push(ch);
                i += ch.len_utf8();
            }
        }
    }
    let trimmed = current.trim();
    if !trimmed.is_empty() {
        statements.push(trimmed.to_string());
    }
    statements
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

#[cfg(test)]
mod tests {
    use super::split_sql_statements;

    #[test]
    fn splits_simple_statements() {
        let r = split_sql_statements("SELECT 1; SELECT 2;");
        assert_eq!(r, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn ignores_semicolons_in_single_quoted_string() {
        let sql = "SELECT '{\"mime_type\":\"audio/ogg; codecs=opus\"}'::jsonb;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 1);
        assert!(r[0].contains("audio/ogg; codecs=opus"));
    }

    #[test]
    fn ignores_semicolons_in_dollar_quoted_string() {
        let sql = "DO $$ BEGIN PERFORM 'a;b'; END $$; SELECT 1;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 2);
        assert!(r[0].starts_with("DO $$"));
    }

    #[test]
    fn ignores_semicolons_in_tagged_dollar_quote() {
        let sql = "SELECT $tag$one;two;three$tag$; SELECT 1;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 2);
        assert!(r[0].contains("one;two;three"));
    }

    #[test]
    fn handles_doubled_single_quote_escape() {
        let sql = "SELECT 'it''s; here'; SELECT 1;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 2);
        assert!(r[0].contains("it''s; here"));
    }

    #[test]
    fn ignores_semicolons_in_line_comment() {
        let sql = "SELECT 1 -- comment; with semi\n; SELECT 2;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 2);
    }

    #[test]
    fn ignores_semicolons_in_block_comment() {
        let sql = "SELECT 1 /* a; b; c */; SELECT 2;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 2);
    }

    #[test]
    fn keeps_dollar_in_positional_param() {
        let sql = "INSERT INTO t VALUES ($1, $2); SELECT 1;";
        let r = split_sql_statements(sql);
        assert_eq!(r.len(), 2);
        assert!(r[0].contains("$1"));
    }
}
