import { useEffect, useRef, useState } from "react";
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

function stripPaginationClauses(sql: string): string {
  // Strip trailing LIMIT/OFFSET (in either order) and trailing semicolons.
  // Repeats so `LIMIT n OFFSET m` and `OFFSET m LIMIT n` both peel off.
  let out = sql.trim().replace(/;+\s*$/, "");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/\s+OFFSET\s+\d+\s*$/i, "")
      .replace(/\s+LIMIT\s+\d+\s*$/i, "");
  }
  return out.trim();
}

export function ResultsToolbar() {
  const {
    result,
    page,
    pageSize,
    sql,
    title,
    pendingChanges,
    setPage,
    setPageSize,
    savePendingChanges,
    discardPendingChanges,
  } = useToolbarQuery();
  const t = useT();
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [exportMenuOpen]);

  if (!result) return null;

  const hasMore = result.row_count >= pageSize;

  const pendingCount = Object.values(pendingChanges || {}).reduce(
    (sum, changes) => sum + Object.keys(changes).length,
    0
  );

  const runExport = async (scope: "page" | "all") => {
    if (!sql.trim()) return;
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const sqlToRun = scope === "all" ? stripPaginationClauses(sql) : sql;
      const csv = await exportCsv(sqlToRun);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "query"}_results${scope === "all" ? "_all" : ""}.csv`;
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
      await savePendingChanges();
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
    discardPendingChanges();
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-surface text-[11px] shrink-0">
      <div className="flex items-center gap-1">
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => !exporting && setExportMenuOpen((v) => !v)}
            disabled={exporting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
          >
            {exporting ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Download size={11} />
            )}
            {exporting ? t("export.exporting") : t("results.exportCsv")}
          </button>

          {exportMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-lg bg-bg-elevated border border-border shadow-xl shadow-black/40 z-20 animate-popover-in">
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                {t("export.title")}
              </div>
              <button
                onClick={() => runExport("page")}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-text-secondary hover:bg-bg-hover transition-colors text-left"
              >
                <Download size={11} className="text-text-faint" />
                {t("export.currentPage", { count: result.row_count })}
              </button>
              <button
                onClick={() => runExport("all")}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-2 text-[11px] text-text-secondary hover:bg-bg-hover transition-colors text-left border-t border-border"
              >
                <span className="flex items-center gap-2">
                  <Download size={11} className="text-text-faint" />
                  {t("export.allRows")}
                </span>
                <span className="text-[10px] text-text-faint pl-[19px]">
                  {t("export.allRowsHint")}
                </span>
              </button>
            </div>
          )}
        </div>

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
            onChange={(e) => setPageSize(parseInt(e.target.value))}
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
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            className="p-1 rounded-md hover:bg-bg-hover disabled:opacity-20 text-text-muted transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-text-muted px-1.5 tabular-nums min-w-[48px] text-center">
            {page + 1}
          </span>
          <button
            onClick={() => setPage(page + 1)}
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
