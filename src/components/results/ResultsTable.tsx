import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, TableProperties } from "lucide-react";
import { useQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";
import { formatCellValue, truncate } from "../../lib/format";
import { CellViewer } from "./CellViewer";
import { FilterBar } from "./FilterBar";
import { ResultsToolbar } from "./ResultsToolbar";

export function ResultsTable() {
  const { activeTab } = useQuery();
  const t = useT();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewingCell, setViewingCell] = useState<{
    column: string;
    value: unknown;
  } | null>(null);

  const result = activeTab?.result;

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!result?.columns) return [];
    return result.columns.map((col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info) => {
        const value = info.getValue();
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
              if (!isNull) setViewingCell({ column: col.name, value });
            }}
          >
            {isNull ? t("results.null") : truncate(formatted, 80)}
          </span>
        );
      },
      size: Math.max(120, Math.min(300, col.name.length * 9 + 60)),
    }));
  }, [result?.columns]);

  const data = useMemo(() => result?.rows || [], [result?.rows]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!activeTab) return null;

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

  if (!result) {
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
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-xs text-text-faint">{t("results.noRows")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <FilterBar />
      <ResultsToolbar />

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="bg-bg-tertiary border-b border-border px-3 py-2 text-right font-medium text-text-faint w-12 text-[10px]">
                  #
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="bg-bg-tertiary border-b border-border px-3 py-2 text-left font-semibold text-text-muted cursor-pointer hover:bg-bg-hover select-none transition-colors group"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
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
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-[6px] border-r border-border-subtle/50"
                    style={{ maxWidth: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingCell && (
        <CellViewer
          column={viewingCell.column}
          value={viewingCell.value}
          onClose={() => setViewingCell(null)}
        />
      )}
    </div>
  );
}
