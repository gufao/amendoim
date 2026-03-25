import { useEffect, useState } from "react";
import { X, Copy, Check, Download, Power, PowerOff } from "lucide-react";
import { useMcpStore } from "../../stores/mcpStore";
import { useT } from "../../i18n";

interface McpModalProps {
  onClose: () => void;
}

const AI_CLIENTS = [
  {
    id: "claude-code",
    name: "Claude Code",
    canAutoInstall: true,
    getCommand: (url: string) =>
      `claude mcp add --transport sse --scope user amendoim ${url}`,
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    canAutoInstall: true,
    getCommand: (url: string) => {
      const mcpUrl = url.replace("/sse", "/mcp");
      return JSON.stringify(
        { mcpServers: { amendoim: { command: "node", args: ["~/.amendoim/mcp-bridge.js", mcpUrl] } } },
        null,
        2
      );
    },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    canAutoInstall: true,
    getCommand: (url: string) =>
      `gemini mcp add --transport sse --scope user amendoim ${url}`,
  },
  {
    id: "codex",
    name: "Codex (OpenAI)",
    canAutoInstall: false,
    getCommand: (url: string) =>
      `codex --mcp-config '${JSON.stringify({ mcpServers: { amendoim: { type: "sse", url } } })}'`,
  },
] as const;

export function McpModal({ onClose }: McpModalProps) {
  const t = useT();
  const isRunning = useMcpStore((s) => s.isRunning);
  const url = useMcpStore((s) => s.url);
  const isLoading = useMcpStore((s) => s.isLoading);
  const error = useMcpStore((s) => s.error);
  const installMessage = useMcpStore((s) => s.installMessage);
  const loadStatus = useMcpStore((s) => s.loadStatus);
  const startServer = useMcpStore((s) => s.startServer);
  const stopServer = useMcpStore((s) => s.stopServer);
  const installClient = useMcpStore((s) => s.installClient);
  const clearMessages = useMcpStore((s) => s.clearMessages);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => setCopiedId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
  };

  const handleInstall = async (clientId: string) => {
    clearMessages();
    await installClient(clientId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-elevated rounded-xl shadow-2xl border border-border w-[520px] max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                {t("mcp.title")}
              </h2>
              <p className="text-[11px] text-text-muted">
                {t("mcp.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Description */}
          <p className="text-xs text-text-secondary leading-relaxed">
            {t("mcp.description")}
          </p>

          {/* Server Status */}
          <div className="rounded-lg border border-border bg-bg-secondary p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isRunning
                      ? "bg-success ring-2 ring-success-muted animate-pulse"
                      : "bg-text-faint ring-2 ring-bg-primary"
                  }`}
                />
                <div>
                  <span className="text-xs font-medium text-text-primary">
                    {isRunning
                      ? t("mcp.serverRunning")
                      : t("mcp.serverStopped")}
                  </span>
                  {isRunning && (
                    <p className="text-[10px] text-text-muted font-mono mt-0.5">
                      {url}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={isRunning ? stopServer : startServer}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  isRunning
                    ? "bg-error/10 text-error hover:bg-error/20"
                    : "bg-accent text-white hover:bg-accent-hover"
                } disabled:opacity-50`}
              >
                {isRunning ? (
                  <>
                    <PowerOff size={11} />
                    {t("mcp.stop")}
                  </>
                ) : (
                  <>
                    <Power size={11} />
                    {t("mcp.start")}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-md bg-error/10 border border-error/20 px-3 py-2 text-[11px] text-error">
              {error}
            </div>
          )}
          {installMessage && (
            <div className="rounded-md bg-success/10 border border-success/20 px-3 py-2 text-[11px] text-success">
              {installMessage}
            </div>
          )}

          {/* Client Setup */}
          {isRunning && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-medium text-text-secondary">
                {t("mcp.setupTitle")}
              </h3>

              {AI_CLIENTS.map((client) => {
                const command = client.getCommand(url);
                const isCopied = copiedId === client.id;

                return (
                  <div
                    key={client.id}
                    className="rounded-lg border border-border bg-bg-primary p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-text-primary">
                        {client.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(client.id, command)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check size={10} className="text-success" />
                              {t("mcp.copied")}
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              {t("mcp.copy")}
                            </>
                          )}
                        </button>
                        {client.canAutoInstall && (
                          <button
                            onClick={() => handleInstall(client.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-accent hover:bg-accent-subtle transition-colors"
                          >
                            <Download size={10} />
                            {t("mcp.install")}
                          </button>
                        )}
                      </div>
                    </div>
                    <pre className="text-[10px] text-text-muted font-mono bg-bg-secondary rounded px-2.5 py-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                      {command}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}

          {/* Privacy note */}
          <div className="rounded-md bg-accent-subtle/50 px-3 py-2.5">
            <p className="text-[10px] text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">
                {t("mcp.privacyTitle")}
              </span>{" "}
              {t("mcp.privacyNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
