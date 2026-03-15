import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, X, RefreshCw } from "lucide-react";
import { useT } from "../i18n";

export function UpdateChecker() {
  const t = useT();
  const [updateAvailable, setUpdateAvailable] = useState<{
    version: string;
    body: string;
  } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for updates 3 seconds after startup
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update) {
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
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch {
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
