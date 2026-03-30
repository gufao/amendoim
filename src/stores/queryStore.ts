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

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  isExecuting: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  // Table preview context (for filters)
  tableContext: { schema: string; table: string } | null;
  filters: Filter[];
  // Pending cell edits: rowIndex -> { column -> newValue }
  pendingChanges: Record<number, Record<string, unknown>>;
}

interface QueryState {
  tabs: QueryTab[];
  activeTabId: string | null;

  addTab: (title?: string, sql?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateSql: (id: string, sql: string) => void;
  updateTitle: (id: string, title: string) => void;
  executeQuery: (id: string, sqlOverride?: string) => Promise<void>;
  cancelQuery: (id: string) => Promise<void>;
  previewTable: (schema: string, table: string) => Promise<void>;
  addFilter: (id: string) => void;
  updateFilter: (tabId: string, filterId: string, updates: Partial<Filter>) => void;
  removeFilter: (tabId: string, filterId: string) => void;
  applyFilters: (tabId: string) => Promise<void>;
  setPage: (id: string, page: number) => void;
  setPageSize: (id: string, pageSize: number) => void;
  updateCellValue: (tabId: string, rowIndex: number, column: string, value: unknown) => void;
  savePendingChanges: (tabId: string) => Promise<void>;
  discardPendingChanges: (tabId: string) => void;
}

let tabCounter = 1;
let filterCounter = 1;

function createTab(title?: string, sql?: string): QueryTab {
  const id = `tab-${Date.now()}-${tabCounter++}`;
  return {
    id,
    title: title || `Query ${tabCounter - 1}`,
    sql: sql || "",
    result: null,
    isExecuting: false,
    error: null,
    page: 0,
    pageSize: 100,
    tableContext: null,
    filters: [],
    pendingChanges: {},
  };
}

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

function buildFilteredSql(schema: string, table: string, filters: Filter[], limit: number): string {
  const activeFilters = filters.filter((f) => f.enabled && f.column);
  let sql = `SELECT * FROM "${schema}"."${table}"`;

  if (activeFilters.length > 0) {
    const clauses = activeFilters.map((f) => {
      if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") {
        return `"${f.column}" ${f.operator}`;
      }
      if (f.operator === "LIKE" || f.operator === "NOT LIKE") {
        const escaped = f.value.replace(/'/g, "''");
        return `"${f.column}"::text ${f.operator} '%${escaped}%'`;
      }
      const escaped = f.value.replace(/'/g, "''");
      return `"${f.column}" ${f.operator} '${escaped}'`;
    });
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }

  sql += ` LIMIT ${limit}`;
  return sql;
}

export const useQueryStore = create<QueryState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (title, sql) => {
    const tab = createTab(title, sql);
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab.id;
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;
    if (activeTabId === id) {
      const idx = tabs.findIndex((t) => t.id === id);
      newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateSql: (id, sql) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, sql } : t)),
    }));
  },

  updateTitle: (id, title) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
    }));
  },

  executeQuery: async (id, sqlOverride) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    const sql = sqlOverride?.trim() || tab.sql.trim();
    if (!sql) return;

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, isExecuting: true, error: null } : t
      ),
    }));

    try {
      const result = await api.executeQuery(
        sql,
        tab.pageSize,
        tab.page * tab.pageSize
      );
      trackEvent("query_executed", { row_count: result.row_count, time_ms: result.execution_time_ms });
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, result, isExecuting: false } : t
        ),
      }));
    } catch (e) {
      const errorStr = String(e);
      const isCancelled = errorStr.includes("57014") || errorStr.toLowerCase().includes("cancel");
      if (!isCancelled) {
        trackEvent("query_error");
      }
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id
            ? {
                ...t,
                error: isCancelled ? null : errorStr,
                isExecuting: false,
              }
            : t
        ),
      }));
    }
  },

  cancelQuery: async (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || !tab.isExecuting) return;

    try {
      await api.cancelQuery();
    } catch (e) {
      // If cancel itself fails, still let the original query finish naturally
      console.warn("Cancel failed:", e);
    }
  },

  previewTable: async (schema, table) => {
    const existing = get().tabs.find(
      (t) => t.tableContext?.schema === schema && t.tableContext?.table === table
    );
    let tabId: string;
    if (existing) {
      tabId = existing.id;
      get().setActiveTab(tabId);
      return; // Already loaded
    } else {
      const sql = `SELECT * FROM "${schema}"."${table}" LIMIT 1000`;
      tabId = get().addTab(table, sql);
    }

    // Set table context for filters
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, isExecuting: true, error: null, tableContext: { schema, table } }
          : t
      ),
    }));

    try {
      const result = await api.previewTable(schema, table);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                result,
                isExecuting: false,
                sql: `SELECT * FROM "${schema}"."${table}" LIMIT 1000`,
              }
            : t
        ),
      }));
    } catch (e) {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, error: String(e), isExecuting: false }
            : t
        ),
      }));
    }
  },

  addFilter: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const firstCol = tab.result?.columns[0]?.name || "";
    const filter: Filter = {
      id: `filter-${filterCounter++}`,
      column: firstCol,
      operator: "=",
      value: "",
      enabled: true,
    };
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, filters: [...t.filters, filter] } : t
      ),
    }));
  },

  updateFilter: (tabId, filterId, updates) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              filters: t.filters.map((f) =>
                f.id === filterId ? { ...f, ...updates } : f
              ),
            }
          : t
      ),
    }));
  },

  removeFilter: (tabId, filterId) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, filters: t.filters.filter((f) => f.id !== filterId) }
          : t
      ),
    }));
  },

  applyFilters: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.tableContext) return;

    const { schema, table } = tab.tableContext;
    const sql = buildFilteredSql(schema, table, tab.filters, 1000);

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, sql, isExecuting: true, error: null } : t
      ),
    }));

    try {
      const result = await api.executeQuery(sql, undefined, undefined);
      // Also get total count with filters
      const activeFilters = tab.filters.filter((f) => f.enabled && f.column);
      let countSql = `SELECT count(*) as total FROM "${schema}"."${table}"`;
      if (activeFilters.length > 0) {
        const clauses = activeFilters.map((f) => {
          if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") {
            return `"${f.column}" ${f.operator}`;
          }
          if (f.operator === "LIKE" || f.operator === "NOT LIKE") {
            const escaped = f.value.replace(/'/g, "''");
            return `"${f.column}"::text ${f.operator} '%${escaped}%'`;
          }
          const escaped = f.value.replace(/'/g, "''");
          return `"${f.column}" ${f.operator} '${escaped}'`;
        });
        countSql += ` WHERE ${clauses.join(" AND ")}`;
      }
      const countResult = await api.executeQuery(countSql, undefined, undefined);
      const total = countResult.rows[0]?.["total"];
      result.total_rows = typeof total === "number" ? total : null;

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, result, isExecuting: false } : t
        ),
      }));
    } catch (e) {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, error: String(e), isExecuting: false }
            : t
        ),
      }));
    }
  },

  setPage: (id, page) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, page } : t)),
    }));
    get().executeQuery(id);
  },

  setPageSize: (id, pageSize) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, pageSize, page: 0 } : t
      ),
    }));
    get().executeQuery(id);
  },

  updateCellValue: (tabId, rowIndex, column, value) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.result) return;

    const originalValue = tab.result.rows[rowIndex]?.[column];
    const originalStr = originalValue === null || originalValue === undefined ? null : String(originalValue);
    const newStr = value === null || value === undefined ? null : String(value);

    if (originalStr === newStr) {
      // Value matches original — remove from pending
      const rowChanges = { ...tab.pendingChanges[rowIndex] };
      delete rowChanges[column];
      const newPending = { ...tab.pendingChanges };
      if (Object.keys(rowChanges).length === 0) {
        delete newPending[rowIndex];
      } else {
        newPending[rowIndex] = rowChanges;
      }
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, pendingChanges: newPending } : t
        ),
      }));
    } else {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                pendingChanges: {
                  ...t.pendingChanges,
                  [rowIndex]: {
                    ...t.pendingChanges[rowIndex],
                    [column]: value,
                  },
                },
              }
            : t
        ),
      }));
    }
  },

  savePendingChanges: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.tableContext || !tab.result) return;

    const { schema, table } = tab.tableContext;
    const columns = await api.listColumns(schema, table);
    const pkColumns = columns.filter((c) => c.is_primary_key).map((c) => c.name);

    if (pkColumns.length === 0) {
      throw new Error("NO_PRIMARY_KEY");
    }

    const errors: string[] = [];
    let savedCount = 0;

    for (const [rowIndexStr, changes] of Object.entries(tab.pendingChanges)) {
      const rowIndex = parseInt(rowIndexStr);
      const originalRow = tab.result.rows[rowIndex];
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

    // Clear pending changes
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, pendingChanges: {} } : t
      ),
    }));

    if (errors.length > 0) {
      throw new Error(
        `Saved ${savedCount}, failed ${errors.length}:\n${errors.join("\n")}`
      );
    }

    // Refresh data
    await get().executeQuery(tabId);
  },

  discardPendingChanges: (tabId) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, pendingChanges: {} } : t
      ),
    }));
  },
}));
