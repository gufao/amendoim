import { useState } from "react";
import { X, Check } from "lucide-react";
import { formatCellValue } from "../../lib/format";
import { useT } from "../../i18n";

interface Props {
  rowIndex: number;
  rowData: Record<string, unknown>;
  columns: { name: string; data_type: string }[];
  pkColumns: string[];
  onClose: () => void;
}

export function RowDetail({ rowIndex, rowData, columns, pkColumns, onClose }: Props) {
  const t = useT();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (column: string, value: unknown) => {
    const text = formatCellValue(value);
    await navigator.clipboard.writeText(text);
    setCopiedField(column);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const isJson = (value: unknown): boolean => {
    if (typeof value === "object" && value !== null) return true;
    if (typeof value === "string") {
      try { JSON.parse(value); return true; } catch { return false; }
    }
    return false;
  };

  return (
    <div className="w-[280px] bg-bg-secondary border-l border-border flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-accent">
          {t("rowDetail.title", { row: String(rowIndex + 1) })}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title={t("rowDetail.close")}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {columns.map((col) => {
          const value = rowData[col.name];
          const isNull = value === null || value === undefined;
          const isPk = pkColumns.includes(col.name);
          const isJsonVal = !isNull && isJson(value);
          const isCopied = copiedField === col.name;

          return (
            <div
              key={col.name}
              className="px-4 py-2.5 border-b border-border-subtle/30 cursor-pointer hover:bg-bg-hover/50 transition-colors"
              onClick={() => handleCopy(col.name, value)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] uppercase text-text-muted tracking-wide">
                  {col.name}
                </span>
                {isPk && (
                  <span className="text-[9px] font-bold text-warning px-1 rounded bg-warning/10">
                    PK
                  </span>
                )}
                {isJsonVal && (
                  <span className="text-[9px] font-bold text-table-icon px-1 rounded bg-table-icon/10">
                    JSON
                  </span>
                )}
                {isCopied && (
                  <span className="text-[9px] text-success ml-auto flex items-center gap-0.5">
                    <Check size={9} />
                    {t("rowDetail.copied")}
                  </span>
                )}
              </div>
              <div className={`text-[13px] leading-relaxed break-words ${
                isNull ? "text-text-faint italic" : ""
              }`}>
                {isNull ? (
                  "NULL"
                ) : isJsonVal ? (
                  <pre className="text-xs font-mono bg-bg-primary/50 rounded p-2 whitespace-pre-wrap">
                    {typeof value === "object" ? JSON.stringify(value, null, 2) : JSON.stringify(JSON.parse(value as string), null, 2)}
                  </pre>
                ) : (
                  <span className="text-text-primary">{formatCellValue(value)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
