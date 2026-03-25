import { useState } from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Undo2,
} from "lucide-react";
import { useToolbarQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";
import { exportCsv } from "../../lib/tauri";

export function ResultsToolbar() {
  const { activeTab, setPage, setPageSize, savePendingChanges, discardPendingChanges } =
    useToolbarQuery();
  const t = useT();
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!activeTab?.result) return null;

  const { result, page, pageSize } = activeTab;
  const hasMore = result.row_count >= pageSize;

  const pendingCount = Object.values(activeTab.pendingChanges || {}).reduce(
    (sum, changes) => sum + Object.keys(changes).length,
    0
  );

  const handleExport = async () => {
    if (!activeTab.sql.trim()) return;
    setExporting(true);
    try {
      const csv = await exportCsv(activeTab.sql);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeTab.title || "query"}_results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handling
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await savePendingChanges(activeTab.id);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("NO_PRIMARY_KEY")) {
        setSaveError(t("edit.noPrimaryKey"));
      } else {
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSaveError(null);
    discardPendingChanges(activeTab.id);
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-surface text-[11px] shrink-0">
      <div className="flex items-center gap-1">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
        >
          {exporting ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Download size={11} />
          )}
          {t("results.exportCsv")}
        </button>

        {pendingCount > 0 && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
            <span className="text-accent font-medium">
              {t("edit.pendingChanges", { count: pendingCount })}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-bg-primary font-medium hover:bg-accent/90 transition-colors"
            >
              {saving ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Save size={11} />
              )}
              {saving ? t("edit.saving") : t("edit.save")}
            </button>
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
            >
              <Undo2 size={11} />
              {t("edit.discard")}
            </button>
          </div>
        )}

        {saveError && (
          <span className="ml-2 text-error text-[10px]">{saveError}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-text-faint">{t("results.rows")}</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(activeTab.id, parseInt(e.target.value))}
            className="bg-bg-primary border border-border rounded-md px-1.5 py-0.5 text-[11px] text-text-secondary focus:outline-none focus:border-border-focus cursor-pointer"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setPage(activeTab.id, page - 1)}
            disabled={page === 0}
            className="p-1 rounded-md hover:bg-bg-hover disabled:opacity-20 text-text-muted transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-text-muted px-1.5 tabular-nums min-w-[48px] text-center">
            {page + 1}
          </span>
          <button
            onClick={() => setPage(activeTab.id, page + 1)}
            disabled={!hasMore}
            className="p-1 rounded-md hover:bg-bg-hover disabled:opacity-20 text-text-muted transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
