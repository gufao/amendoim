import { create } from "zustand";
import type { ConnectionConfig } from "../lib/tauri";
import * as api from "../lib/tauri";
import { trackEvent } from "../lib/analytics";

interface ConnectionState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  connectedIds: string[];
  isConnecting: boolean;
  error: string | null;

  loadConnections: () => Promise<void>;
  saveConnection: (config: ConnectionConfig) => Promise<ConnectionConfig>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (config: ConnectionConfig) => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  switchConnection: (id: string) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectedIds: [],
  isConnecting: false,
  error: null,

  loadConnections: async () => {
    try {
      const connections = await api.listConnections();
      const activeId = await api.getActiveConnection();
      const connectedIds = await api.getConnectedIds();
      set({ connections, activeConnectionId: activeId, connectedIds });
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
      const state = get();
      const newConnected = state.connectedIds.filter((cid) => cid !== id);
      if (state.activeConnectionId === id) {
        const next = newConnected[0] || null;
        if (next) {
          await api.setActiveConnection(next);
        }
        set({ activeConnectionId: next, connectedIds: newConnected });
      } else {
        set({ connectedIds: newConnected });
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
      const connected = get().connectedIds;
      const newConnected = connected.includes(id) ? connected : [...connected, id];
      set({ activeConnectionId: id, connectedIds: newConnected });
      trackEvent("connection_established");
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
      const state = get();
      const newConnected = state.connectedIds.filter((cid) => cid !== id);
      if (state.activeConnectionId === id) {
        set({ activeConnectionId: null, connectedIds: newConnected });
      } else {
        set({ connectedIds: newConnected });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  switchConnection: async (id) => {
    const state = get();
    if (state.activeConnectionId === id) return;
    try {
      await api.setActiveConnection(id);
      set({ activeConnectionId: id });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  closeTab: async (id) => {
    const state = get();
    const newConnected = state.connectedIds.filter((cid) => cid !== id);
    try {
      await api.disconnect(id);
      if (state.activeConnectionId === id) {
        const next = newConnected[0] || null;
        if (next) {
          await api.setActiveConnection(next);
        }
        set({ activeConnectionId: next, connectedIds: newConnected });
      } else {
        set({ connectedIds: newConnected });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setError: (error) => set({ error }),
}));
