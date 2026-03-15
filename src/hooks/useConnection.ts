import { useConnectionStore } from "../stores/connectionStore";
import { useSchemaStore } from "../stores/schemaStore";

export function useConnection() {
  const store = useConnectionStore();
  const schemaStore = useSchemaStore();

  const connectAndLoadSchema = async (id: string) => {
    await store.connect(id);
    schemaStore.reset();
    await schemaStore.loadSchemas();
  };

  const disconnectAndReset = async (id: string) => {
    await store.disconnect(id);
    schemaStore.reset();
  };

  return {
    ...store,
    connectAndLoadSchema,
    disconnectAndReset,
  };
}
