import { useState, useRef, useEffect } from "react";
import { FileCode2, Plus, X, Check } from "lucide-react";
import { useQueryFileStore } from "../../stores/queryFileStore";
import { useQueryStore } from "../../stores/queryStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useT } from "../../i18n";

export function QueryList() {
  const t = useT();
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const allQueries = useQueryFileStore((s) => s.queries);
  const queries = allQueries.filter(
    (q) => q.connectionId === activeConnectionId || q.connectionId === null
  );
  const addQuery = useQueryFileStore((s) => s.addQuery);
  const removeQuery = useQueryFileStore((s) => s.removeQuery);
  const renameQuery = useQueryFileStore((s) => s.renameQuery);
  const activeQueryId = useQueryStore((s) => s.activeQueryId);
  const setActiveQueryId = useQueryStore((s) => s.setActiveQueryId);
  const setActiveView = useQueryStore((s) => s.setActiveView);
  const setSql = useQueryStore((s) => s.setSql);
  const resetDataState = useQueryStore((s) => s.resetDataState);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  // Auto-cancel delete confirmation after 3s
  useEffect(() => {
    if (!confirmingDeleteId) return;
    const timer = setTimeout(() => setConfirmingDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDeleteId]);

  const handleSelectQuery = (query: { id: string; sql: string }) => {
    setActiveQueryId(query.id);
    setSql(query.sql);
    setActiveView("editor");
    resetDataState();
  };

  const handleAddQuery = () => {
    const query = addQuery(activeConnectionId);
    handleSelectQuery(query);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmingDeleteId === id) {
      // Second click = confirm
      removeQuery(id);
      setConfirmingDeleteId(null);
      if (activeQueryId === id) {
        const remaining = queries.filter((q) => q.id !== id);
        if (remaining.length > 0) {
          handleSelectQuery(remaining[0]);
        } else {
          setActiveQueryId(null);
          setSql("");
        }
      }
    } else {
      // First click = ask confirmation
      setConfirmingDeleteId(id);
    }
  };

  const handleStartRename = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    e.preventDefault();
    setRenamingId(id);
    setRenameValue(title);
  };

  const handleFinishRename = () => {
    if (renamingId && renameValue.trim()) {
      renameQuery(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="py-1">
      {queries.map((query) => {
        const isActive = query.id === activeQueryId;
        const isRenaming = query.id === renamingId;
        const isConfirmingDelete = query.id === confirmingDeleteId;

        return (
          <div
            key={query.id}
            className={`group flex items-center gap-1.5 px-3 py-[5px] cursor-pointer transition-colors ${
              isConfirmingDelete
                ? "bg-error/10 text-error"
                : isActive
                  ? "bg-accent-subtle text-accent"
                  : "text-text-secondary hover:bg-bg-hover"
            }`}
            onClick={() => handleSelectQuery(query)}
            onDoubleClick={(e) => handleStartRename(e, query.id, query.title)}
          >
            <FileCode2 size={12} className={isActive ? "text-accent" : "text-text-faint"} />
            {isRenaming ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFinishRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="flex-1 bg-bg-primary border border-accent rounded px-1 py-0 text-xs text-text-primary outline-none min-w-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : isConfirmingDelete ? (
              <span className="flex-1 truncate text-xs text-error">{t("query.deleteConfirm")}</span>
            ) : (
              <span className="flex-1 truncate text-xs">{query.title}</span>
            )}
            {!isRenaming && (
              <button
                onClick={(e) => handleDeleteClick(e, query.id)}
                className={`p-0.5 rounded transition-all ${
                  isConfirmingDelete
                    ? "text-error hover:text-error"
                    : isActive
                      ? "text-accent/60 hover:text-accent"
                      : "opacity-0 group-hover:opacity-100 text-text-faint hover:text-error"
                }`}
              >
                {isConfirmingDelete ? <Check size={10} /> : <X size={10} />}
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={handleAddQuery}
        className="flex items-center gap-1.5 px-3 py-[5px] w-full text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
      >
        <Plus size={12} />
        {t("sidebar.newQuery")}
      </button>
    </div>
  );
}
