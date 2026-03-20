import { create } from "zustand";
import * as api from "../lib/tauri";

interface McpState {
  isRunning: boolean;
  port: number;
  url: string;
  isLoading: boolean;
  error: string | null;
  installMessage: string | null;

  loadStatus: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  installClient: (client: string) => Promise<void>;
  clearMessages: () => void;
}

export const useMcpStore = create<McpState>((set) => ({
  isRunning: false,
  port: 7432,
  url: "http://127.0.0.1:7432/sse",
  isLoading: false,
  error: null,
  installMessage: null,

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
      });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  stopServer: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.stopMcpServer();
      set({ isRunning: false, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

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
}));
