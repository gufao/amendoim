import { Database, Plug, Unplug, Trash2, Loader2, Pencil } from "lucide-react";
import type { ConnectionConfig } from "../../lib/tauri";
import { useT } from "../../i18n";

interface Props {
  config: ConnectionConfig;
  isActive: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function ConnectionCard({
  config,
  isActive,
  isConnecting,
  onConnect,
  onDisconnect,
  onDelete,
  onEdit,
}: Props) {
  const t = useT();
  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer transition-all ${
        isActive
          ? "bg-accent-subtle"
          : "hover:bg-bg-hover"
      }`}
      onClick={() => !isActive && onConnect()}
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
        isActive ? "bg-accent/20" : "bg-bg-elevated"
      }`}>
        <Database
          size={13}
          className={isActive ? "text-accent" : "text-text-muted"}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium truncate ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}>
          {config.name}
        </div>
        <div className="text-[10px] text-text-faint truncate">
          {config.host}:{config.port}/{config.database}
        </div>
      </div>

      {/* Status dot or actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {isActive && !isConnecting && (
          <div className="w-1.5 h-1.5 rounded-full bg-success group-hover:hidden" />
        )}
        <div className={`flex items-center gap-0.5 ${isActive ? "hidden group-hover:flex" : "hidden group-hover:flex"}`}>
          {isActive ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect();
              }}
              className="p-1 rounded-md hover:bg-bg-active/50 text-text-muted hover:text-warning transition-colors"
              title={t("connection.disconnect")}
            >
              <Unplug size={12} />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnect();
              }}
              disabled={isConnecting}
              className="p-1 rounded-md hover:bg-bg-active/50 text-text-muted hover:text-success transition-colors"
              title={t("connection.connect")}
            >
              {isConnecting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plug size={12} />
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded-md hover:bg-bg-active/50 text-text-muted hover:text-accent transition-colors"
            title={t("connection.edit")}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded-md hover:bg-bg-active/50 text-text-muted hover:text-error transition-colors"
            title={t("connection.delete")}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
