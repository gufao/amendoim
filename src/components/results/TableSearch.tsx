import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useQueryStore, TABLE_SEARCH_FILTER_ID } from "../../stores/queryStore";
import { useT } from "../../i18n";

/**
 * Dedicated "search this table" box shown at the top of a table preview.
 * Searches the whole table across every column (via the reserved any-column
 * filter) — not just the loaded page. Focused with Cmd/Ctrl+O.
 */
export function TableSearch() {
  const tableContext = useQueryStore((s) => s.tableContext);
  const setTableSearch = useQueryStore((s) => s.setTableSearch);
  const committed = useQueryStore(
    (s) => s.filters.find((f) => f.id === TABLE_SEARCH_FILTER_ID)?.value ?? ""
  );
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(committed);

  const schema = tableContext?.schema;
  const table = tableContext?.table;

  // Resync the box when the committed value changes from elsewhere: switching
  // tables (restored/empty filters) or clearing via the store.
  useEffect(() => {
    setLocal(committed);
  }, [committed, schema, table]);

  // Cmd/Ctrl+O focuses the search — only when a table is actually open, so we
  // don't hijack the shortcut on non-table views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        if (!useQueryStore.getState().tableContext) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!tableContext) return null;

  const clear = () => {
    setLocal("");
    setTableSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-bg-surface shrink-0">
      <div className="relative flex-1 max-w-md">
        <Search
          size={12}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
        />
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => {
            const v = e.target.value;
            setLocal(v);
            // Emptying the box clears the active search immediately, so the box
            // never appears empty while a hidden search still filters the rows.
            if (v === "" && committed !== "") setTableSearch("");
          }}
          onBlur={() => {
            // Discard uncommitted edits so the box always reflects the applied
            // search (the term is only committed on Enter or via clear).
            if (local !== committed) setLocal(committed);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setTableSearch(local);
            } else if (e.key === "Escape") {
              if (local) {
                clear();
              } else {
                inputRef.current?.blur();
              }
            }
          }}
          placeholder={t("tableSearch.placeholder")}
          className="w-full bg-bg-primary border border-border rounded-md pl-7 pr-7 py-1 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
        />
        {local && (
          <button
            onClick={clear}
            title={t("sidebar.clearSearch")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-hover text-text-faint hover:text-text-secondary transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>
      <span className="text-[10px] text-text-faint tabular-nums select-none shrink-0">⌘O</span>
    </div>
  );
}
