import { useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, X, RefreshCw, AlertTriangle } from "lucide-react";
import { useT } from "../i18n";
import { formatUpdateError } from "../lib/updateError";

export function UpdateChecker() {
  const t = useT();
  const [updateAvailable, setUpdateAvailable] = useState<{
    version: string;
    body: string;
  } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const updateRef = useRef<Update | null>(null);

  useEffect(() => {
    // Check for updates 3 seconds after startup
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update) {
          updateRef.current = update;
          setUpdateAvailable({
            version: update.version,
            body: update.body || "",
          });
        }
      } catch {
        // Silently fail — no update server in dev mode
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      let update = updateRef.current;
      if (!update) {
        update = await check();
      }
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (err) {
      // Surface the real failure instead of silently reverting the button.
      // The updater replaces the running .app bundle, so the most common cause
      // is the app running from a read-only/translocated location (i.e. not
      // moved to /Applications) — the message makes that diagnosable.
      console.error("[updater] install failed:", err);
      setError(formatUpdateError(err));
      setInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-10 right-4 z-50 animate-fade-in">
      <div className="bg-bg-elevated border border-border rounded-xl shadow-2xl shadow-black/40 p-4 w-72">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-subtle flex items-center justify-center">
              <Download size={14} className="text-accent" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">
                {t("update.available")}
              </div>
              <div className="text-[10px] text-text-muted">v{updateAvailable.version}</div>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-bg-hover text-text-faint hover:text-text-primary transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {updateAvailable.body && (
          <p className="text-[11px] text-text-secondary mb-3 line-clamp-3">
            {updateAvailable.body}
          </p>
        )}

        {error && (
          <div className="flex items-start gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-300 break-words">
              {t("update.error")} {error}
            </p>
          </div>
        )}

        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {installing ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              {t("update.installing")}
            </>
          ) : (
            <>
              <Download size={12} />
              {t("update.install")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
