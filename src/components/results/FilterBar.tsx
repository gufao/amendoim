import { useRef, useState, useEffect } from "react";
import { Plus, X, Search, Code2, Copy, Check } from "lucide-react";
import { useQueryStore, FILTER_OPERATORS, ANY_COLUMN_OPERATORS, ANY_COLUMN_VALUE, buildFilteredSql } from "../../stores/queryStore";
import { useFilterQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";

const OPERATOR_LABEL_KEYS: Record<string, string> = {
  "=": "filter.op.equals",
  "!=": "filter.op.notEquals",
  ">": "filter.op.greaterThan",
  ">=": "filter.op.greaterOrEqual",
  "<": "filter.op.lessThan",
  "<=": "filter.op.lessOrEqual",
  "LIKE": "filter.op.contains",
  "NOT LIKE": "filter.op.notContains",
  "IS NULL": "filter.op.isNull",
  "IS NOT NULL": "filter.op.isNotNull",
};

function FilterValueInput({
  value,
  onChange,
  onApply,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  placeholder: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onChange(local);
          setTimeout(onApply, 0);
        }
      }}
      placeholder={placeholder}
      className="filter-input flex-1 min-w-[80px] max-w-[200px]"
    />
  );
}

function SqlPreview({
  schema,
  table,
  filters,
  columns,
}: {
  schema: string;
  table: string;
  filters: import("../../stores/queryStore").Filter[];
  columns: { name: string }[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const allColumnNames = columns.map((c) => c.name);
  const sql = buildFilteredSql(schema, table, filters, 1000, allColumnNames);

  // Format SQL for readability
  const formatted = sql
    .replace(/ WHERE /i, "\nWHERE ")
    .replace(/ AND /gi, "\n  AND ")
    .replace(/ OR /gi, "\n   OR ")
    .replace(/ LIMIT /i, "\nLIMIT ");

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
          open
            ? "bg-accent-subtle text-accent"
            : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
        }`}
        title={t("filter.previewSql")}
      >
        <Code2 size={11} />
        SQL
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-[480px] bg-bg-elevated border border-border rounded-lg shadow-2xl shadow-black/40 animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-[11px] font-medium text-text-secondary">{t("filter.previewSql")}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            >
              {copied ? (
                <>
                  <Check size={10} className="text-success" />
                  {t("filter.copiedSql")}
                </>
              ) : (
                <>
                  <Copy size={10} />
                  {t("cellViewer.copy")}
                </>
              )}
            </button>
          </div>
          <pre className="px-3 py-2.5 text-xs font-mono text-accent leading-relaxed whitespace-pre-wrap break-all overflow-auto max-h-[200px]">
            {formatted}
          </pre>
        </div>
      )}
    </div>
  );
}

export function FilterBar() {
  const { result, tableContext, filters } = useFilterQuery();
  const addFilter = useQueryStore((s) => s.addFilter);
  const updateFilter = useQueryStore((s) => s.updateFilter);
  const removeFilter = useQueryStore((s) => s.removeFilter);
  const applyFilters = useQueryStore((s) => s.applyFilters);
  const t = useT();
  const columnsRef = useRef(result?.columns ?? []);

  if (result?.columns?.length) {
    columnsRef.current = result.columns;
  }

  const columns = columnsRef.current;

  if (!tableContext || !columns.length) return null;
  const hasFilters = filters.length > 0;

  const handleApply = () => {
    applyFilters();
  };

  const needsValue = (op: string) => op !== "IS NULL" && op !== "IS NOT NULL";

  const getOperators = (column: string) => {
    if (column === ANY_COLUMN_VALUE) return ANY_COLUMN_OPERATORS;
    return FILTER_OPERATORS;
  };

  return (
    <div className="border-b border-border bg-bg-surface px-3 py-2 shrink-0">
      {filters.map((filter, i) => {
        const operators = getOperators(filter.column);

        return (
          <div key={filter.id} className="flex items-center gap-2 mb-1.5 last:mb-0 animate-fade-in">
            <span className="text-[10px] font-mono text-text-faint w-10 text-right shrink-0">
              {i === 0 ? t("filter.where") : t("filter.and")}
            </span>

            <select
              value={filter.column}
              onChange={(e) => {
                const newCol = e.target.value;
                const newOps = getOperators(newCol);
                const updates: Record<string, string> = { column: newCol };
                if (!newOps.some((op) => op.value === filter.operator)) {
                  updates.operator = newOps[0].value;
                }
                updateFilter(filter.id, updates);
              }}
              className={`filter-select flex-1 min-w-[100px] max-w-[160px] ${
                filter.column === ANY_COLUMN_VALUE ? "italic text-accent" : ""
              }`}
            >
              <option value={ANY_COLUMN_VALUE} className="italic">
                {t("filter.anyColumn")}
              </option>
              <optgroup label={t("filter.columns")}>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name}
                  </option>
                ))}
              </optgroup>
            </select>

            <select
              value={filter.operator}
              onChange={(e) =>
                updateFilter(filter.id, { operator: e.target.value })
              }
              className="filter-select w-[110px]"
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {OPERATOR_LABEL_KEYS[op.value] ? t(OPERATOR_LABEL_KEYS[op.value] as any) : op.label}
                </option>
              ))}
            </select>

            {needsValue(filter.operator) && (
              <FilterValueInput
                value={filter.value}
                onChange={(v) => updateFilter(filter.id, { value: v })}
                onApply={handleApply}
                placeholder={t("filter.value")}
              />
            )}

            <button
              onClick={() => {
                updateFilter(filter.id, { enabled: !filter.enabled });
                setTimeout(() => applyFilters(), 0);
              }}
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                filter.enabled
                  ? "bg-accent-subtle text-accent"
                  : "bg-bg-primary text-text-faint"
              }`}
              title={filter.enabled ? t("filter.disable") : t("filter.enable")}
            >
              {filter.enabled ? t("filter.on") : t("filter.off")}
            </button>

            <button
              onClick={() => removeFilter(filter.id)}
              className="p-0.5 rounded hover:bg-bg-hover text-text-faint hover:text-error transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={() => addFilter()}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
        >
          <Plus size={11} />
          {t("filter.add")}
        </button>

        {hasFilters && (
          <button
            onClick={handleApply}
            className="flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <Search size={11} />
            {t("filter.apply")}
          </button>
        )}

        {hasFilters && (
          <div className="ml-auto">
            <SqlPreview schema={tableContext.schema} table={tableContext.table} filters={filters} columns={columns} />
          </div>
        )}
      </div>
    </div>
  );
}
