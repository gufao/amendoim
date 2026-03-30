import { useCallback, useMemo } from "react";
import { useQueryStore, type QueryTab } from "../stores/queryStore";

/**
 * Shared hook that derives the active tab with a stability optimization:
 * only triggers a re-render when the tab's content actually changes
 * (by comparing individual fields), not when unrelated tabs change.
 *
 * The `fields` parameter controls which tab fields are compared — if only
 * those fields changed, the consumer re-renders; changes to other fields
 * are ignored.
 */
function useActiveTab(): QueryTab | null {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  return useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );
}

/**
 * Editor hook — only needs sql/id from the active tab.
 * Uses a ref to avoid re-renders when non-sql fields change.
 */
export function useEditorQuery() {
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const isExecuting = useQueryStore((s) => {
    if (!s.activeTabId) return false;
    return s.tabs.find((t) => t.id === s.activeTabId)?.isExecuting ?? false;
  });
  const sql = useQueryStore((s) => {
    if (!s.activeTabId) return "";
    return s.tabs.find((t) => t.id === s.activeTabId)?.sql ?? "";
  });
  const updateSql = useQueryStore((s) => s.updateSql);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const cancelQuery = useQueryStore((s) => s.cancelQuery);

  const toggleActiveQuery = useCallback(() => {
    if (!activeTabId) return;
    if (isExecuting) {
      cancelQuery(activeTabId);
    } else {
      executeQuery(activeTabId);
    }
  }, [activeTabId, isExecuting, executeQuery, cancelQuery]);

  return {
    activeTab: activeTabId ? { id: activeTabId, sql } : null,
    updateSql,
    executeActiveQuery: toggleActiveQuery,
  };
}

/** Active tab data for the results table. */
export function useResultsQuery() {
  const activeTab = useActiveTab();
  const updateCellValue = useQueryStore((s) => s.updateCellValue);
  return { activeTab, updateCellValue };
}

/** Active tab data for the filter bar. */
export function useFilterQuery() {
  const activeTab = useActiveTab();
  return { activeTab };
}

/** Active tab data for the results toolbar. */
export function useToolbarQuery() {
  const activeTab = useActiveTab();
  const setPage = useQueryStore((s) => s.setPage);
  const setPageSize = useQueryStore((s) => s.setPageSize);
  const savePendingChanges = useQueryStore((s) => s.savePendingChanges);
  const discardPendingChanges = useQueryStore((s) => s.discardPendingChanges);
  return { activeTab, setPage, setPageSize, savePendingChanges, discardPendingChanges };
}

/** Tab list + actions for the top bar. */
export function useTabsQuery() {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const activeTab = useActiveTab();
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const removeTab = useQueryStore((s) => s.removeTab);
  const addTab = useQueryStore((s) => s.addTab);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const cancelQuery = useQueryStore((s) => s.cancelQuery);

  const executeActiveQuery = useCallback(() => {
    if (activeTab?.id) {
      executeQuery(activeTab.id);
    }
  }, [activeTab?.id, executeQuery]);

  const cancelActiveQuery = useCallback(() => {
    if (activeTab?.id) {
      cancelQuery(activeTab.id);
    }
  }, [activeTab?.id, cancelQuery]);

  return { tabs, activeTabId, activeTab, setActiveTab, removeTab, addTab, executeActiveQuery, cancelActiveQuery };
}

/** Minimal active tab info for the status bar. */
export function useStatusQuery() {
  const activeTab = useActiveTab();
  return { activeTab };
}
