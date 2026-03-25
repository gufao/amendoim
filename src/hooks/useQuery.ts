import { useCallback } from "react";
import { useQueryStore, type QueryTab } from "../stores/queryStore";
import { useShallow } from "zustand/shallow";

/** Derives the active tab from store state. */
function selectActiveTab(s: { tabs: QueryTab[]; activeTabId: string | null }) {
  return s.tabs.find((t) => t.id === s.activeTabId) || null;
}

/**
 * Granular selector hooks — each component should use only the slice it needs
 * so that unrelated store changes don't trigger re-renders.
 */

/** Active tab + actions for the SQL editor. */
export function useEditorQuery() {
  const activeTab = useQueryStore(selectActiveTab);
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
  const activeTab = useQueryStore(selectActiveTab);
  const updateCellValue = useQueryStore((s) => s.updateCellValue);
  return { activeTab, updateCellValue };
}

/** Active tab data for the filter bar. */
export function useFilterQuery() {
  const activeTab = useQueryStore(selectActiveTab);
  return { activeTab };
}

/** Active tab data for the results toolbar. */
export function useToolbarQuery() {
  const activeTab = useQueryStore(selectActiveTab);
  const setPage = useQueryStore((s) => s.setPage);
  const setPageSize = useQueryStore((s) => s.setPageSize);
  const savePendingChanges = useQueryStore((s) => s.savePendingChanges);
  const discardPendingChanges = useQueryStore((s) => s.discardPendingChanges);
  return { activeTab, setPage, setPageSize, savePendingChanges, discardPendingChanges };
}

/** Tab list + actions for the top bar. */
export function useTabsQuery() {
  const tabs = useQueryStore(
    useShallow((s) =>
      s.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        isExecuting: t.isExecuting,
      }))
    )
  );
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const activeTab = useQueryStore(selectActiveTab);
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
  const activeTab = useQueryStore(selectActiveTab);
  return { activeTab };
}
