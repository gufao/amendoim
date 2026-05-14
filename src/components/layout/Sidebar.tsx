import { useCallback, useEffect, useState } from "react";
import {
  Database,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  FileCode2,
  X,
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

const SIDEBAR_WIDTH_KEY = "amendoim-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 600;

function clampWidth(n: number) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
}

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? clampWidth(n) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function Sidebar({ onNewConnection, onEditConnection }: Props) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number>(readStoredWidth);
  const [tableFilter, setTableFilter] = useState("");
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      // best-effort persistence
    }
  }, [width]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    let startWidth = 0;
    setWidth((w) => {
      startWidth = w;
      return w;
    });

    const onMouseMove = (ev: MouseEvent) => {
      setWidth(clampWidth(startWidth + (ev.clientX - startX)));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleResizeDoubleClick = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
  }, []);

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
    <div
      className="bg-bg-secondary border-r border-border flex flex-col h-full relative shrink-0"
      style={{ width: `${width}px` }}
    >
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
            <SchemaTree tableFilter={tableFilter} />
          </div>
        )}
      </div>

      {activeConnectionId && (
        <div className="border-t border-border bg-bg-secondary shrink-0 px-2 py-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
            />
            <input
              type="text"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder={t("sidebar.searchTables")}
              className="w-full bg-bg-primary border border-border rounded-md pl-7 pr-7 py-1.5 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
            />
            {tableFilter && (
              <button
                onClick={() => setTableFilter("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-hover text-text-faint hover:text-text-secondary transition-colors"
                title={t("sidebar.clearSearch")}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        onMouseDown={handleResizeStart}
        onDoubleClick={handleResizeDoubleClick}
        title={t("sidebar.resize")}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-accent/60 transition-colors z-10"
      />
    </div>
  );
}
