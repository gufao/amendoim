import { useEffect, useCallback, useState, Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/layout/Sidebar";
import { StatusBar } from "./components/layout/StatusBar";
import { ConnectionTabs } from "./components/layout/ConnectionTabs";
import { SqlEditor } from "./components/editor/SqlEditor";
import { ResultsTable } from "./components/results/ResultsTable";
import { useQueryStore } from "./stores/queryStore";
import { useQueryFileStore } from "./stores/queryFileStore";
import { useConnectionStore } from "./stores/connectionStore";
import { ConnectionModal } from "./components/connection/ConnectionModal";
import { McpModal } from "./components/mcp/McpModal";
import { UpdateChecker } from "./components/UpdateChecker";
import type { ConnectionConfig } from "./lib/tauri";
import { useT } from "./i18n";
import { trackEvent } from "./lib/analytics";

function App() {
  const activeView = useQueryStore((s) => s.activeView);
  const activeQueryId = useQueryStore((s) => s.activeQueryId);
  const setActiveQueryId = useQueryStore((s) => s.setActiveQueryId);
  const setActiveView = useQueryStore((s) => s.setActiveView);
  const setSql = useQueryStore((s) => s.setSql);
  const resetDataState = useQueryStore((s) => s.resetDataState);
  const executeQuery = useQueryStore((s) => s.executeQuery);

  const addQuery = useQueryFileStore((s) => s.addQuery);
  const removeQuery = useQueryFileStore((s) => s.removeQuery);
  const queries = useQueryFileStore((s) => s.queries);
  const loadQueries = useQueryFileStore((s) => s.loadQueries);

  const queryError = useQueryStore((s) => s.error);
  const clearQueryError = useQueryStore((s) => s.clearError);

  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const connectionError = useConnectionStore((s) => s.error);
  const setConnectionError = useConnectionStore((s) => s.setError);

  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const t = useT();

  useEffect(() => {
    trackEvent("app_opened");
    loadConnections();
    loadQueries();
  }, []);

  useEffect(() => {
    const unlisten = listen<{ sql: string; title: string }>(
      "mcp-execute-query",
      (event) => {
        const { sql, title } = event.payload;
        const query = addQuery(activeConnectionId, title, sql);
        setActiveQueryId(query.id);
        setSql(sql);
        executeQuery();
      }
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, [addQuery, setActiveQueryId, setSql, executeQuery]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "n") {
        e.preventDefault();
        const query = addQuery(activeConnectionId);
        setActiveQueryId(query.id);
        setSql(query.sql);
        setActiveView("editor");
        resetDataState();
      }
      if (meta && e.key === "w") {
        e.preventDefault();
        if (activeQueryId) {
          removeQuery(activeQueryId);
          const remaining = queries.filter((q) => q.id !== activeQueryId);
          if (remaining.length > 0) {
            setActiveQueryId(remaining[0].id);
            setSql(remaining[0].sql);
          } else {
            setActiveQueryId(null);
            setSql("");
          }
        }
      }
    },
    [activeQueryId, addQuery, removeQuery, queries, setActiveQueryId, setSql, setActiveView, resetDataState, t]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <ConnectionTabs onNewConnection={() => setShowConnectionModal(true)} />
      <div className="flex-1 flex min-h-0">
        <Sidebar
          onNewConnection={() => setShowConnectionModal(true)}
          onEditConnection={(config) => setEditingConnection(config)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {!activeConnectionId ? (
            <WelcomeScreen onConnect={() => setShowConnectionModal(true)} />
          ) : activeView === "editor" ? (
            <SqlEditor />
          ) : (
            <ErrorBoundary><ResultsTable /></ErrorBoundary>
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

      {queryError && (
        <ErrorToast
          title={t("results.error")}
          message={queryError}
          duration={30000}
          onDismiss={clearQueryError}
        />
      )}

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

function ErrorToast({ message, onDismiss, title, duration = 8000 }: { message: string; onDismiss: () => void; title?: string; duration?: number }) {
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, onDismiss, duration]);

  return (
    <div className="fixed bottom-12 right-4 z-50 max-w-lg animate-fade-in">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-bg-elevated border border-error/30 shadow-lg shadow-black/30">
        <AlertCircle size={15} className="text-error shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && <div className="text-xs font-semibold text-error mb-1">{title}</div>}
          <p className="text-xs text-text-secondary leading-relaxed break-words max-h-40 overflow-auto select-text">{message}</p>
        </div>
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

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary caught:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-bg-primary p-8">
          <div className="rounded-lg border border-error/30 bg-error-muted p-6 max-w-lg">
            <div className="text-sm font-semibold text-error mb-2">Component Error</div>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">{this.state.error.message}</pre>
            <pre className="text-[10px] text-text-faint whitespace-pre-wrap font-mono mt-2">{this.state.error.stack}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App;
