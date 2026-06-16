import { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { useThemeStore, THEMES, type Theme } from "../../stores/themeStore";
import { useT } from "../../i18n";
import { trackEvent } from "../../lib/analytics";

// Literal preview colors so each swatch shows its own palette regardless of the
// theme currently applied to the document.
const PREVIEW: Record<Theme, { bg: string; accent: string }> = {
  terracota: { bg: "#1a1714", accent: "#c2956a" },
  "rosa-quente": { bg: "#1d1614", accent: "#d98aa6" },
  "rosa-vibrante": { bg: "#191320", accent: "#ff6fae" },
  "rosa-suave": { bg: "#f7e9ef", accent: "#d9628a" },
};

export function ThemeSwitcher() {
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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
    }, 150);
  };

  const handleToggle = () => {
    if (open) {
      handleClose();
    } else {
      setOpen(true);
      setClosing(false);
    }
  };

  const handleSelect = (next: Theme) => {
    setTheme(next);
    trackEvent("theme_changed", { theme: next });
    handleClose();
  };

  const labels: Record<Theme, string> = {
    terracota: t("theme.terracota"),
    "rosa-quente": t("theme.rosa-quente"),
    "rosa-vibrante": t("theme.rosa-vibrante"),
    "rosa-suave": t("theme.rosa-suave"),
  };

  return (
    <div className="relative ml-2 border-l border-border pl-2" ref={popoverRef}>
      <button
        onClick={handleToggle}
        title={t("theme.label")}
        className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium transition-colors ${
          open ? "text-accent bg-accent-subtle" : "text-text-faint hover:text-text-muted"
        }`}
      >
        <Palette size={11} />
        <span
          className="w-2.5 h-2.5 rounded-full border border-border"
          style={{ background: PREVIEW[theme].accent }}
        />
      </button>

      {open && (
        <div
          className={`absolute bottom-full right-0 mb-2 w-44 rounded-lg bg-bg-elevated border border-border shadow-xl shadow-black/40 p-1 ${
            closing ? "animate-popover-out" : "animate-popover-in"
          }`}
        >
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
            {t("theme.label")}
          </div>
          {THEMES.map((name) => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                theme === name ? "bg-accent-subtle" : "hover:bg-bg-hover"
              }`}
            >
              <span
                className="w-4 h-4 rounded-md border border-border flex items-center justify-center shrink-0"
                style={{ background: PREVIEW[name].bg }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: PREVIEW[name].accent }}
                />
              </span>
              <span
                className={`flex-1 text-[11px] ${
                  theme === name ? "text-accent font-medium" : "text-text-secondary"
                }`}
              >
                {labels[name]}
              </span>
              {theme === name && <Check size={12} className="text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
