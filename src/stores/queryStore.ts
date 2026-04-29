import { create } from "zustand";
import type { QueryResult } from "../lib/tauri";
import * as api from "../lib/tauri";
import { trackEvent } from "../lib/analytics";

export interface Filter {
  id: string;
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
}

export const FILTER_OPERATORS = [
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "LIKE", label: "contains" },
  { value: "NOT LIKE", label: "not contains" },
  { value: "IS NULL", label: "is null" },
  { value: "IS NOT NULL", label: "is not null" },
] as const;

export const ANY_COLUMN_OPERATORS = [
  { value: "LIKE", label: "contains" },
  { value: "NOT LIKE", label: "not contains" },
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
] as const;

export const ANY_COLUMN_VALUE = "__any__";

// PostgreSQL type names returned by the backend (executor.rs pg_value_to_json
// uses these uppercase names from sqlx's PgTypeInfo). Types where `=` is the
// natural default. Text-like types (TEXT/VARCHAR/JSON/JSONB/etc.) keep `LIKE`.
const EXACT_MATCH_TYPES = new Set([
  "UUID",
  "INT2", "INT4", "INT8",
  "FLOAT4", "FLOAT8", "NUMERIC",
  "BOOL",
  "DATE", "TIMESTAMP", "TIMESTAMPTZ", "TIME", "TIMETZ",
]);

export function defaultOperatorForType(dataType: string | undefined): string {
  if (dataType && EXACT_MATCH_TYPES.has(dataType.toUpperCase())) return "=";
  return "LIKE";
}

interface QueryState {
  activeView: "editor" | "data";
  activeQueryId: string | null;
  sql: string;
  result: QueryResult | null;
  isExecuting: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  tableContext: { schema: string; table: string } | null;
  filters: Filter[];
  pendingChanges: Record<number, Record<string, unknown>>;
  selectedRowIndex: number | null;

  setActiveView: (view: "editor" | "data") => void;
  setActiveQueryId: (id: string | null) => void;
  setSql: (sql: string) => void;
  setSelectedRowIndex: (index: number | null) => void;
  executeQuery: (sqlOverride?: string) => Promise<void>;
  cancelQuery: () => Promise<void>;
  previewTable: (schema: string, table: string) => Promise<void>;
  fetchPreviewPage: () => Promise<void>;
  addFilter: () => void;
  updateFilter: (filterId: string, updates: Partial<Filter>) => void;
  removeFilter: (filterId: string) => void;
  applyFilters: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  updateCellValue: (rowIndex: number, column: string, value: unknown) => void;
  savePendingChanges: () => Promise<void>;
  discardPendingChanges: () => void;
  resetDataState: () => void;
  clearError: () => void;
}

let filterCounter = 1;

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

export function buildFilterClause(f: Filter, allColumns?: string[]): string {
  if (f.column === ANY_COLUMN_VALUE) {
    if (!allColumns || allColumns.length === 0) return "TRUE";
    const escaped = f.value.replace(/'/g, "''");
    const colClauses = allColumns.map((col) => {
      if (f.operator === "LIKE" || f.operator === "NOT LIKE") {
        return `"${col}"::text ${f.operator} '%${escaped}%'`;
      }
      return `"${col}"::text ${f.operator} '${escaped}'`;
    });
    return `(${colClauses.join(" OR ")})`;
  }

  if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") {
    return `"${f.column}" ${f.operator}`;
  }
  if (f.operator === "LIKE" || f.operator === "NOT LIKE") {
    const escaped = f.value.replace(/'/g, "''");
    return `"${f.column}"::text ${f.operator} '%${escaped}%'`;
  }
  const escaped = f.value.replace(/'/g, "''");
  return `"${f.column}" ${f.operator} '${escaped}'`;
}

export function buildFilteredSql(
  schema: string,
  table: string,
  filters: Filter[],
  limit: number,
  allColumns: string[]
): string {
  const activeFilters = filters.filter((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
  let sql = `SELECT * FROM "${schema}"."${table}"`;

  if (activeFilters.length > 0) {
    const clauses = activeFilters.map((f) => buildFilterClause(f, allColumns));
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }

  sql += ` LIMIT ${limit}`;
  return sql;
}

export const useQueryStore = create<QueryState>((set, get) => ({
  activeView: "editor",
  activeQueryId: null,
  sql: "",
  result: null,
  isExecuting: false,
  error: null,
  page: 0,
  pageSize: 100,
  tableContext: null,
  filters: [],
  pendingChanges: {},
  selectedRowIndex: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveQueryId: (id) => set({ activeQueryId: id }),
  setSql: (sql) => set({ sql }),
  setSelectedRowIndex: (index) => set({ selectedRowIndex: index }),

  resetDataState: () =>
    set({
      result: null,
      error: null,
      page: 0,
      filters: [],
      pendingChanges: {},
      selectedRowIndex: null,
      tableContext: null,
    }),

  clearError: () => set({ error: null }),

  executeQuery: async (sqlOverride) => {
    const state = get();
    const sql = sqlOverride?.trim() || state.sql.trim();
    if (!sql) return;

    set({ isExecuting: true, error: null, selectedRowIndex: null });

    try {
      const result = await api.executeQuery(sql, state.pageSize, state.page * state.pageSize);
      trackEvent("query_executed", { row_count: result.row_count, time_ms: result.execution_time_ms });
      set({ result, isExecuting: false, activeView: "data" });

      // Best-effort async total-row count for raw SELECT queries that didn't
      // come through the preview/filter paths (those set total_rows already).
      // No-op on DML, multi-statement, or anything we can't safely wrap.
      const upper = sql.toUpperCase();
      const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");
      const alreadyHasTotal = result.total_rows !== null && result.total_rows !== undefined;
      if (
        isSelect &&
        result.affected_rows === null &&
        !alreadyHasTotal &&
        !get().tableContext
      ) {
        const stripped = sql.replace(/;+\s*$/, "").trim();
        const countSql = `SELECT count(*) AS total FROM (${stripped}) _ame_count`;
        api
          .executeQuery(countSql, undefined, undefined)
          .then((cr) => {
            const raw = cr.rows[0]?.["total"];
            const totalNum =
              typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
            if (!Number.isFinite(totalNum)) return;
            set((s) => {
              if (s.result !== result) return s;
              return {
                result: { ...s.result, total_rows: totalNum, total_rows_estimated: false },
              };
            });
          })
          .catch(() => {
            // Silent: counting is best-effort. Some queries (multi-statement,
            // SET, etc.) can't be wrapped as a subquery — that's fine.
          });
      }
    } catch (e) {
      const errorStr = String(e);
      const isCancelled = errorStr.includes("57014") || errorStr.toLowerCase().includes("cancel");
      if (!isCancelled) {
        trackEvent("query_error");
      }
      set({
        error: isCancelled ? null : errorStr,
        isExecuting: false,
      });
    }
  },

  cancelQuery: async () => {
    if (!get().isExecuting) return;
    try {
      await api.cancelQuery();
    } catch (e) {
      console.warn("Cancel failed:", e);
    }
  },

  previewTable: async (schema, table) => {
    const { pageSize } = get();
    set({
      isExecuting: true,
      error: null,
      activeView: "data",
      tableContext: { schema, table },
      filters: [],
      pendingChanges: {},
      selectedRowIndex: null,
      page: 0,
      sql: `SELECT * FROM "${schema}"."${table}" LIMIT ${pageSize}`,
    });

    try {
      const result = await api.previewTable(schema, table, pageSize, 0);
      set({ result, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  fetchPreviewPage: async () => {
    const state = get();
    if (!state.tableContext) return;
    const { schema, table } = state.tableContext;
    const offset = state.page * state.pageSize;
    set({
      isExecuting: true,
      error: null,
      selectedRowIndex: null,
      sql: `SELECT * FROM "${schema}"."${table}" LIMIT ${state.pageSize} OFFSET ${offset}`,
    });
    try {
      const result = await api.previewTable(schema, table, state.pageSize, offset);
      set({ result, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  addFilter: () => {
    const filter: Filter = {
      id: `filter-${filterCounter++}`,
      column: ANY_COLUMN_VALUE,
      operator: "LIKE",
      value: "",
      enabled: true,
    };
    set((s) => ({ filters: [...s.filters, filter] }));
  },

  updateFilter: (filterId, updates) => {
    set((s) => ({
      filters: s.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
    }));
  },

  removeFilter: (filterId) => {
    set((s) => ({ filters: s.filters.filter((f) => f.id !== filterId) }));
  },

  applyFilters: async () => {
    const state = get();
    if (!state.tableContext) return;

    const activeFilters = state.filters.filter((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (activeFilters.length === 0) {
      // No filters → fall back to the preview path (uses pg_class estimate, no full count).
      await get().fetchPreviewPage();
      return;
    }

    const { schema, table } = state.tableContext;
    const allColumns = state.result?.columns.map((c) => c.name) || [];
    const sql = buildFilteredSql(schema, table, state.filters, state.pageSize, allColumns);

    set({ sql, isExecuting: true, error: null, selectedRowIndex: null });

    try {
      const result = await api.executeQuery(sql, undefined, undefined);
      const clauses = activeFilters.map((f) => buildFilterClause(f, allColumns));
      const countSql = `SELECT count(*) as total FROM "${schema}"."${table}" WHERE ${clauses.join(" AND ")}`;
      const countResult = await api.executeQuery(countSql, undefined, undefined);
      const total = countResult.rows[0]?.["total"];
      result.total_rows = typeof total === "number" ? total : null;
      result.total_rows_estimated = false;

      set({ result, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  setPage: (page) => {
    set({ page, selectedRowIndex: null });
    const state = get();
    const hasActiveFilters = state.filters.some((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (state.tableContext && !hasActiveFilters) {
      get().fetchPreviewPage();
    } else {
      get().executeQuery();
    }
  },

  setPageSize: (pageSize) => {
    set({ pageSize, page: 0, selectedRowIndex: null });
    const state = get();
    const hasActiveFilters = state.filters.some((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (state.tableContext && !hasActiveFilters) {
      get().fetchPreviewPage();
    } else {
      get().executeQuery();
    }
  },

  updateCellValue: (rowIndex, column, value) => {
    const state = get();
    if (!state.result) return;

    const originalValue = state.result.rows[rowIndex]?.[column];
    const stringify = (v: unknown) =>
      v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v);
    const originalStr = stringify(originalValue);
    const newStr = stringify(value);

    if (originalStr === newStr) {
      const rowChanges = { ...state.pendingChanges[rowIndex] };
      delete rowChanges[column];
      const newPending = { ...state.pendingChanges };
      if (Object.keys(rowChanges).length === 0) {
        delete newPending[rowIndex];
      } else {
        newPending[rowIndex] = rowChanges;
      }
      set({ pendingChanges: newPending });
    } else {
      set({
        pendingChanges: {
          ...state.pendingChanges,
          [rowIndex]: {
            ...state.pendingChanges[rowIndex],
            [column]: value,
          },
        },
      });
    }
  },

  savePendingChanges: async () => {
    const state = get();
    if (!state.tableContext || !state.result) return;

    const { schema, table } = state.tableContext;
    const columns = await api.listColumns(schema, table);
    const pkColumns = columns.filter((c) => c.is_primary_key).map((c) => c.name);

    if (pkColumns.length === 0) {
      throw new Error("NO_PRIMARY_KEY");
    }

    const errors: string[] = [];
    let savedCount = 0;

    for (const [rowIndexStr, changes] of Object.entries(state.pendingChanges)) {
      const rowIndex = parseInt(rowIndexStr);
      const originalRow = state.result.rows[rowIndex];
      if (!originalRow) continue;

      const setClauses = Object.entries(changes).map(
        ([col, val]) => `"${col}" = ${toSqlLiteral(val)}`
      );

      const whereClauses = pkColumns.map((pk) => {
        const val = originalRow[pk];
        if (val === null || val === undefined) return `"${pk}" IS NULL`;
        return `"${pk}" = ${toSqlLiteral(val)}`;
      });

      const sql = `UPDATE "${schema}"."${table}" SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;

      try {
        await api.executeQuery(sql);
        savedCount++;
      } catch (e) {
        errors.push(`Row ${rowIndex + 1}: ${e}`);
      }
    }

    set({ pendingChanges: {} });

    if (errors.length > 0) {
      throw new Error(`Saved ${savedCount}, failed ${errors.length}:\n${errors.join("\n")}`);
    }

    await get().executeQuery();
  },

  discardPendingChanges: () => {
    set({ pendingChanges: {} });
  },
}));
