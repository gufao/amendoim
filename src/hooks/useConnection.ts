import { useConnectionStore } from "../stores/connectionStore";
import { useSchemaStore } from "../stores/schemaStore";
import { useQueryStore } from "../stores/queryStore";
import { useQueryFileStore } from "../stores/queryFileStore";

export function useConnection() {
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connectedIds = useConnectionStore((s) => s.connectedIds);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const switchConnection = useConnectionStore((s) => s.switchConnection);
  const closeTab = useConnectionStore((s) => s.closeTab);
  const resetSchema = useSchemaStore((s) => s.reset);
  const loadSchemas = useSchemaStore((s) => s.loadSchemas);
  const resetDataState = useQueryStore((s) => s.resetDataState);
  const setActiveQueryId = useQueryStore((s) => s.setActiveQueryId);
  const setSql = useQueryStore((s) => s.setSql);
  const setActiveView = useQueryStore((s) => s.setActiveView);
  const queries = useQueryFileStore((s) => s.queries);

  const connectAndLoadSchema = async (id: string) => {
    try {
      await connect(id);
      resetSchema();
      await loadSchemas();
    } catch {
      // error is already set in the store
    }
  };

  const disconnectAndReset = async (id: string) => {
    await disconnect(id);
    resetSchema();
    resetDataState();
  };

  const switchTab = async (id: string) => {
    if (id === activeConnectionId) return;
    await switchConnection(id);
    resetSchema();
    resetDataState();
    // Restore first query for this connection
    const connQueries = queries.filter((q) => q.connectionId === id);
    if (connQueries.length > 0) {
      setActiveQueryId(connQueries[0].id);
      setSql(connQueries[0].sql);
      setActiveView("editor");
    } else {
      setActiveQueryId(null);
      setSql("");
      setActiveView("editor");
    }
    await loadSchemas();
  };

  const closeConnectionTab = async (id: string) => {
    const wasActive = id === activeConnectionId;
    await closeTab(id);
    if (wasActive) {
      const remaining = connectedIds.filter((cid) => cid !== id);
      if (remaining.length > 0) {
        resetSchema();
        resetDataState();
        const connQueries = queries.filter((q) => q.connectionId === remaining[0]);
        if (connQueries.length > 0) {
          setActiveQueryId(connQueries[0].id);
          setSql(connQueries[0].sql);
        } else {
          setActiveQueryId(null);
          setSql("");
        }
        setActiveView("editor");
        await loadSchemas();
      } else {
        resetSchema();
        resetDataState();
        setActiveQueryId(null);
        setSql("");
      }
    }
  };

  return {
    connections,
    activeConnectionId,
    connectedIds,
    isConnecting,
    deleteConnection,
    connectAndLoadSchema,
    disconnectAndReset,
    switchTab,
    closeConnectionTab,
  };
}
