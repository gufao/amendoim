import { useRef } from "react";
import { Plus, X, Search } from "lucide-react";
import { useQueryStore, FILTER_OPERATORS } from "../../stores/queryStore";
import { useQuery } from "../../hooks/useQuery";
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

export function FilterBar() {
  const { activeTab } = useQuery();
  const { addFilter, updateFilter, removeFilter, applyFilters } = useQueryStore();
  const t = useT();
  const columnsRef = useRef(activeTab?.result?.columns ?? []);

  // Keep the last known columns so filters survive 0-row / error results
  if (activeTab?.result?.columns?.length) {
    columnsRef.current = activeTab.result.columns;
  }

  const columns = columnsRef.current;

  if (!activeTab?.tableContext || !columns.length) return null;
  const filters = activeTab.filters;
  const hasFilters = filters.length > 0;

  const handleApply = () => {
    applyFilters(activeTab.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  const needsValue = (op: string) => op !== "IS NULL" && op !== "IS NOT NULL";

  return (
    <div className="border-b border-border bg-bg-surface px-3 py-2 shrink-0">
      {/* Filter rows */}
      {filters.map((filter, i) => (
        <div key={filter.id} className="flex items-center gap-2 mb-1.5 last:mb-0 animate-fade-in">
          {/* WHERE / AND label */}
          <span className="text-[10px] font-mono text-text-faint w-10 text-right shrink-0">
            {i === 0 ? t("filter.where") : t("filter.and")}
          </span>

          {/* Column */}
          <select
            value={filter.column}
            onChange={(e) =>
              updateFilter(activeTab.id, filter.id, { column: e.target.value })
            }
            className="filter-select flex-1 min-w-[100px] max-w-[160px]"
          >
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name}
              </option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={filter.operator}
            onChange={(e) =>
              updateFilter(activeTab.id, filter.id, { operator: e.target.value })
            }
            className="filter-select w-[110px]"
          >
            {FILTER_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {OPERATOR_LABEL_KEYS[op.value] ? t(OPERATOR_LABEL_KEYS[op.value] as any) : op.label}
              </option>
            ))}
          </select>

          {/* Value */}
          {needsValue(filter.operator) && (
            <input
              value={filter.value}
              onChange={(e) =>
                updateFilter(activeTab.id, filter.id, { value: e.target.value })
              }
              onKeyDown={handleKeyDown}
              placeholder={t("filter.value")}
              className="filter-input flex-1 min-w-[80px] max-w-[200px]"
            />
          )}

          {/* Toggle */}
          <button
            onClick={() =>
              updateFilter(activeTab.id, filter.id, { enabled: !filter.enabled })
            }
            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
              filter.enabled
                ? "bg-accent-subtle text-accent"
                : "bg-bg-primary text-text-faint"
            }`}
            title={filter.enabled ? t("filter.disable") : t("filter.enable")}
          >
            {filter.enabled ? t("filter.on") : t("filter.off")}
          </button>

          {/* Remove */}
          <button
            onClick={() => removeFilter(activeTab.id, filter.id)}
            className="p-0.5 rounded hover:bg-bg-hover text-text-faint hover:text-error transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={() => addFilter(activeTab.id)}
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
      </div>

    </div>
  );
}
