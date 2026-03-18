use sqlx::{Column, PgPool, Row, TypeInfo};
use std::collections::HashMap;
use std::time::Instant;

use crate::models::result::{ColumnMeta, QueryResult};

pub async fn execute_query(
    pool: &PgPool,
    sql: &str,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<QueryResult, String> {
    let start = Instant::now();

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
            .fetch_all(pool)
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
        let result = sqlx::query(&final_sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        let execution_time_ms = start.elapsed().as_millis();

        Ok(QueryResult {
            columns: Vec::new(),
            rows: Vec::new(),
            row_count: 0,
            total_rows: None,
            execution_time_ms,
            affected_rows: Some(result.rows_affected()),
        })
    }
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
