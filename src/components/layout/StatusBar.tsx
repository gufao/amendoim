import { Clock, Rows3, Zap, Globe, Bot } from "lucide-react";
import { useConnectionStore } from "../../stores/connectionStore";
import { useMcpStore } from "../../stores/mcpStore";
import { useStatusQuery } from "../../hooks/useQuery";
import { formatDuration, formatRowCount } from "../../lib/format";
import { useT, useI18nStore, type Locale } from "../../i18n";

export function StatusBar({
  onOpenMcp,
}: {
  onOpenMcp: () => void;
}) {
  const t = useT();
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const { activeTab } = useStatusQuery();
  const mcpIsRunning = useMcpStore((s) => s.isRunning);

  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const result = activeTab?.result;

  return (
    <div className="h-7 bg-bg-secondary border-t border-border flex items-center px-3 text-[11px] text-text-muted select-none gap-3">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-[6px] h-[6px] rounded-full ring-2 ${
              activeConn
                ? "bg-success ring-success-muted"
                : "bg-text-faint ring-bg-primary"
            }`}
          />
          <span className="font-medium">
            {activeConn ? activeConn.name : t("connection.disconnected")}
          </span>
        </div>
        {activeConn && (
          <span className="text-text-faint">
            {activeConn.host}:{activeConn.port}/{activeConn.database}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Query stats */}
      {result && (
        <div className="flex items-center gap-3">
          {result.affected_rows !== null && result.affected_rows > 0 && (
            <div className="flex items-center gap-1">
              <Zap size={10} />
              <span>{t("status.affected", { count: result.affected_rows })}</span>
            </div>
          )}
          {result.row_count > 0 && (
            <div className="flex items-center gap-1">
              <Rows3 size={10} />
              <span>
                {result.total_rows !== null && result.total_rows !== undefined
                  ? t("status.rowsOfTotal", { count: formatRowCount(result.row_count), total: formatRowCount(result.total_rows) })
                  : t("status.rows", { count: formatRowCount(result.row_count) })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 text-text-faint">
            <Clock size={10} />
            <span>{formatDuration(result.execution_time_ms)}</span>
          </div>
        </div>
      )}

      {activeTab?.error && (
        <div className="flex items-center gap-1 text-error">
          <span className="w-1.5 h-1.5 rounded-full bg-error" />
          <span className="truncate max-w-xs">{activeTab.error}</span>
        </div>
      )}

      {/* MCP toggle */}
      <button
        onClick={onOpenMcp}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
          mcpIsRunning
            ? "text-accent bg-accent-subtle border-accent/30"
            : "text-text-faint hover:text-text-muted border-transparent hover:border-border"
        }`}
      >
        <Bot size={10} />
        {t("mcp.statusBar")}
        {mcpIsRunning && (
          <span className="w-1 h-1 rounded-full bg-success" />
        )}
      </button>

      {/* Language switcher */}
      <LanguageSwitcher />
    </div>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale } = useI18nStore();
  const options: { value: Locale; label: string }[] = [
    { value: "pt-BR", label: "PT" },
    { value: "en", label: "EN" },
  ];

  return (
    <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
      <Globe size={10} className="text-text-faint" />
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`px-1 py-0.5 rounded text-[10px] font-medium transition-colors ${
            locale === opt.value
              ? "text-accent bg-accent-subtle"
              : "text-text-faint hover:text-text-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
