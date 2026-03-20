use serde::Serialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use tauri::Emitter;

use crate::db::queries;

pub fn tool_definitions() -> Value {
    json!([
        {
            "name": "list_schemas",
            "description": "List all database schemas. Use this first to discover what schemas are available.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "name": "list_tables",
            "description": "List all tables in a schema, including type (TABLE/VIEW) and estimated row count.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "schema": {
                        "type": "string",
                        "description": "The schema name (e.g. 'public')"
                    }
                },
                "required": ["schema"]
            }
        },
        {
            "name": "describe_table",
            "description": "Get columns (name, type, nullable, default, primary key) and indexes for a table. Use this to understand the structure before writing queries.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "schema": {
                        "type": "string",
                        "description": "The schema name"
                    },
                    "table": {
                        "type": "string",
                        "description": "The table name"
                    }
                },
                "required": ["schema", "table"]
            }
        },
        {
            "name": "execute_query",
            "description": "Send a SQL query to the Amendoim app. It will open in a new tab and execute automatically. IMPORTANT: You will NOT see the results — they are displayed only in the app for the user. Use this after understanding the table structure.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "The SQL query to execute"
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional title for the query tab"
                    }
                },
                "required": ["sql"]
            }
        }
    ])
}

#[derive(Clone, Serialize)]
struct McpQueryEvent {
    sql: String,
    title: String,
}

pub fn handle_execute_query(
    arguments: &Value,
    app_handle: &tauri::AppHandle,
) -> Result<Value, String> {
    let sql = arguments
        .get("sql")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'sql' argument")?;
    let title = arguments
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("AI Query");

    app_handle
        .emit(
            "mcp-execute-query",
            McpQueryEvent {
                sql: sql.to_string(),
                title: title.to_string(),
            },
        )
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(json!({
        "content": [{
            "type": "text",
            "text": "Query sent to Amendoim. The results are displayed in the app for the user to see. You do not have access to the query results."
        }]
    }))
}

pub async fn handle_schema_tool(
    pool: &PgPool,
    tool_name: &str,
    arguments: &Value,
) -> Result<Value, String> {
    match tool_name {
        "list_schemas" => {
            let schemas = queries::list_schemas(pool).await?;
            let text = schemas
                .iter()
                .map(|s| s.name.clone())
                .collect::<Vec<_>>()
                .join("\n");
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!("Available schemas:\n{}", text)
                }]
            }))
        }
        "list_tables" => {
            let schema = arguments
                .get("schema")
                .and_then(|v| v.as_str())
                .ok_or("Missing 'schema' argument")?;
            let tables = queries::list_tables(pool, schema).await?;
            let text = tables
                .iter()
                .map(|t| {
                    let rows = t
                        .estimated_rows
                        .map_or("unknown".to_string(), |r| r.to_string());
                    format!("{} ({}, ~{} rows)", t.name, t.table_type, rows)
                })
                .collect::<Vec<_>>()
                .join("\n");
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!("Tables in schema '{}':\n{}", schema, text)
                }]
            }))
        }
        "describe_table" => {
            let schema = arguments
                .get("schema")
                .and_then(|v| v.as_str())
                .ok_or("Missing 'schema' argument")?;
            let table = arguments
                .get("table")
                .and_then(|v| v.as_str())
                .ok_or("Missing 'table' argument")?;

            let columns = queries::list_columns(pool, schema, table).await?;
            let indexes = queries::list_indexes(pool, schema, table).await?;

            let mut text = format!("Table: {}.{}\n\nColumns:\n", schema, table);
            for col in &columns {
                let nullable = if col.is_nullable { "NULL" } else { "NOT NULL" };
                let pk = if col.is_primary_key { " [PK]" } else { "" };
                let default = col
                    .column_default
                    .as_deref()
                    .map(|d| format!(" DEFAULT {}", d))
                    .unwrap_or_default();
                text.push_str(&format!(
                    "  {} {} {}{}{}\n",
                    col.name, col.data_type, nullable, pk, default
                ));
            }

            if !indexes.is_empty() {
                text.push_str("\nIndexes:\n");
                for idx in &indexes {
                    let unique = if idx.is_unique { "UNIQUE " } else { "" };
                    text.push_str(&format!(
                        "  {} ({}{} on {})\n",
                        idx.name, unique, idx.index_type, idx.columns
                    ));
                }
            }

            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": text
                }]
            }))
        }
        _ => Err(format!("Unknown tool: {}", tool_name)),
    }
}
