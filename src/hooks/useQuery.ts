import { useCallback } from "react";
import { useQueryStore } from "../stores/queryStore";

export function useQuery() {
  const store = useQueryStore();

  const activeTab = store.tabs.find((t) => t.id === store.activeTabId) || null;

  const executeActiveQuery = useCallback(() => {
    if (store.activeTabId) {
      store.executeQuery(store.activeTabId);
    }
  }, [store.activeTabId]);

  return {
    ...store,
    activeTab,
    executeActiveQuery,
  };
}
