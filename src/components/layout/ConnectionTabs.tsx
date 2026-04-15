import { useState } from "react";
import { X, Plus } from "lucide-react";
import { useConnection } from "../../hooks/useConnection";
import { useT } from "../../i18n";

interface Props {
  onNewConnection: () => void;
}

export function ConnectionTabs({ onNewConnection }: Props) {
  const t = useT();
  const {
    connections,
    activeConnectionId,
    connectedIds,
    switchTab,
    closeConnectionTab,
  } = useConnection();

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  if (connectedIds.length === 0) return null;

  const connectedConnections = connectedIds
    .map((id) => connections.find((c) => c.id === id))
    .filter(Boolean) as typeof connections;

  return (
    <div className="h-9 bg-bg-secondary border-b border-border flex items-center px-1 gap-0.5 select-none shrink-0 overflow-x-auto">
      <div className="flex items-center gap-0.5 min-w-0">
        {connectedConnections.map((conn) => {
          const isActive = conn.id === activeConnectionId;
          const isHovered = conn.id === hoveredTab;

          return (
            <button
              key={conn.id}
              className={`group relative flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all duration-150 max-w-[180px] min-w-0 ${
                isActive
                  ? "bg-bg-primary text-text-primary shadow-sm shadow-black/10"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              }`}
              onClick={() => switchTab(conn.id)}
              onMouseEnter={() => setHoveredTab(conn.id)}
              onMouseLeave={() => setHoveredTab(null)}
              title={`${conn.host}:${conn.port}/${conn.database}`}
            >
              <div
                className={`w-[6px] h-[6px] rounded-full shrink-0 transition-colors ${
                  isActive ? "bg-success" : "bg-text-faint"
                }`}
              />
              <span className="truncate">{conn.name}</span>
              <span
                className={`ml-auto pl-1 shrink-0 p-0.5 rounded transition-all ${
                  isHovered || isActive
                    ? "opacity-100"
                    : "opacity-0"
                } hover:bg-bg-active`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeConnectionTab(conn.id);
                }}
              >
                <X size={10} />
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNewConnection}
        className="shrink-0 p-1.5 rounded-md text-text-faint hover:text-text-muted hover:bg-bg-hover transition-colors ml-1"
        title={t("sidebar.newConnection")}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
