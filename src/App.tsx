import { useEffect, useCallback, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { StatusBar } from "./components/layout/StatusBar";
import { SqlEditor } from "./components/editor/SqlEditor";
import { ResultsTable } from "./components/results/ResultsTable";
import { useQueryStore } from "./stores/queryStore";
import { useConnectionStore } from "./stores/connectionStore";
import { ConnectionModal } from "./components/connection/ConnectionModal";
import { McpModal } from "./components/mcp/McpModal";
import { UpdateChecker } from "./components/UpdateChecker";
import type { ConnectionConfig } from "./lib/tauri";
import { useT } from "./i18n";
import { trackEvent } from "./lib/analytics";

function App() {
  const addTab = useQueryStore((s) => s.addTab);
  const removeTab = useQueryStore((s) => s.removeTab);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const tabs = useQueryStore((s) => s.tabs);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const connectionError = useConnectionStore((s) => s.error);
  const setConnectionError = useConnectionStore((s) => s.setError);

  const [editorHeight, setEditorHeight] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  // Load saved connections and create initial tab on startup
  useEffect(() => {
    trackEvent("app_opened");
    loadConnections();
    if (tabs.length === 0) {
      addTab();
    }
  }, []);

  // Listen for MCP execute-query events from AI assistants
  useEffect(() => {
    const unlisten = listen<{ sql: string; title: string }>(
      "mcp-execute-query",
      (event) => {
        const { sql, title } = event.payload;
        const tabId = addTab(title, sql);
        executeQuery(tabId);
      }
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, [addTab, executeQuery]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "n") {
        e.preventDefault();
        addTab();
      }
      if (meta && e.key === "w") {
        e.preventDefault();
        if (activeTabId) removeTab(activeTabId);
      }
      if (meta && e.key === "Enter") {
        e.preventDefault();
        if (activeTabId) executeQuery(activeTabId);
      }
    },
    [activeTabId, addTab, removeTab, executeQuery]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Resize splitter
  const handleMouseDown = useCallback(() => setIsDragging(true), []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("editor-results");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setEditorHeight(Math.max(80, Math.min(e.clientY - rect.top, rect.height - 80)));
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex-1 flex min-h-0">
        <Sidebar
          onNewConnection={() => setShowConnectionModal(true)}
          onEditConnection={(config) => setEditingConnection(config)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          {!activeConnectionId ? (
            <WelcomeScreen onConnect={() => setShowConnectionModal(true)} />
          ) : (
            <div id="editor-results" className="flex-1 flex flex-col min-h-0">
              <div style={{ height: editorHeight }} className="flex flex-col shrink-0">
                <SqlEditor />
              </div>

              {/* Resize handle */}
              <div
                className={`h-[5px] flex items-center justify-center cursor-row-resize group transition-colors ${
                  isDragging
                    ? "bg-accent/20"
                    : "bg-bg-secondary hover:bg-accent/10"
                }`}
                onMouseDown={handleMouseDown}
              >
                <div className={`w-8 h-[3px] rounded-full transition-colors ${
                  isDragging ? "bg-accent/40" : "bg-border group-hover:bg-text-muted"
                }`} />
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <ResultsTable />
              </div>
            </div>
          )}
        </div>
      </div>

      <StatusBar onOpenMcp={() => setShowMcpModal(true)} />

      {showConnectionModal && (
        <ConnectionModal onClose={() => setShowConnectionModal(false)} />
      )}

      {editingConnection && (
        <ConnectionModal
          existing={editingConnection}
          onClose={() => setEditingConnection(null)}
        />
      )}

      {showMcpModal && <McpModal onClose={() => setShowMcpModal(false)} />}

      <UpdateChecker />

      {connectionError && (
        <ErrorToast
          message={connectionError}
          onDismiss={() => setConnectionError(null)}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ onConnect }: { onConnect: () => void }) {
  const t = useT();
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent-subtle flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1.5">
          {t("app.welcome")}
        </h2>
        <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">
          {t("app.welcome.description")}
        </p>
        <button
          onClick={onConnect}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-all hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("app.welcome.newConnection")}
        </button>
        <p className="text-[11px] text-text-muted mt-4">
          {t("app.welcome.hint")}
        </p>
      </div>
    </div>
  );
}

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="fixed bottom-12 right-4 z-50 max-w-sm animate-fade-in">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-bg-elevated border border-error/30 shadow-lg shadow-black/30">
        <AlertCircle size={15} className="text-error shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed flex-1">{message}</p>
        <button
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors shrink-0"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export default App;
