import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Tauri bridge BEFORE importing the store so the store binds to mocks.
vi.mock("../lib/tauri", () => ({
  executeQuery: vi.fn(),
  previewTable: vi.fn(),
  cancelQuery: vi.fn(),
}));
vi.mock("../lib/analytics", () => ({
  trackEvent: vi.fn(),
}));
vi.mock("./connectionStore", () => {
  const state = { activeConnectionId: "conn-1" as string | null };
  return {
    useConnectionStore: {
      getState: () => state,
      __setActive: (id: string | null) => {
        state.activeConnectionId = id;
      },
    },
  };
});

import * as api from "../lib/tauri";
import { useQueryStore, evictTableCacheForConnection, type SortSpec } from "./queryStore";

const apiMock = api as unknown as {
  executeQuery: ReturnType<typeof vi.fn>;
  previewTable: ReturnType<typeof vi.fn>;
};

function emptyResult(overrides: Partial<{ rows: Record<string, unknown>[]; total_rows: number | null; total_rows_estimated: boolean }> = {}) {
  return {
    columns: [{ name: "id", data_type: "INT4" }, { name: "name", data_type: "TEXT" }],
    rows: [],
    row_count: 0,
    total_rows: null,
    total_rows_estimated: false,
    execution_time_ms: 1,
    affected_rows: null,
    ...overrides,
  };
}

function resetStore() {
  // Re-seed the store between tests.
  useQueryStore.setState({
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
  });
}

beforeEach(() => {
  localStorage.clear();
  apiMock.executeQuery.mockReset();
  apiMock.previewTable.mockReset();
  resetStore();
});

describe("evictTableCacheForConnection", () => {
  const KEY = "amendoim.tableStateCache.v1";

  function seed(cache: Record<string, unknown>) {
    localStorage.setItem(KEY, JSON.stringify(cache));
  }

  function read(): Record<string, unknown> {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function waitForWrite() {
    // persistTableCache debounces 250ms via setTimeout.
    return new Promise((r) => setTimeout(r, 300));
  }

  it("removes entries scoped to the given connection", async () => {
    seed({
      "conn-1::public.users": { filters: [], pageSize: 100, lastUsed: 1 },
      "conn-1::public.orders": { filters: [], pageSize: 50, lastUsed: 2 },
      "conn-2::public.users": { filters: [], pageSize: 25, lastUsed: 3 },
    });

    evictTableCacheForConnection("conn-1");
    await waitForWrite();

    const remaining = read();
    expect(Object.keys(remaining)).toEqual(["conn-2::public.users"]);
  });

  it("is a no-op when no entries match (does not write)", async () => {
    seed({
      "conn-2::public.users": { filters: [], pageSize: 25, lastUsed: 3 },
    });
    const before = localStorage.getItem(KEY);

    evictTableCacheForConnection("conn-1");
    await waitForWrite();

    expect(localStorage.getItem(KEY)).toBe(before);
  });

  it("is a no-op when cache is empty", async () => {
    evictTableCacheForConnection("conn-1");
    await waitForWrite();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("only matches the connection prefix, not partial substring", async () => {
    // "conn-1" must not match "conn-10" — eviction uses the `::` separator.
    seed({
      "conn-1::public.users": { filters: [], pageSize: 100, lastUsed: 1 },
      "conn-10::public.users": { filters: [], pageSize: 100, lastUsed: 2 },
    });

    evictTableCacheForConnection("conn-1");
    await waitForWrite();

    expect(Object.keys(read())).toEqual(["conn-10::public.users"]);
  });
});

describe("useQueryStore — setSort action", () => {
  beforeEach(() => {
    useQueryStore.setState({
      tableContext: { schema: "public", table: "users" },
      result: emptyResult({ total_rows: 42, total_rows_estimated: true }),
      page: 3,
      pageSize: 100,
    });
  });

  it("no-ops when the sort is identical (no refetch fired)", async () => {
    useQueryStore.setState({ sort: { column: "id", direction: "asc" } });

    apiMock.previewTable.mockResolvedValueOnce(emptyResult());
    apiMock.executeQuery.mockResolvedValueOnce(emptyResult());

    useQueryStore.getState().setSort({ column: "id", direction: "asc" });

    expect(apiMock.previewTable).not.toHaveBeenCalled();
    expect(apiMock.executeQuery).not.toHaveBeenCalled();
  });

  it("clearing sort (null → null) is a no-op", () => {
    useQueryStore.getState().setSort(null);
    expect(apiMock.previewTable).not.toHaveBeenCalled();
    expect(apiMock.executeQuery).not.toHaveBeenCalled();
  });

  it("resets page to 0 when changing sort", async () => {
    apiMock.executeQuery.mockResolvedValueOnce(emptyResult());
    useQueryStore.getState().setSort({ column: "created_at", direction: "desc" });

    expect(useQueryStore.getState().page).toBe(0);
  });

  it("with no filters: builds SQL with ORDER BY and calls executeQuery (not previewTable)", async () => {
    apiMock.executeQuery.mockResolvedValueOnce(emptyResult());

    useQueryStore.getState().setSort({ column: "created_at", direction: "desc" });

    // setSort triggers fetchPreviewPage asynchronously
    await new Promise((r) => setTimeout(r, 0));

    expect(apiMock.previewTable).not.toHaveBeenCalled();
    expect(apiMock.executeQuery).toHaveBeenCalledOnce();
    const sql = apiMock.executeQuery.mock.calls[0][0] as string;
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "created_at" DESC NULLS LAST LIMIT 100`
    );
  });

  it("preserves prior total_rows across sort (full-table count is unchanged)", async () => {
    apiMock.executeQuery.mockResolvedValueOnce(emptyResult({ total_rows: null, total_rows_estimated: false }));

    useQueryStore.getState().setSort({ column: "id", direction: "asc" });
    await new Promise((r) => setTimeout(r, 0));

    const result = useQueryStore.getState().result;
    expect(result?.total_rows).toBe(42);
    expect(result?.total_rows_estimated).toBe(true);
  });

  it("with active filters: routes through applyFilters (ORDER BY inside filtered SQL)", async () => {
    useQueryStore.setState({
      filters: [
        { id: "f1", column: "name", operator: "LIKE", value: "ali", enabled: true },
      ],
    });
    apiMock.executeQuery.mockResolvedValue(emptyResult());

    useQueryStore.getState().setSort({ column: "created_at", direction: "asc" });
    await new Promise((r) => setTimeout(r, 0));

    // applyFilters fires two queries: the data SELECT and a COUNT(*).
    expect(apiMock.executeQuery).toHaveBeenCalled();
    const sql = apiMock.executeQuery.mock.calls[0][0] as string;
    expect(sql).toBe(
      `SELECT * FROM "public"."users" WHERE "name"::text LIKE '%ali%' ORDER BY "created_at" ASC NULLS LAST LIMIT 100`
    );
  });

  it("clearing sort (null) when no filters falls back to fast previewTable", async () => {
    useQueryStore.setState({ sort: { column: "id", direction: "asc" } });
    apiMock.previewTable.mockResolvedValueOnce(emptyResult());

    useQueryStore.getState().setSort(null);
    await new Promise((r) => setTimeout(r, 0));

    expect(apiMock.previewTable).toHaveBeenCalledOnce();
    expect(apiMock.executeQuery).not.toHaveBeenCalled();
  });
});

describe("useQueryStore — fetchPreviewPage", () => {
  beforeEach(() => {
    useQueryStore.setState({
      tableContext: { schema: "public", table: "users" },
      result: emptyResult({ total_rows: 99, total_rows_estimated: true }),
      page: 2,
      pageSize: 25,
    });
  });

  it("without sort: uses previewTable with offset = page * pageSize", async () => {
    apiMock.previewTable.mockResolvedValueOnce(emptyResult());

    await useQueryStore.getState().fetchPreviewPage();

    expect(apiMock.previewTable).toHaveBeenCalledWith("public", "users", 25, 50);
    expect(apiMock.executeQuery).not.toHaveBeenCalled();
  });

  it("with sort: builds ORDER BY SQL with correct LIMIT/OFFSET", async () => {
    useQueryStore.setState({ sort: { column: "name", direction: "asc" } satisfies SortSpec });
    apiMock.executeQuery.mockResolvedValueOnce(emptyResult());

    await useQueryStore.getState().fetchPreviewPage();

    const sql = apiMock.executeQuery.mock.calls[0][0] as string;
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "name" ASC NULLS LAST LIMIT 25 OFFSET 50`
    );
  });

  it("with sort: drops the result if user switched table mid-flight (stale guard)", async () => {
    useQueryStore.setState({ sort: { column: "id", direction: "asc" } });
    apiMock.executeQuery.mockImplementationOnce(async () => {
      // Simulate the user navigating to a different table while the query is in-flight.
      useQueryStore.setState({ tableContext: { schema: "public", table: "orders" } });
      return emptyResult({ rows: [{ id: 1, name: "stale" }] });
    });

    await useQueryStore.getState().fetchPreviewPage();

    // The stale result must not overwrite the new tableContext's state.
    expect(useQueryStore.getState().result?.rows).toEqual([]); // still the seed result
  });

  it("does nothing if there is no tableContext", async () => {
    useQueryStore.setState({ tableContext: null });
    await useQueryStore.getState().fetchPreviewPage();
    expect(apiMock.previewTable).not.toHaveBeenCalled();
    expect(apiMock.executeQuery).not.toHaveBeenCalled();
  });
});

describe("useQueryStore — resetDataState", () => {
  it("clears sort along with other per-table state", () => {
    useQueryStore.setState({
      sort: { column: "id", direction: "desc" },
      filters: [{ id: "f1", column: "name", operator: "=", value: "x", enabled: true }],
      page: 5,
      result: emptyResult(),
      tableContext: { schema: "s", table: "t" },
    });

    useQueryStore.getState().resetDataState();

    const s = useQueryStore.getState();
    expect(s.sort).toBeNull();
    expect(s.filters).toEqual([]);
    expect(s.page).toBe(0);
    expect(s.tableContext).toBeNull();
    expect(s.result).toBeNull();
  });
});
