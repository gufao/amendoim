import { X, Plus, Play, Square, Loader2, FileCode2 } from "lucide-react";
import { useTabsQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";

export function TopBar() {
  const t = useT();
  const { tabs, activeTabId, setActiveTab, removeTab, addTab, executeActiveQuery, cancelActiveQuery, activeTab } =
    useTabsQuery();

  const isExecuting = activeTab?.isExecuting ?? false;

  return (
    <div className="h-10 bg-bg-secondary border-b border-border flex items-center shrink-0">
      {/* Tabs */}
      <div className="flex-1 flex items-end h-full overflow-x-auto gap-px pl-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`group relative flex items-center gap-1.5 px-3 h-[34px] mt-auto cursor-pointer text-xs transition-colors rounded-t-lg ${
                isActive
                  ? "bg-bg-primary text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover/50"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <FileCode2 size={12} className={isActive ? "text-accent" : "text-text-faint"} />
              <span className="max-w-28 truncate">{tab.title}</span>
              {tab.isExecuting && (
                <Loader2 size={10} className="animate-spin text-accent" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className={`p-0.5 rounded transition-opacity ${
                  isActive
                    ? "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                    : "opacity-0 group-hover:opacity-100 text-text-faint hover:text-text-secondary hover:bg-bg-active"
                }`}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => addTab()}
          className="p-1.5 mx-1 my-auto rounded-md hover:bg-bg-hover text-text-faint hover:text-text-secondary transition-colors"
          title={t("topBar.newQuery")}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Run / Stop button */}
      <div className="flex items-center px-3 gap-2 shrink-0">
        <div className="text-[10px] text-text-faint hidden sm:block">
          {"\u2318"}Enter
        </div>
        {isExecuting ? (
          <button
            onClick={cancelActiveQuery}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-medium bg-error hover:bg-error/80 text-white transition-all active:scale-[0.97] shadow-sm"
            title={t("topBar.cancelQuery")}
          >
            <Square size={13} fill="currentColor" />
            <span>{t("topBar.stop")}</span>
          </button>
        ) : (
          <button
            onClick={executeActiveQuery}
            disabled={!activeTab || !activeTab.sql.trim()}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm shadow-accent/20"
            title={t("topBar.executeQuery")}
          >
            <Play size={13} fill="currentColor" />
            <span>{t("topBar.run")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
