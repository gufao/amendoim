import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ArrowUp, ArrowDown, TableProperties, Loader2 } from "lucide-react";
import { useResultsQuery } from "../../hooks/useQuery";
import { useSchemaStore } from "../../stores/schemaStore";
import { useT } from "../../i18n";
import { formatCellValue, truncate } from "../../lib/format";
import { FilterBar } from "./FilterBar";
import { ResultsToolbar } from "./ResultsToolbar";
import { RowDetail } from "./RowDetail";
import { InlineEdit } from "./InlineEdit";

const ROW_HEIGHT = 30;

export function ResultsTable() {
  const {
    result,
    isExecuting,
    error,
    tableContext,
    pendingChanges,
    selectedRowIndex,
    page,
    pageSize,
    updateCellValue,
    setSelectedRowIndex,
  } = useResultsQuery();
  const t = useT();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEditable = !!tableContext;

  const schemaKey = tableContext ? `${tableContext.schema}.${tableContext.table}` : "";
  const schemaColumns = useSchemaStore(
    useCallback(
      (s) => (schemaKey ? s.columns[schemaKey] : undefined),
      [schemaKey]
    )
  ) ?? [];
  const pkColumns = useMemo(
    () => schemaColumns.filter((c) => c.is_primary_key).map((c) => c.name),
    [schemaColumns]
  );

  useEffect(() => {
    if (selectedRowIndex === null || !result) return;
    const handler = (e: KeyboardEvent) => {
      if (editingCell) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedRowIndex(Math.min(selectedRowIndex + 1, result.rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedRowIndex(Math.max(selectedRowIndex - 1, 0));
      } else if (e.key === "Escape") {
        setSelectedRowIndex(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedRowIndex, result, editingCell, setSelectedRowIndex]);

  const handleRowClick = useCallback(
    (rowIndex: number) => {
      setSelectedRowIndex(rowIndex);
      setEditingCell(null);
    },
    [setSelectedRowIndex]
  );

  const handleCellDoubleClick = useCallback(
    (rowIndex: number, column: string) => {
      if (!isEditable) return;
      setEditingCell({ rowIndex, column });
    },
    [isEditable]
  );

  const handleInlineEditSave = useCallback(
    (rowIndex: number, column: string, newValue: unknown) => {
      updateCellValue(rowIndex, column, newValue);
      setEditingCell(null);
    },
    [updateCellValue]
  );

  const handleInlineEditTab = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!result) return;
      const nextCol = result.columns[colIndex + 1];
      if (nextCol) {
        setEditingCell({ rowIndex, column: nextCol.name });
      } else {
        setEditingCell(null);
      }
    },
    [result]
  );

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!result?.columns) return [];
    return result.columns.map((col, colIndex) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info) => {
        const rowIndex = info.row.index;
        const originalValue = info.getValue();
        const pendingVal = pendingChanges?.[rowIndex]?.[col.name];
        const hasPending = pendingVal !== undefined;
        const value = hasPending ? pendingVal : originalValue;
        const isNull = value === null || value === undefined;
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === col.name;

        if (isEditing) {
          return (
            <InlineEdit
              value={value}
              onSave={(newVal) => handleInlineEditSave(rowIndex, col.name, newVal)}
              onCancel={() => setEditingCell(null)}
              onTab={() => handleInlineEditTab(rowIndex, colIndex)}
            />
          );
        }

        const formatted = formatCellValue(value);
        return (
          <span
            className={`block truncate ${
              isNull ? "text-text-faint italic" : "text-text-secondary"
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleCellDoubleClick(rowIndex, col.name);
            }}
          >
            {isNull ? t("results.null") : truncate(formatted, 80)}
          </span>
        );
      },
      size: Math.max(120, Math.min(300, col.name.length * 9 + 60)),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t and callbacks are stable enough; including them causes infinite re-render via useReactTable
  }, [result?.columns, pendingChanges, editingCell]);

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

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const selectedRowData = selectedRowIndex !== null ? result?.rows[selectedRowIndex] : null;

  if (!result) {
    if (isExecuting) {
      return (
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-text-muted">{t("results.executing")}</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-start p-4 bg-bg-primary overflow-auto">
          <div className="w-full rounded-lg border border-error/20 bg-error-muted p-4 animate-fade-in">
            <div className="text-xs font-semibold text-error mb-2">{t("results.error")}</div>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono leading-relaxed select-text">
              {error}
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
        {error ? (
          <div className="px-4 pt-2 overflow-auto flex-1">
            <div className="rounded-lg border border-error/20 bg-error-muted p-3 animate-fade-in">
              <div className="text-xs font-semibold text-error mb-1">{t("results.error")}</div>
              <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono leading-relaxed select-text">
                {error}
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

      {error ? (
        <div className="flex-1 flex items-start p-4 overflow-auto">
          <div className="w-full rounded-lg border border-error/20 bg-error-muted p-3 animate-fade-in">
            <div className="text-xs font-semibold text-error mb-1">{t("results.error")}</div>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono leading-relaxed select-text">
              {error}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-auto relative min-w-0">
            {isExecuting && (
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
                {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                  <tr>
                    <td style={{ height: virtualItems[0].start }} colSpan={columns.length + 1} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const i = virtualRow.index;
                  const isSelected = i === selectedRowIndex;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-border-subtle transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-accent/10 border-l-2 border-l-accent"
                          : "hover:bg-bg-hover/50"
                      }`}
                      onClick={() => handleRowClick(i)}
                    >
                      <td className="px-3 py-[6px] text-right text-text-faint text-[10px] bg-bg-surface border-r border-border-subtle">
                        {(page || 0) * (pageSize || 100) + i + 1}
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
                  );
                })}
                {virtualItems.length > 0 && (
                  <tr>
                    <td
                      style={{ height: virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end }}
                      colSpan={columns.length + 1}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedRowIndex !== null && selectedRowData && result.columns && (
            <RowDetail
              rowIndex={selectedRowIndex}
              rowData={selectedRowData}
              columns={result.columns}
              pkColumns={pkColumns}
              onClose={() => setSelectedRowIndex(null)}
            />
          )}
        </div>
      )}

    </div>
  );
}
