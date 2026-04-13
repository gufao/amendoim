import { useCallback } from "react";
import { useQueryStore } from "../stores/queryStore";
import { useQueryFileStore } from "../stores/queryFileStore";
import { getSelectedText } from "../lib/editor";

/**
 * Editor hook — provides SQL and execution for the active query.
 */
export function useEditorQuery() {
  const activeQueryId = useQueryStore((s) => s.activeQueryId);
  const isExecuting = useQueryStore((s) => s.isExecuting);
  const sql = useQueryStore((s) => s.sql);
  const setSql = useQueryStore((s) => s.setSql);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const cancelQuery = useQueryStore((s) => s.cancelQuery);
  const updateQueryFile = useQueryFileStore((s) => s.updateQuery);

  const handleSqlChange = useCallback(
    (newSql: string) => {
      setSql(newSql);
      if (activeQueryId) {
        updateQueryFile(activeQueryId, { sql: newSql });
      }
    },
    [activeQueryId, setSql, updateQueryFile]
  );

  const toggleActiveQuery = useCallback(() => {
    if (isExecuting) {
      cancelQuery();
    } else {
      const selected = getSelectedText();
      executeQuery(selected || undefined);
    }
  }, [isExecuting, executeQuery, cancelQuery]);

  return {
    activeQueryId,
    sql,
    isExecuting,
    updateSql: handleSqlChange,
    executeActiveQuery: toggleActiveQuery,
  };
}

/** Active query data for the results table. */
export function useResultsQuery() {
  const result = useQueryStore((s) => s.result);
  const isExecuting = useQueryStore((s) => s.isExecuting);
  const error = useQueryStore((s) => s.error);
  const tableContext = useQueryStore((s) => s.tableContext);
  const pendingChanges = useQueryStore((s) => s.pendingChanges);
  const selectedRowIndex = useQueryStore((s) => s.selectedRowIndex);
  const page = useQueryStore((s) => s.page);
  const pageSize = useQueryStore((s) => s.pageSize);
  const updateCellValue = useQueryStore((s) => s.updateCellValue);
  const setSelectedRowIndex = useQueryStore((s) => s.setSelectedRowIndex);

  return {
    result,
    isExecuting,
    error,
    tableContext,
    pendingChanges,
    selectedRowIndex,
    page,
    pageSize,
    updateCellValue,
    setSelectedRowIndex,
  };
}

/** Active query data for the filter bar. */
export function useFilterQuery() {
  const result = useQueryStore((s) => s.result);
  const tableContext = useQueryStore((s) => s.tableContext);
  const filters = useQueryStore((s) => s.filters);
  return { result, tableContext, filters };
}

/** Active query data for the results toolbar. */
export function useToolbarQuery() {
  const result = useQueryStore((s) => s.result);
  const isExecuting = useQueryStore((s) => s.isExecuting);
  const error = useQueryStore((s) => s.error);
  const page = useQueryStore((s) => s.page);
  const pageSize = useQueryStore((s) => s.pageSize);
  const sql = useQueryStore((s) => s.sql);
  const tableContext = useQueryStore((s) => s.tableContext);
  const pendingChanges = useQueryStore((s) => s.pendingChanges);
  const setPage = useQueryStore((s) => s.setPage);
  const setPageSize = useQueryStore((s) => s.setPageSize);
  const savePendingChanges = useQueryStore((s) => s.savePendingChanges);
  const discardPendingChanges = useQueryStore((s) => s.discardPendingChanges);

  const title = useQueryFileStore((s) => {
    const activeQueryId = useQueryStore.getState().activeQueryId;
    return s.queries.find((q) => q.id === activeQueryId)?.title || "query";
  });

  return {
    result,
    isExecuting,
    error,
    page,
    pageSize,
    sql,
    title,
    tableContext,
    pendingChanges,
    setPage,
    setPageSize,
    savePendingChanges,
    discardPendingChanges,
  };
}

/** Minimal active info for the status bar. */
export function useStatusQuery() {
  const result = useQueryStore((s) => s.result);
  const isExecuting = useQueryStore((s) => s.isExecuting);
  const error = useQueryStore((s) => s.error);
  return { result, isExecuting, error };
}
