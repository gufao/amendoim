import type { TranslationKey } from "./pt-BR";

export const en: Record<TranslationKey, string> = {
  // App
  "app.welcome": "Welcome to Amendoim",
  "app.welcome.description": "Connect to a PostgreSQL database to start exploring your data.",
  "app.welcome.newConnection": "New Connection",
  "app.welcome.hint": "Or select a saved connection from the sidebar",

  // Sidebar
  "sidebar.expand": "Expand sidebar",
  "sidebar.collapse": "Collapse sidebar",
  "sidebar.explorer": "Explorer",
  "sidebar.connections": "Connections",
  "sidebar.newConnection": "New Connection",

  // Connection
  "connection.new": "New Connection",
  "connection.edit": "Edit Connection",
  "connection.postgresql": "PostgreSQL",
  "connection.name": "Name",
  "connection.name.placeholder": "My Database",
  "connection.host": "Host",
  "connection.port": "Port",
  "connection.user": "User",
  "connection.password": "Password",
  "connection.database": "Database",
  "connection.test": "Test Connection",
  "connection.save": "Save & Connect",
  "connection.update": "Update",
  "connection.add": "Add Connection",
  "connection.connect": "Connect",
  "connection.disconnect": "Disconnect",
  "connection.delete": "Delete",
  "connection.nameRequired": "Connection name is required",
  "connection.success": "Connection successful!",
  "connection.disconnected": "Disconnected",

  // Schema
  "schema.noSchemas": "No schemas found",
  "schema.browser": "Schema",

  // Table Info
  "tableInfo.column": "Column",
  "tableInfo.type": "Type",
  "tableInfo.nullable": "Nullable",
  "tableInfo.default": "Default",
  "tableInfo.yes": "YES",
  "tableInfo.no": "NO",
  "tableInfo.indexes": "Indexes",
  "tableInfo.unique": "unique",

  // Top Bar
  "topBar.newQuery": "New Query (Cmd+N)",
  "topBar.run": "Run",
  "topBar.executeQuery": "Execute Query (Cmd+Enter)",

  // Editor
  "editor.empty": "Open a new query tab to get started",
  "editor.executeQuery": "Execute Query",

  // Results
  "results.executing": "Executing query...",
  "results.error": "Query Error",
  "results.empty": "Results will appear here",
  "results.noRows": "Query returned no rows",
  "results.rowsAffected": "{count} rows affected",
  "results.exportCsv": "Export CSV",
  "results.rows": "Rows:",
  "results.null": "NULL",

  // Status Bar
  "status.rows": "{count} rows",
  "status.rowsOfTotal": "{count} rows of {total} total",
  "status.affected": "{count} affected",

  // Filter Bar
  "filter.where": "WHERE",
  "filter.and": "AND",
  "filter.value": "value...",
  "filter.disable": "Disable filter",
  "filter.enable": "Enable filter",
  "filter.on": "ON",
  "filter.off": "OFF",
  "filter.add": "Add filter",
  "filter.apply": "Apply",

  // Filter operators
  "filter.op.equals": "equals",
  "filter.op.notEquals": "not equals",
  "filter.op.greaterThan": "greater than",
  "filter.op.greaterOrEqual": "greater or equal",
  "filter.op.lessThan": "less than",
  "filter.op.lessOrEqual": "less or equal",
  "filter.op.contains": "contains",
  "filter.op.notContains": "not contains",
  "filter.op.isNull": "is null",
  "filter.op.isNotNull": "is not null",

  // Cell Viewer
  "cellViewer.column": "Column:",
  "cellViewer.copy": "Copy",
};
