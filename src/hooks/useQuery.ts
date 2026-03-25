import { useCallback, useMemo } from "react";
import { useQueryStore } from "../stores/queryStore";

/**
 * Granular hooks that derive activeTab from the store.
 * Each hook subscribes to the store but only exposes the fields its consumer needs,
 * keeping component APIs narrow and explicit.
 */

function useActiveTab() {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  return useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );
}

/** Active tab + actions for the SQL editor. */
export function useEditorQuery() {
  const activeTab = useActiveTab();
  const updateSql = useQueryStore((s) => s.updateSql);
  const executeQuery = useQueryStore((s) => s.executeQuery);

  const executeActiveQuery = useCallback(() => {
    if (activeTab?.id) {
      executeQuery(activeTab.id);
    }
  }, [activeTab?.id, executeQuery]);

  return { activeTab, updateSql, executeActiveQuery };
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

  const executeActiveQuery = useCallback(() => {
    if (activeTab?.id) {
      executeQuery(activeTab.id);
    }
  }, [activeTab?.id, executeQuery]);

  return { tabs, activeTabId, activeTab, setActiveTab, removeTab, addTab, executeActiveQuery };
}

/** Minimal active tab info for the status bar. */
export function useStatusQuery() {
  const activeTab = useActiveTab();
  return { activeTab };
}
