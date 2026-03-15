import { create } from "zustand";
import type { SchemaInfo, TableInfo, ColumnInfo, IndexInfo } from "../lib/tauri";
import * as api from "../lib/tauri";

interface SchemaState {
  schemas: SchemaInfo[];
  tables: Record<string, TableInfo[]>;
  columns: Record<string, ColumnInfo[]>;
  indexes: Record<string, IndexInfo[]>;
  expandedSchemas: Set<string>;
  expandedTables: Set<string>;
  selectedTable: { schema: string; table: string } | null;
  loading: boolean;

  loadSchemas: () => Promise<void>;
  loadTables: (schema: string) => Promise<void>;
  loadColumns: (schema: string, table: string) => Promise<void>;
  loadIndexes: (schema: string, table: string) => Promise<void>;
  toggleSchema: (schema: string) => void;
  toggleTable: (schema: string, table: string) => void;
  selectTable: (schema: string, table: string) => void;
  reset: () => void;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  schemas: [],
  tables: {},
  columns: {},
  indexes: {},
  expandedSchemas: new Set(),
  expandedTables: new Set(),
  selectedTable: null,
  loading: false,

  loadSchemas: async () => {
    set({ loading: true });
    try {
      const schemas = await api.listSchemas();
      set({ schemas });
    } catch {
      // silently fail, user will see empty tree
    } finally {
      set({ loading: false });
    }
  },

  loadTables: async (schema) => {
    try {
      const tables = await api.listTables(schema);
      set((s) => ({ tables: { ...s.tables, [schema]: tables } }));
    } catch {
      // silently fail
    }
  },

  loadColumns: async (schema, table) => {
    const key = `${schema}.${table}`;
    try {
      const columns = await api.listColumns(schema, table);
      set((s) => ({ columns: { ...s.columns, [key]: columns } }));
    } catch {
      // silently fail
    }
  },

  loadIndexes: async (schema, table) => {
    const key = `${schema}.${table}`;
    try {
      const indexes = await api.listIndexes(schema, table);
      set((s) => ({ indexes: { ...s.indexes, [key]: indexes } }));
    } catch {
      // silently fail
    }
  },

  toggleSchema: (schema) => {
    const expanded = new Set(get().expandedSchemas);
    if (expanded.has(schema)) {
      expanded.delete(schema);
    } else {
      expanded.add(schema);
      // Lazy load tables
      if (!get().tables[schema]) {
        get().loadTables(schema);
      }
    }
    set({ expandedSchemas: expanded });
  },

  toggleTable: (schema, table) => {
    const key = `${schema}.${table}`;
    const expanded = new Set(get().expandedTables);
    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
      // Lazy load columns
      if (!get().columns[key]) {
        get().loadColumns(schema, table);
      }
    }
    set({ expandedTables: expanded });
  },

  selectTable: (schema, table) => {
    set({ selectedTable: { schema, table } });
    const key = `${schema}.${table}`;
    if (!get().columns[key]) {
      get().loadColumns(schema, table);
    }
    if (!get().indexes[key]) {
      get().loadIndexes(schema, table);
    }
  },

  reset: () => {
    set({
      schemas: [],
      tables: {},
      columns: {},
      indexes: {},
      expandedSchemas: new Set(),
      expandedTables: new Set(),
      selectedTable: null,
    });
  },
}));
