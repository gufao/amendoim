use sqlx::PgPool;
use sqlx::Row;

use crate::models::result::{ColumnInfo, IndexInfo, SchemaInfo, TableInfo};

pub async fn list_schemas(pool: &PgPool) -> Result<Vec<SchemaInfo>, String> {
    let rows = sqlx::query(
        "SELECT schema_name FROM information_schema.schemata \
         WHERE schema_name NOT IN ('pg_toast', 'pg_catalog', 'information_schema') \
         ORDER BY schema_name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to list schemas: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| SchemaInfo {
            name: row.get("schema_name"),
        })
        .collect())
}

pub async fn list_tables(pool: &PgPool, schema: &str) -> Result<Vec<TableInfo>, String> {
    let rows = sqlx::query(
        "SELECT t.table_name, t.table_schema, t.table_type, \
         (SELECT reltuples::bigint FROM pg_class c \
          JOIN pg_namespace n ON n.oid = c.relnamespace \
          WHERE c.relname = t.table_name AND n.nspname = t.table_schema) as estimated_rows \
         FROM information_schema.tables t \
         WHERE t.table_schema = $1 \
         ORDER BY t.table_name"
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to list tables: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| TableInfo {
            name: row.get("table_name"),
            schema: row.get("table_schema"),
            table_type: row.get("table_type"),
            estimated_rows: row.try_get("estimated_rows").ok(),
        })
        .collect())
}

pub async fn list_columns(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let rows = sqlx::query(
        "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, c.ordinal_position::int, \
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key \
         FROM information_schema.columns c \
         LEFT JOIN ( \
           SELECT ku.column_name \
           FROM information_schema.table_constraints tc \
           JOIN information_schema.key_column_usage ku \
             ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema \
           WHERE tc.constraint_type = 'PRIMARY KEY' \
             AND tc.table_name = $2 AND tc.table_schema = $1 \
         ) pk ON pk.column_name = c.column_name \
         WHERE c.table_schema = $1 AND c.table_name = $2 \
         ORDER BY c.ordinal_position"
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to list columns: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let nullable: String = row.get("is_nullable");
            ColumnInfo {
                name: row.get("column_name"),
                data_type: row.get("data_type"),
                is_nullable: nullable == "YES",
                column_default: row.get("column_default"),
                ordinal_position: row.get("ordinal_position"),
                is_primary_key: row.get("is_primary_key"),
            }
        })
        .collect())
}

pub async fn list_indexes(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<IndexInfo>, String> {
    let rows = sqlx::query(
        "SELECT i.relname as index_name, \
         pg_get_indexdef(i.oid) as index_def, \
         ix.indisunique as is_unique, \
         am.amname as index_type, \
         array_to_string(ARRAY( \
           SELECT a.attname FROM pg_attribute a \
           WHERE a.attrelid = i.oid \
           ORDER BY a.attnum \
         ), ', ') as columns \
         FROM pg_index ix \
         JOIN pg_class t ON t.oid = ix.indrelid \
         JOIN pg_class i ON i.oid = ix.indexrelid \
         JOIN pg_namespace n ON n.oid = t.relnamespace \
         JOIN pg_am am ON am.oid = i.relam \
         WHERE t.relname = $2 AND n.nspname = $1 \
         ORDER BY i.relname"
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to list indexes: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| IndexInfo {
            name: row.get("index_name"),
            table_name: table.to_string(),
            columns: row.get("columns"),
            is_unique: row.get("is_unique"),
            index_type: row.get("index_type"),
        })
        .collect())
}
