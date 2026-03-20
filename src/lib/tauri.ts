import { invoke } from "@tauri-apps/api/core";

// Connection types
export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SchemaInfo {
  name: string;
}

export interface TableInfo {
  name: string;
  schema: string;
  table_type: string;
  estimated_rows: number | null;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  ordinal_position: number;
  is_primary_key: boolean;
}

export interface IndexInfo {
  name: string;
  table_name: string;
  columns: string;
  is_unique: boolean;
  index_type: string;
}

export interface ColumnMeta {
  name: string;
  data_type: string;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  row_count: number;
  total_rows: number | null;
  execution_time_ms: number;
  affected_rows: number | null;
}

// Connection commands
export const testConnection = (config: ConnectionConfig) =>
  invoke<void>("test_connection", { config });

export const connect = (id: string) =>
  invoke<void>("connect", { id });

export const disconnect = (id: string) =>
  invoke<void>("disconnect", { id });

export const saveConnection = (config: ConnectionConfig) =>
  invoke<ConnectionConfig>("save_connection", { config });

export const deleteConnection = (id: string) =>
  invoke<void>("delete_connection", { id });

export const listConnections = () =>
  invoke<ConnectionConfig[]>("list_connections");

export const getActiveConnection = () =>
  invoke<string | null>("get_active_connection");

export const isConnected = (id: string) =>
  invoke<boolean>("is_connected", { id });

// Schema commands
export const listSchemas = () =>
  invoke<SchemaInfo[]>("list_schemas");

export const listTables = (schema: string) =>
  invoke<TableInfo[]>("list_tables", { schema });

export const listColumns = (schema: string, table: string) =>
  invoke<ColumnInfo[]>("list_columns", { schema, table });

export const listIndexes = (schema: string, table: string) =>
  invoke<IndexInfo[]>("list_indexes", { schema, table });

// Query commands
export const executeQuery = (sql: string, limit?: number, offset?: number) =>
  invoke<QueryResult>("execute_query", { sql, limit, offset });

export const previewTable = (schema: string, table: string) =>
  invoke<QueryResult>("preview_table", { schema, table });

export const exportCsv = (sql: string) =>
  invoke<string>("export_csv", { sql });

// MCP commands
export interface McpStatus {
  is_running: boolean;
  port: number;
  url: string;
}

export const startMcpServer = () =>
  invoke<McpStatus>("start_mcp_server");

export const stopMcpServer = () =>
  invoke<void>("stop_mcp_server");

export const getMcpStatus = () =>
  invoke<McpStatus>("get_mcp_status");

export const installMcpClient = (client: string) =>
  invoke<string>("install_mcp_client", { client });
