import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as api from "../lib/tauri";

interface McpState {
  isRunning: boolean;
  port: number;
  url: string;
  isLoading: boolean;
  error: string | null;
  installMessage: string | null;
  /**
   * Whether the user last left the server switched on. The server is a task
   * inside the app process, so quitting kills it — this is what lets us bring
   * it back on the next launch instead of making the user re-open the modal and
   * press Start again.
   *
   * This is the only field we persist: `isRunning` describes the backend's
   * actual state, and writing a stale copy of it to disk would make the status
   * bar claim a server is up before one has been started.
   */
  autoStart: boolean;
  /**
   * Failure of the launch-time restore, kept separate from `error` because
   * `error` is only ever rendered inside the MCP modal — and the whole point of
   * auto-start is that the user never opens it. Without this, a port conflict
   * would leave them believing the server is up while their AI client fails.
   */
  restoreError: string | null;

  loadStatus: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  restoreServer: () => Promise<void>;
  setAutoStart: (autoStart: boolean) => void;
  clearRestoreError: () => void;
  installClient: (client: string) => Promise<void>;
  clearMessages: () => void;
}

export const useMcpStore = create<McpState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      port: 7432,
      url: "http://127.0.0.1:7432/sse",
      isLoading: false,
      error: null,
      installMessage: null,
      autoStart: false,
      restoreError: null,

      loadStatus: async () => {
        try {
          const status = await api.getMcpStatus();
          set({
            isRunning: status.is_running,
            port: status.port,
            url: status.url,
          });
        } catch (e) {
          set({ error: String(e) });
        }
      },

      startServer: async () => {
        set({ isLoading: true, error: null });
        try {
          const status = await api.startMcpServer();
          set({
            isRunning: status.is_running,
            port: status.port,
            url: status.url,
            isLoading: false,
            // Only remember the intent once it actually worked, so a failed
            // start (e.g. the port is taken) doesn't arm a retry every launch.
            autoStart: status.is_running,
          });
        } catch (e) {
          set({ error: String(e), isLoading: false });
        }
      },

      stopServer: async () => {
        set({ isLoading: true, error: null });
        try {
          await api.stopMcpServer();
          set({ isRunning: false, isLoading: false, autoStart: false });
        } catch (e) {
          set({ error: String(e), isLoading: false });
        }
      },

      /**
       * Launch-time hook: re-arm the server only if the user left it running.
       * `start_mcp_server` is idempotent on the Rust side (it returns the
       * current status when already running), so calling this twice is safe.
       */
      restoreServer: async () => {
        if (!get().autoStart) return;
        await get().startServer();
        if (!get().isRunning) {
          set({ restoreError: get().error ?? "Could not start the MCP server." });
        }
      },

      // Lets the user disarm auto-start from the modal. Without it, a restore
      // that keeps failing (port permanently taken) is a trap: `isRunning` stays
      // false, so the modal only ever offers "Start", and nothing can clear the
      // flag that retries on every launch.
      setAutoStart: (autoStart) => set({ autoStart }),

      clearRestoreError: () => set({ restoreError: null }),

      installClient: async (client: string) => {
        set({ installMessage: null, error: null });
        try {
          const message = await api.installMcpClient(client);
          set({ installMessage: message });
        } catch (e) {
          set({ error: String(e) });
        }
      },

      clearMessages: () => set({ error: null, installMessage: null }),
    }),
    {
      name: "amendoim-mcp",
      partialize: (state) => ({ autoStart: state.autoStart }),
    }
  )
);
