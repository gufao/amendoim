import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, TableProperties, Loader2 } from "lucide-react";
import { useResultsQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";
import { formatCellValue, truncate } from "../../lib/format";
import { CellViewer } from "./CellViewer";
import { FilterBar } from "./FilterBar";
import { ResultsToolbar } from "./ResultsToolbar";

export function ResultsTable() {
  const { activeTab, updateCellValue } = useResultsQuery();
  const t = useT();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewingCell, setViewingCell] = useState<{
    column: string;
    value: unknown;
    rowIndex: number;
  } | null>(null);

  const result = activeTab?.result;
  const isEditable = !!activeTab?.tableContext;
  const pendingChanges = activeTab?.pendingChanges;

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!result?.columns) return [];
    return result.columns.map((col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info) => {
        const rowIndex = info.row.index;
        const originalValue = info.getValue();
        const pendingVal = pendingChanges?.[rowIndex]?.[col.name];
        const hasPending = pendingVal !== undefined;
        const value = hasPending ? pendingVal : originalValue;
        const formatted = formatCellValue(value);
        const isNull = value === null || value === undefined;

        return (
          <span
            className={`block truncate ${
              isNull
                ? "text-text-faint italic"
                : "cursor-pointer hover:text-accent transition-colors text-text-secondary"
            }`}
            onClick={() => {
              if (!isNull) {
                setViewingCell({ column: col.name, value, rowIndex });
              }
            }}
          >
            {isNull ? t("results.null") : truncate(formatted, 80)}
          </span>
        );
      },
      size: Math.max(120, Math.min(300, col.name.length * 9 + 60)),
    }));
  }, [result?.columns, pendingChanges, t]);

  const data = useMemo(() => result?.rows || [], [result?.rows]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
  });

  if (!activeTab) return null;

  // No previous result — show full-page states
  if (!result) {
    if (activeTab.isExecuting) {
      return (
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-text-muted">{t("results.executing")}</span>
          </div>
        </div>
      );
    }

    if (activeTab.error) {
      return (
        <div className="flex-1 flex items-start p-4 bg-bg-primary">
          <div className="w-full rounded-lg border border-error/20 bg-error-muted p-4 animate-fade-in">
            <div className="text-xs font-semibold text-error mb-2">{t("results.error")}</div>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
              {activeTab.error}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-2 text-text-faint">
          <TableProperties size={20} />
          <span className="text-xs">{t("results.empty")}</span>
        </div>
      </div>
    );
  }

  if (result.affected_rows !== null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success-muted text-success text-xs font-medium animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t("results.rowsAffected", { count: result.affected_rows })}
        </div>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <FilterBar />
        {activeTab.error ? (
          <div className="px-4 pt-2">
            <div className="rounded-lg border border-error/20 bg-error-muted p-3 animate-fade-in">
              <div className="text-xs font-semibold text-error mb-1">{t("results.error")}</div>
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                {activeTab.error}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-xs text-text-faint">{t("results.noRows")}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <FilterBar />
      <ResultsToolbar />

      {activeTab.error ? (
        <div className="flex-1 flex items-start p-4">
          <div className="w-full rounded-lg border border-error/20 bg-error-muted p-3 animate-fade-in">
            <div className="text-xs font-semibold text-error mb-1">{t("results.error")}</div>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
              {activeTab.error}
            </pre>
          </div>
        </div>
      ) : (
      <div className="flex-1 overflow-auto relative">
        {/* Loading overlay — keeps table visible underneath */}
        {activeTab.isExecuting && (
          <div className="absolute inset-0 z-20 bg-bg-primary/60 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 size={14} className="animate-spin text-accent" />
              {t("results.executing")}
            </div>
          </div>
        )}

        <table
          className="border-collapse text-xs tabular-nums"
          style={{ width: table.getCenterTotalSize() }}
        >
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="bg-bg-tertiary border-b border-border px-3 py-2 text-right font-medium text-text-faint w-12 text-[10px]">
                  #
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="bg-bg-tertiary border-b border-border px-3 py-2 text-left font-semibold text-text-muted select-none transition-colors group relative"
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="truncate">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      <span className="shrink-0">
                        {{
                          asc: <ArrowUp size={11} className="text-accent" />,
                          desc: <ArrowDown size={11} className="text-accent" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ArrowUpDown size={11} className="text-text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </span>
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-[3px] cursor-col-resize select-none touch-none ${
                        header.column.getIsResizing()
                          ? "bg-accent"
                          : "opacity-0 group-hover:opacity-100 bg-border hover:bg-accent/60"
                      }`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className="border-b border-border-subtle hover:bg-bg-hover/50 transition-colors"
              >
                <td className="px-3 py-[6px] text-right text-text-faint text-[10px] bg-bg-surface border-r border-border-subtle">
                  {(activeTab?.page || 0) * (activeTab?.pageSize || 100) + i + 1}
                </td>
                {row.getVisibleCells().map((cell) => {
                  const rowIndex = row.index;
                  const colName = cell.column.id;
                  const hasPending = !!pendingChanges?.[rowIndex]?.[colName];

                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-[6px] border-r border-border-subtle/50 ${
                        hasPending ? "bg-accent/10" : ""
                      }`}
                      style={{
                        width: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {viewingCell && (
        <CellViewer
          column={viewingCell.column}
          value={viewingCell.value}
          editable={isEditable}
          onClose={() => setViewingCell(null)}
          onSave={
            isEditable
              ? (newValue) => {
                  updateCellValue(activeTab.id, viewingCell.rowIndex, viewingCell.column, newValue);
                  setViewingCell(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
