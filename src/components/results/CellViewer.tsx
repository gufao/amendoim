import { X, Copy, Check, Pencil, Save } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { formatCellValue } from "../../lib/format";
import { useT } from "../../i18n";

interface Props {
  column: string;
  value: unknown;
  editable?: boolean;
  onClose: () => void;
  onSave?: (newValue: unknown) => void;
}

export function CellViewer({ column, value, editable, onClose, onSave }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const formatted = formatCellValue(value);
  const canCloseBackdrop = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Guard against double-click: ignore backdrop clicks briefly after mount
  useEffect(() => {
    const id = setTimeout(() => { canCloseBackdrop.current = true; }, 300);
    return () => clearTimeout(id);
  }, []);

  // Close on Escape (only when not editing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) {
          setEditing(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, editing]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    const raw = value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    setEditValue(raw);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = () => {
    const newValue = editValue === "" ? null : editValue;
    onSave?.(newValue);
  };

  let displayValue = formatted;
  let isJson = false;
  try {
    if (typeof value === "object" && value !== null) {
      displayValue = JSON.stringify(value, null, 2);
      isJson = true;
    } else if (typeof value === "string") {
      JSON.parse(value);
      displayValue = JSON.stringify(JSON.parse(value as string), null, 2);
      isJson = true;
    }
  } catch {
    // not JSON
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      onClick={(e) => canCloseBackdrop.current && e.target === e.currentTarget && onClose()}
    >
      <div className="w-[600px] max-h-[70vh] bg-bg-elevated border border-border rounded-xl shadow-2xl shadow-black/40 flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">{t("cellViewer.column")}</span>
            <span className="text-text-primary font-semibold">{column}</span>
            {isJson && (
              <span className="px-1.5 py-0.5 rounded-md bg-accent-subtle text-accent text-[10px] font-medium">
                JSON
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {editable && !editing && (
              <button
                onClick={handleStartEdit}
                className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                title={t("edit.save")}
              >
                <Pencil size={14} />
              </button>
            )}
            {editing && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-bg-primary text-xs font-medium hover:bg-accent/90 transition-colors"
              >
                <Save size={12} />
                {t("edit.save")}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title={t("cellViewer.copy")}
            >
              {copied ? (
                <Check size={14} className="text-success" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className="w-full h-full min-h-[120px] bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-accent resize-y"
              placeholder="NULL"
            />
          ) : (
            <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
              {displayValue}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
