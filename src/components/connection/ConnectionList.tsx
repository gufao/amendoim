import { useConnection } from "../../hooks/useConnection";
import { ConnectionCard } from "./ConnectionCard";
import { Plus } from "lucide-react";
import { useT } from "../../i18n";

interface Props {
  onNewConnection: () => void;
}

export function ConnectionList({ onNewConnection }: Props) {
  const t = useT();
  const {
    connections,
    activeConnectionId,
    isConnecting,
    connectAndLoadSchema,
    disconnectAndReset,
    deleteConnection,
  } = useConnection();

  if (connections.length === 0) {
    return (
      <div className="px-3 py-4">
        <button
          onClick={onNewConnection}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary border border-dashed border-border hover:border-text-faint transition-colors"
        >
          <Plus size={12} />
          {t("connection.add")}
        </button>
      </div>
    );
  }

  return (
    <div className="py-0.5">
      {connections.map((conn) => (
        <ConnectionCard
          key={conn.id}
          config={conn}
          isActive={conn.id === activeConnectionId}
          isConnecting={isConnecting}
          onConnect={() => connectAndLoadSchema(conn.id)}
          onDisconnect={() => disconnectAndReset(conn.id)}
          onDelete={() => deleteConnection(conn.id)}
        />
      ))}
    </div>
  );
}
