import { useConnectionStore } from "../stores/connectionStore";
import { useSchemaStore } from "../stores/schemaStore";

export function useConnection() {
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const resetSchema = useSchemaStore((s) => s.reset);
  const loadSchemas = useSchemaStore((s) => s.loadSchemas);

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
  };

  return {
    connections,
    activeConnectionId,
    isConnecting,
    deleteConnection,
    connectAndLoadSchema,
    disconnectAndReset,
  };
}
