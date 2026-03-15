import { create } from "zustand";
import type { ConnectionConfig } from "../lib/tauri";
import * as api from "../lib/tauri";

interface ConnectionState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  isConnecting: boolean;
  error: string | null;

  loadConnections: () => Promise<void>;
  saveConnection: (config: ConnectionConfig) => Promise<ConnectionConfig>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (config: ConnectionConfig) => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  isConnecting: false,
  error: null,

  loadConnections: async () => {
    try {
      const connections = await api.listConnections();
      const activeId = await api.getActiveConnection();
      set({ connections, activeConnectionId: activeId });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  saveConnection: async (config) => {
    try {
      const saved = await api.saveConnection(config);
      await get().loadConnections();
      return saved;
    } catch (e) {
      const msg = String(e);
      set({ error: msg });
      throw new Error(msg);
    }
  },

  deleteConnection: async (id) => {
    try {
      await api.deleteConnection(id);
      if (get().activeConnectionId === id) {
        set({ activeConnectionId: null });
      }
      await get().loadConnections();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  testConnection: async (config) => {
    set({ isConnecting: true, error: null });
    try {
      await api.testConnection(config);
    } catch (e) {
      const msg = String(e);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isConnecting: false });
    }
  },

  connect: async (id) => {
    set({ isConnecting: true, error: null });
    try {
      await api.connect(id);
      set({ activeConnectionId: id });
    } catch (e) {
      const msg = String(e);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isConnecting: false });
    }
  },

  disconnect: async (id) => {
    try {
      await api.disconnect(id);
      if (get().activeConnectionId === id) {
        set({ activeConnectionId: null });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setError: (error) => set({ error }),
}));
