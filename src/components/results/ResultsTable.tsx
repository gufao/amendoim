import { useState, useMemo, useRef, useCallback } from "react";
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

function valueToEditString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ResultsTable() {
  const { activeTab, updateCellValue } = useQuery();
  const t = useT();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewingCell, setViewingCell] = useState<{
    column: string;
    value: unknown;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTabNavigatingRef = useRef(false);

  const result = activeTab?.result;
  const isEditable = !!activeTab?.tableContext;
  const pendingChanges = activeTab?.pendingChanges;

  const commitEdit = useCallback(() => {
    if (!editingCell || !activeTab) return;
    const newValue = editValue === "" ? null : editValue;
    updateCellValue(activeTab.id, editingCell.rowIndex, editingCell.column, newValue);
    setEditingCell(null);
  }, [editingCell, editValue, activeTab, updateCellValue]);

  const handleTabNavigation = useCallback(
    (shiftKey: boolean) => {
      if (!editingCell || !activeTab || !result) return;
      // Save current value
      const newValue = editValue === "" ? null : editValue;
      updateCellValue(activeTab.id, editingCell.rowIndex, editingCell.column, newValue);
      // Find next column
      const cols = result.columns;
      const currentIdx = cols.findIndex((c) => c.name === editingCell.column);
      const nextIdx = shiftKey ? currentIdx - 1 : currentIdx + 1;
      if (nextIdx >= 0 && nextIdx < cols.length) {
        const nextCol = cols[nextIdx].name;
        const rowData = result.rows[editingCell.rowIndex];
        const pendingVal = pendingChanges?.[editingCell.rowIndex]?.[nextCol];
        const nextValue = pendingVal !== undefined ? pendingVal : rowData?.[nextCol];
        setEditingCell({ rowIndex: editingCell.rowIndex, column: nextCol });
        setEditValue(valueToEditString(nextValue));
      } else {
        setEditingCell(null);
      }
    },
    [editingCell, editValue, activeTab, result, pendingChanges, updateCellValue]
  );

  const handleCellClick = useCallback(
    (rowIndex: number, colName: string, value: unknown) => {
      const pendingVal = pendingChanges?.[rowIndex]?.[colName];
      const displayValue = pendingVal !== undefined ? pendingVal : value;
      const isNull = displayValue === null || displayValue === undefined;

      if (isEditable) {
        clickTimeoutRef.current = setTimeout(() => {
          if (!isNull) setViewingCell({ column: colName, value: displayValue });
        }, 250);
      } else if (!isNull) {
        setViewingCell({ column: colName, value: displayValue });
      }
    },
    [isEditable, pendingChanges]
  );

  const handleCellDoubleClick = useCallback(
    (rowIndex: number, colName: string, value: unknown) => {
      if (!isEditable) return;
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      const pendingVal = pendingChanges?.[rowIndex]?.[colName];
      const currentValue = pendingVal !== undefined ? pendingVal : value;
      setEditingCell({ rowIndex, column: colName });
      setEditValue(valueToEditString(currentValue));
    },
    [isEditable, pendingChanges]
  );

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
                : "hover:text-accent transition-colors text-text-secondary"
            }`}
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
                  const isEditingThis =
                    editingCell?.rowIndex === rowIndex && editingCell?.column === colName;
                  const hasPending = !!pendingChanges?.[rowIndex]?.[colName];

                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-[6px] border-r border-border-subtle/50 ${
                        hasPending ? "bg-accent/10" : ""
                      } ${isEditable ? "cursor-pointer" : ""}`}
                      style={{
                        width: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                      onClick={() =>
                        !isEditingThis &&
                        handleCellClick(rowIndex, colName, row.original[colName])
                      }
                      onDoubleClick={() =>
                        handleCellDoubleClick(rowIndex, colName, row.original[colName])
                      }
                    >
                      {isEditingThis ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEdit();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingCell(null);
                            } else if (e.key === "Tab") {
                              e.preventDefault();
                              isTabNavigatingRef.current = true;
                              handleTabNavigation(e.shiftKey);
                            }
                          }}
                          onBlur={() => {
                            if (isTabNavigatingRef.current) {
                              isTabNavigatingRef.current = false;
                              return;
                            }
                            commitEdit();
                          }}
                          className="w-full bg-bg-primary border border-accent rounded px-1.5 py-0 text-xs font-mono outline-none text-text-primary"
                          placeholder="NULL"
                        />
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  );
                })}
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
