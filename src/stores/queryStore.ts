import { create } from "zustand";
import type { QueryResult } from "../lib/tauri";
import * as api from "../lib/tauri";
import { trackEvent } from "../lib/analytics";
import { useConnectionStore } from "./connectionStore";

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

// Reserved filter id backing the dedicated "search this table" box. It's an
// any-column LIKE filter that rides the normal filter pipeline (SQL build,
// count, pagination, persistence) but is rendered by <TableSearch/> instead of
// the FilterBar, so it never shows up twice.
export const TABLE_SEARCH_FILTER_ID = "__table_search__";

/**
 * Upserts the reserved table-search filter into a filters array. A non-empty
 * value places (or replaces) the search filter at the front; an empty/whitespace
 * value removes it. Pure and non-mutating so it can be unit-tested in isolation.
 */
export function upsertSearchFilter(filters: Filter[], value: string): Filter[] {
  const others = filters.filter((f) => f.id !== TABLE_SEARCH_FILTER_ID);
  if (value.trim() === "") return others;
  const searchFilter: Filter = {
    id: TABLE_SEARCH_FILTER_ID,
    column: ANY_COLUMN_VALUE,
    operator: "LIKE",
    value,
    enabled: true,
  };
  return [searchFilter, ...others];
}

// --- Per-table state cache (filters, page, pageSize) ---

interface TableState {
  filters: Filter[];
  pageSize: number;
  /** Updated on every write; used for LRU eviction. */
  lastUsed: number;
}

const TABLE_CACHE_KEY = "amendoim.tableStateCache.v1";
const TABLE_CACHE_LIMIT = 50;

function tableCacheKey(connectionId: string, schema: string, table: string): string {
  return `${connectionId}::${schema}.${table}`;
}

function loadTableCache(): Record<string, TableState> {
  try {
    const raw = localStorage.getItem(TABLE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, TableState>;
    return {};
  } catch {
    return {};
  }
}

let cacheWriteTimer: ReturnType<typeof setTimeout> | null = null;
function persistTableCache(cache: Record<string, TableState>) {
  if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
  cacheWriteTimer = setTimeout(() => {
    try {
      // Enforce LRU cap at write time.
      const entries = Object.entries(cache);
      if (entries.length > TABLE_CACHE_LIMIT) {
        entries.sort((a, b) => b[1].lastUsed - a[1].lastUsed);
        const trimmed: Record<string, TableState> = {};
        for (const [k, v] of entries.slice(0, TABLE_CACHE_LIMIT)) trimmed[k] = v;
        localStorage.setItem(TABLE_CACHE_KEY, JSON.stringify(trimmed));
        return;
      }
      localStorage.setItem(TABLE_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // localStorage full or disabled — silently drop. The cache is best-effort.
    }
  }, 250);
}

function writeTableState(
  connectionId: string,
  schema: string,
  table: string,
  state: { filters: Filter[]; pageSize: number }
) {
  const cache = loadTableCache();
  cache[tableCacheKey(connectionId, schema, table)] = {
    ...state,
    // The table-search filter is session-only — never persist it. If restored,
    // previewTable would re-apply it before a result exists, building its
    // any-column clause from stale/empty columns (the clause collapses to TRUE,
    // silently showing unfiltered data, or references the previous table's
    // columns and errors). Column-specific filters are safe to persist.
    filters: state.filters.filter((f) => f.id !== TABLE_SEARCH_FILTER_ID),
    lastUsed: Date.now(),
  };
  persistTableCache(cache);
}

export function evictTableCacheForConnection(connectionId: string) {
  const cache = loadTableCache();
  let changed = false;
  for (const k of Object.keys(cache)) {
    if (k.startsWith(`${connectionId}::`)) {
      delete cache[k];
      changed = true;
    }
  }
  if (changed) persistTableCache(cache);
}

function getActiveConnectionIdSync(): string | null {
  return useConnectionStore.getState().activeConnectionId;
}

/**
 * After an async query, the user may have switched connection or jumped to
 * a different table. If so, the result we got is stale — drop it instead of
 * letting it land on top of fresh state.
 */
function isStillCurrent(
  expectedConnId: string | null,
  expectedSchema: string,
  expectedTable: string
): boolean {
  if (getActiveConnectionIdSync() !== expectedConnId) return false;
  const ctx = useQueryStore.getState().tableContext;
  return ctx?.schema === expectedSchema && ctx?.table === expectedTable;
}

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
  sort: SortSpec | null;
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
  applyFilters: (opts?: { resetPage?: boolean }) => Promise<void>;
  setTableSearch: (value: string) => void;
  setSort: (sort: SortSpec | null) => void;
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

export interface SortSpec {
  column: string;
  direction: "asc" | "desc";
}

export function buildFilteredSql(
  schema: string,
  table: string,
  filters: Filter[],
  limit: number,
  allColumns: string[],
  offset?: number,
  sort?: SortSpec | null
): string {
  const activeFilters = filters.filter((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
  let sql = `SELECT * FROM "${schema}"."${table}"`;

  if (activeFilters.length > 0) {
    const clauses = activeFilters.map((f) => buildFilterClause(f, allColumns));
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }

  if (sort && sort.column) {
    const dir = sort.direction === "desc" ? "DESC" : "ASC";
    // NULLS LAST so users sorting desc don't get a wall of NULLs on top.
    sql += ` ORDER BY "${sort.column}" ${dir} NULLS LAST`;
  }

  sql += ` LIMIT ${limit}`;
  if (offset && offset > 0) sql += ` OFFSET ${offset}`;
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
  sort: null,
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
      sort: null,
      pendingChanges: {},
      selectedRowIndex: null,
      tableContext: null,
    }),

  clearError: () => set({ error: null }),

  executeQuery: async (sqlOverride) => {
    const state = get();
    const sql = sqlOverride?.trim() || state.sql.trim();
    if (!sql) return;

    const initialConnId = getActiveConnectionIdSync();
    set({ isExecuting: true, error: null, selectedRowIndex: null });

    try {
      const result = await api.executeQuery(sql, state.pageSize, state.page * state.pageSize);
      // If the user switched connection while we were waiting, drop the result
      // so it doesn't overwrite the new connection's empty state.
      if (getActiveConnectionIdSync() !== initialConnId) return;
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
      if (getActiveConnectionIdSync() !== initialConnId) return;
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
    const connId = getActiveConnectionIdSync();
    const cache = loadTableCache();
    const cached = connId ? cache[tableCacheKey(connId, schema, table)] : undefined;

    const initialFilters = cached?.filters ?? [];
    const initialPageSize = cached?.pageSize ?? get().pageSize;
    // Always start fresh on page 0 when (re-)opening a table. We persist
    // filters and pageSize per (conn, schema, table), but page is intentionally
    // session-only — restoring page across app restarts is more confusing than
    // helpful (user expects to land at the top, not on whichever page they last
    // browsed).
    const initialPage = 0;
    const hasEnabledFilters = initialFilters.some(
      (f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column)
    );

    set({
      isExecuting: true,
      error: null,
      activeView: "data",
      tableContext: { schema, table },
      filters: initialFilters,
      sort: null,
      pendingChanges: {},
      selectedRowIndex: null,
      page: initialPage,
      pageSize: initialPageSize,
      sql: `SELECT * FROM "${schema}"."${table}" LIMIT ${initialPageSize} OFFSET ${initialPage * initialPageSize}`,
    });

    if (hasEnabledFilters) {
      await get().applyFilters({ resetPage: false });
      return;
    }

    try {
      const result = await api.previewTable(schema, table, initialPageSize, initialPage * initialPageSize);
      // Drop result if user switched connection or table while we were waiting.
      if (!isStillCurrent(connId, schema, table)) return;
      set({ result, isExecuting: false });
    } catch (e) {
      if (!isStillCurrent(connId, schema, table)) return;
      set({ error: String(e), isExecuting: false });
    }
  },

  fetchPreviewPage: async () => {
    const state = get();
    if (!state.tableContext) return;
    const { schema, table } = state.tableContext;
    const initialConnId = getActiveConnectionIdSync();
    const offset = state.page * state.pageSize;

    // Sort active but no filters: the fast preview_table backend path doesn't
    // support ORDER BY, so build the SQL here. Carry over the prior total
    // (no filter = full-table count is unchanged) to keep the row counter accurate.
    if (state.sort) {
      const sql = buildFilteredSql(schema, table, [], state.pageSize, [], offset, state.sort);
      const priorTotal = state.result?.total_rows ?? null;
      const priorEstimated = state.result?.total_rows_estimated ?? false;
      set({ sql, isExecuting: true, error: null, selectedRowIndex: null });
      try {
        const result = await api.executeQuery(sql, undefined, undefined);
        if (!isStillCurrent(initialConnId, schema, table)) return;
        result.total_rows = priorTotal;
        result.total_rows_estimated = priorEstimated;
        set({ result, isExecuting: false });
      } catch (e) {
        if (!isStillCurrent(initialConnId, schema, table)) return;
        set({ error: String(e), isExecuting: false });
      }
      return;
    }

    set({
      isExecuting: true,
      error: null,
      selectedRowIndex: null,
      sql: `SELECT * FROM "${schema}"."${table}" LIMIT ${state.pageSize} OFFSET ${offset}`,
    });
    try {
      const result = await api.previewTable(schema, table, state.pageSize, offset);
      if (!isStillCurrent(initialConnId, schema, table)) return;
      set({ result, isExecuting: false });
    } catch (e) {
      if (!isStillCurrent(initialConnId, schema, table)) return;
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
    const s = get();
    const connId = getActiveConnectionIdSync();
    if (connId && s.tableContext) {
      writeTableState(connId, s.tableContext.schema, s.tableContext.table, {
        filters: s.filters, pageSize: s.pageSize,
      });
    }
  },

  updateFilter: (filterId, updates) => {
    set((s) => ({
      filters: s.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
    }));
    const s = get();
    const connId = getActiveConnectionIdSync();
    if (connId && s.tableContext) {
      writeTableState(connId, s.tableContext.schema, s.tableContext.table, {
        filters: s.filters, pageSize: s.pageSize,
      });
    }
  },

  removeFilter: (filterId) => {
    set((s) => ({ filters: s.filters.filter((f) => f.id !== filterId) }));
    const s = get();
    const connId = getActiveConnectionIdSync();
    if (connId && s.tableContext) {
      writeTableState(connId, s.tableContext.schema, s.tableContext.table, {
        filters: s.filters, pageSize: s.pageSize,
      });
    }
  },

  applyFilters: async ({ resetPage = true }: { resetPage?: boolean } = {}) => {
    const state = get();
    if (!state.tableContext) return;

    const activeFilters = state.filters.filter((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (activeFilters.length === 0) {
      // No filters → fall back to the preview path (uses pg_class estimate, no full count).
      await get().fetchPreviewPage();
      return;
    }

    const { schema, table } = state.tableContext;
    const initialConnId = getActiveConnectionIdSync();
    const page = resetPage ? 0 : state.page;
    const offset = page * state.pageSize;
    const allColumns = state.result?.columns.map((c) => c.name) || [];
    const sql = buildFilteredSql(schema, table, state.filters, state.pageSize, allColumns, offset, state.sort);

    set({ sql, page, isExecuting: true, error: null, selectedRowIndex: null });

    try {
      const result = await api.executeQuery(sql, undefined, undefined);
      if (!isStillCurrent(initialConnId, schema, table)) return;
      const clauses = activeFilters.map((f) => buildFilterClause(f, allColumns));
      const countSql = `SELECT count(*) as total FROM "${schema}"."${table}" WHERE ${clauses.join(" AND ")}`;
      const countResult = await api.executeQuery(countSql, undefined, undefined);
      if (!isStillCurrent(initialConnId, schema, table)) return;
      const total = countResult.rows[0]?.["total"];
      result.total_rows = typeof total === "number" ? total : null;
      result.total_rows_estimated = false;

      set({ result, isExecuting: false });
    } catch (e) {
      if (!isStillCurrent(initialConnId, schema, table)) return;
      set({ error: String(e), isExecuting: false });
    }
  },

  setTableSearch: (value) => {
    // Searching a table changes the result set, so always land on page 0.
    set((s) => ({
      filters: upsertSearchFilter(s.filters, value),
      page: 0,
      selectedRowIndex: null,
    }));
    const s = get();
    const connId = getActiveConnectionIdSync();
    if (connId && s.tableContext) {
      writeTableState(connId, s.tableContext.schema, s.tableContext.table, {
        filters: s.filters,
        pageSize: s.pageSize,
      });
    }
    // applyFilters falls back to the plain preview path when no filters remain,
    // so clearing the search restores the full table automatically.
    get().applyFilters({ resetPage: true });
  },

  setSort: (sort) => {
    const prev = get().sort;
    const same =
      (prev === null && sort === null) ||
      (prev !== null && sort !== null && prev.column === sort.column && prev.direction === sort.direction);
    if (same) return;
    set({ sort, page: 0, selectedRowIndex: null });
    const state = get();
    if (!state.tableContext) return;
    const hasActiveFilters = state.filters.some((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (hasActiveFilters) {
      get().applyFilters({ resetPage: true });
    } else {
      get().fetchPreviewPage();
    }
  },

  setPage: (page) => {
    set({ page, selectedRowIndex: null });
    const state = get();
    const connId = getActiveConnectionIdSync();
    if (connId && state.tableContext) {
      writeTableState(connId, state.tableContext.schema, state.tableContext.table, {
        filters: state.filters, pageSize: state.pageSize,
      });
    }
    const hasActiveFilters = state.filters.some((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (state.tableContext) {
      if (hasActiveFilters) {
        get().applyFilters({ resetPage: false });
      } else {
        get().fetchPreviewPage();
      }
    } else {
      get().executeQuery();
    }
  },

  setPageSize: (pageSize) => {
    set({ pageSize, page: 0, selectedRowIndex: null });
    const state = get();
    const connId = getActiveConnectionIdSync();
    if (connId && state.tableContext) {
      writeTableState(connId, state.tableContext.schema, state.tableContext.table, {
        filters: state.filters, pageSize,
      });
    }
    const hasActiveFilters = state.filters.some((f) => f.enabled && (f.column === ANY_COLUMN_VALUE || f.column));
    if (state.tableContext) {
      if (hasActiveFilters) {
        get().applyFilters({ resetPage: true });
      } else {
        get().fetchPreviewPage();
      }
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
