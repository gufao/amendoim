import { useState } from "react";
import {
  Database,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  FileCode2,
} from "lucide-react";
import { ConnectionList } from "../connection/ConnectionList";
import { SchemaTree } from "../schema/SchemaTree";
import { QueryList } from "../sidebar/QueryList";
import { useConnectionStore } from "../../stores/connectionStore";
import type { ConnectionConfig } from "../../lib/tauri";
import { useT } from "../../i18n";

interface Props {
  onNewConnection: () => void;
  onEditConnection: (config: ConnectionConfig) => void;
}

export function Sidebar({ onNewConnection, onEditConnection }: Props) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  if (collapsed) {
    return (
      <div className="w-12 bg-bg-secondary border-r border-border flex flex-col items-center pt-2 gap-1">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          title={t("sidebar.expand")}
        >
          <PanelLeftOpen size={16} />
        </button>
        <div className="w-6 h-px bg-border my-1" />
        <button
          onClick={onNewConnection}
          className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          title={t("sidebar.newConnection")}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 bg-bg-secondary border-r border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
          {t("sidebar.explorer")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onNewConnection}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={t("sidebar.newConnection")}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={t("sidebar.collapse")}
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          <div className="px-3 py-2 flex items-center gap-1.5">
            <Database size={11} className="text-text-muted" />
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {t("sidebar.connections")}
            </span>
            {connections.length > 0 && (
              <span className="text-[10px] text-text-faint ml-auto tabular-nums">
                {connections.length}
              </span>
            )}
          </div>
          <ConnectionList onNewConnection={onNewConnection} onEditConnection={onEditConnection} />
        </div>

        {activeConnectionId && (
          <div className="border-t border-border">
            <div className="px-3 py-2 flex items-center gap-1.5">
              <FileCode2 size={11} className="text-text-muted" />
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {t("sidebar.queries")}
              </span>
            </div>
            <QueryList />
          </div>
        )}

        {activeConnectionId && (
          <div className="border-t border-border">
            <div className="px-3 py-2 flex items-center gap-1.5">
              <Search size={11} className="text-text-muted" />
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {activeConn?.database || t("schema.browser")}
              </span>
            </div>
            <SchemaTree />
          </div>
        )}
      </div>
    </div>
  );
}
