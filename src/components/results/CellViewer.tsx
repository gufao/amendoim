import { X, Copy, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { formatCellValue } from "../../lib/format";
import { useT } from "../../i18n";

interface Props {
  column: string;
  value: unknown;
  onClose: () => void;
}

export function CellViewer({ column, value, onClose }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const formatted = formatCellValue(value);
  const canCloseBackdrop = useRef(false);

  // Guard against double-click: ignore backdrop clicks briefly after mount
  useEffect(() => {
    const id = setTimeout(() => { canCloseBackdrop.current = true; }, 300);
    return () => clearTimeout(id);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
            {displayValue}
          </pre>
        </div>
      </div>
    </div>
  );
}
