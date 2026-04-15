import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QueryFile {
  id: string;
  title: string;
  sql: string;
  connectionId: string | null;
  createdAt: number;
  updatedAt: number;
}

let queryCounter = 0;

interface QueryFileState {
  queries: QueryFile[];
  loadQueries: () => void;
  addQuery: (connectionId: string | null, title?: string, sql?: string) => QueryFile;
  removeQuery: (id: string) => void;
  updateQuery: (id: string, updates: Partial<Pick<QueryFile, "sql" | "title">>) => void;
  renameQuery: (id: string, title: string) => void;
  getNextTitle: () => string;
  getQueriesForConnection: (connectionId: string | null) => QueryFile[];
}

export const useQueryFileStore = create<QueryFileState>()(
  persist(
    (set, get) => ({
      queries: [],

      loadQueries: () => {
        // Persist middleware handles loading automatically.
        // Update counter to avoid title collisions.
        const maxNum = get().queries.reduce((max, q) => {
          const match = q.title.match(/^SQL Query (\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        queryCounter = maxNum;
      },

      getNextTitle: () => {
        queryCounter++;
        return `SQL Query ${queryCounter}`;
      },

      addQuery: (connectionId, title, sql) => {
        const now = Date.now();
        const query: QueryFile = {
          id: `query-${now}-${Math.random().toString(36).slice(2, 8)}`,
          title: title || get().getNextTitle(),
          sql: sql || "",
          connectionId,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ queries: [...s.queries, query] }));
        return query;
      },

      removeQuery: (id) => {
        set((s) => ({ queries: s.queries.filter((q) => q.id !== id) }));
      },

      updateQuery: (id, updates) => {
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
          ),
        }));
      },

      renameQuery: (id, title) => {
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id ? { ...q, title, updatedAt: Date.now() } : q
          ),
        }));
      },

      getQueriesForConnection: (connectionId) => {
        return get().queries.filter(
          (q) => q.connectionId === connectionId || q.connectionId === null
        );
      },
    }),
    { name: "amendoim-queries" }
  )
);
