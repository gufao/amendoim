import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Table2, Layers } from "lucide-react";
import { useSchemaStore } from "../../stores/schemaStore";
import { rankTables, type TableEntry } from "../../lib/tableSearch";
import { useT } from "../../i18n";

interface Props {
  onClose: () => void;
  onSelectTable: (schema: string, table: string) => void;
}

export function CommandPalette({ onClose, onSelectTable }: Props) {
  const t = useT();
  const schemas = useSchemaStore((s) => s.schemas);
  const tables = useSchemaStore((s) => s.tables);
  const schemasLoading = useSchemaStore((s) => s.loading);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The schema list may not be in the store yet (e.g. the user never opened the
  // sidebar tree this session). Make the palette self-sufficient by loading it.
  useEffect(() => {
    if (schemas.length === 0) useSchemaStore.getState().loadSchemas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eagerly load tables for every schema so the palette can search across all
  // of them, even schemas the user never expanded in the sidebar.
  useEffect(() => {
    const loadTables = useSchemaStore.getState().loadTables;
    for (const schema of schemas) {
      if (!tables[schema.name]) loadTables(schema.name);
    }
  }, [schemas, tables]);

  // We're still fetching while schemas load, or while any known schema hasn't
  // had its tables fetched yet — show a spinner-y hint instead of "no tables".
  const isLoading =
    schemasLoading ||
    (schemas.length > 0 && schemas.some((s) => tables[s.name] === undefined));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const entries = useMemo<TableEntry[]>(() => {
    const out: TableEntry[] = [];
    for (const schema of schemas) {
      for (const table of tables[schema.name] || []) {
        out.push({
          schema: schema.name,
          table: table.name,
          estimatedRows: table.estimated_rows,
        });
      }
    }
    return out;
  }, [schemas, tables]);

  const results = useMemo(() => rankTables(entries, query), [entries, query]);

  // Reset the highlight to the top whenever the query changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep the highlight in range if the result set shrinks.
  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  // Scroll the highlighted row into view as the user navigates.
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const choose = (entry: TableEntry | undefined) => {
    if (!entry) return;
    onSelectTable(entry.schema, entry.table);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[560px] max-w-[90vw] bg-bg-elevated rounded-xl border border-border shadow-2xl shadow-black/40 animate-fade-in overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Search size={15} className="text-text-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("palette.placeholder")}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-xs text-text-faint text-center">
              {isLoading ? t("palette.loading") : t("palette.noResults")}
            </div>
          ) : (
            results.map((entry, index) => {
              const isActive = index === selectedIndex;
              return (
                <div
                  key={`${entry.schema}.${entry.table}`}
                  data-index={index}
                  onClick={() => choose(entry)}
                  onMouseMove={() => setSelectedIndex(index)}
                  className={`flex items-center gap-2 px-4 py-2 cursor-pointer text-xs transition-colors ${
                    isActive
                      ? "bg-accent-subtle text-accent"
                      : "text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  <Table2
                    size={13}
                    className={isActive ? "text-accent shrink-0" : "text-table-icon shrink-0"}
                  />
                  <span className="truncate font-medium" title={entry.table}>
                    {entry.table}
                  </span>
                  <span className="flex items-center gap-1 text-text-faint min-w-0">
                    <Layers size={10} className="shrink-0" />
                    <span className="truncate" title={entry.schema}>
                      {entry.schema}
                    </span>
                  </span>
                  {entry.estimatedRows !== null && entry.estimatedRows > 0 && (
                    <span className="ml-auto text-[10px] text-text-faint tabular-nums shrink-0">
                      ~{entry.estimatedRows}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center px-4 py-2 border-t border-border text-[10px] text-text-faint">
          <span>{t("palette.hint")}</span>
        </div>
      </div>
    </div>
  );
}
