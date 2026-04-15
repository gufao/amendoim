import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Check } from "lucide-react";
import { trackEvent } from "../../lib/analytics";
import { useT } from "../../i18n";

export function FeedbackButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [closing, setClosing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when opened
  useEffect(() => {
    if (open && !sent && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, sent]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setText("");
      setSent(false);
    }, 150);
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    trackEvent("feedback_user", { text: text.trim() });
    setSent(true);
    setTimeout(handleClose, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            setOpen(true);
            setSent(false);
            setText("");
            setClosing(false);
          }
        }}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
          open
            ? "text-accent bg-accent-subtle border-accent/30"
            : "text-text-faint hover:text-text-muted border-transparent hover:border-border"
        }`}
      >
        <MessageSquare size={10} />
        {t("feedback.button")}
      </button>

      {open && (
        <div
          className={`absolute bottom-full right-0 mb-2 w-72 rounded-lg bg-bg-elevated border border-border shadow-xl shadow-black/40 ${
            closing ? "animate-popover-out" : "animate-popover-in"
          }`}
        >
          {sent ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
                <Check size={16} className="text-success" />
              </div>
              <span className="text-xs text-text-secondary font-medium">
                {t("feedback.thanks")}
              </span>
            </div>
          ) : (
            <div className="p-3">
              <label className="text-[11px] font-semibold text-text-secondary mb-2 block">
                {t("feedback.title")}
              </label>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("feedback.placeholder")}
                className="w-full h-20 bg-bg-primary border border-border rounded-md px-2.5 py-2 text-xs text-text-primary placeholder:text-text-faint outline-none resize-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px] focus:shadow-accent-subtle"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-text-faint">
                  {t("feedback.hint")}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    text.trim()
                      ? "bg-accent text-white hover:bg-accent-hover active:scale-[0.97]"
                      : "bg-bg-hover text-text-faint cursor-not-allowed"
                  }`}
                >
                  <Send size={10} />
                  {t("feedback.send")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
