import { useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Layers,
  Table2,
  Columns3,
  Key,
  Loader2,
} from "lucide-react";
import { useSchema } from "../../hooks/useSchema";
import { useSchemaStore } from "../../stores/schemaStore";
import { useQueryStore } from "../../stores/queryStore";
import { useT } from "../../i18n";

const TYPE_ABBREVIATIONS: Record<string, string> = {
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  "time with time zone": "timetz",
  "time without time zone": "time",
  "character varying": "varchar",
  "character": "char",
  "double precision": "float8",
};

function abbreviateType(type: string): string {
  return TYPE_ABBREVIATIONS[type] ?? type;
}

interface Props {
  tableFilter?: string;
}

export function SchemaTree({ tableFilter = "" }: Props) {
  const {
    schemas,
    tables,
    columns,
    expandedSchemas,
    expandedTables,
    loading,
    toggleSchema,
    toggleTable,
    selectTable,
  } = useSchema();

  const previewTable = useQueryStore((s) => s.previewTable);
  const tableContext = useQueryStore((s) => s.tableContext);
  const t = useT();
  const trimmedFilter = tableFilter.trim().toLowerCase();
  const isFiltering = trimmedFilter.length > 0;

  // When the user starts searching, eagerly load tables for any schemas
  // we haven't fetched yet so the filter can match across all of them.
  useEffect(() => {
    if (!isFiltering) return;
    const loadTables = useSchemaStore.getState().loadTables;
    for (const schema of schemas) {
      if (!tables[schema.name]) {
        loadTables(schema.name);
      }
    }
  }, [isFiltering, schemas, tables]);

  const filteredSchemas = useMemo(() => {
    if (!isFiltering) {
      return schemas.map((schema) => ({
        schema,
        visibleTables: tables[schema.name] || [],
        hasMatch: true,
      }));
    }
    return schemas
      .map((schema) => {
        const all = tables[schema.name] || [];
        const visibleTables = all.filter((tbl) =>
          tbl.name.toLowerCase().includes(trimmedFilter),
        );
        return { schema, visibleTables, hasMatch: visibleTables.length > 0 };
      })
      .filter((entry) => entry.hasMatch);
  }, [isFiltering, schemas, tables, trimmedFilter]);

  const handleTableClick = (schema: string, table: string) => {
    selectTable(schema, table);
    previewTable(schema, table);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={14} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (schemas.length === 0) {
    return (
      <div className="px-3 py-6 text-xs text-text-faint text-center">
        {t("schema.noSchemas")}
      </div>
    );
  }

  if (isFiltering && filteredSchemas.length === 0) {
    return (
      <div className="px-3 py-6 text-xs text-text-faint text-center">
        {t("schema.noMatches")}
      </div>
    );
  }

  return (
    <div className="text-xs select-none pb-4">
      {filteredSchemas.map(({ schema, visibleTables }) => {
        const isExpanded = isFiltering || expandedSchemas.has(schema.name);

        return (
          <div key={schema.name}>
            <div
              className="flex items-center gap-1.5 px-3 py-[5px] cursor-pointer hover:bg-bg-hover transition-colors"
              onClick={() => {
                if (!isFiltering) toggleSchema(schema.name);
              }}
            >
              <span className="text-text-faint w-3.5 flex items-center justify-center">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <Layers size={12} className="text-schema-icon shrink-0" />
              <span className="truncate font-medium text-text-secondary" title={schema.name}>{schema.name}</span>
              {visibleTables.length > 0 && (
                <span className="text-text-faint ml-auto text-[10px] tabular-nums">
                  {visibleTables.length}
                </span>
              )}
            </div>

            {isExpanded && (
              <div className="animate-slide-in">
                {visibleTables.map((table) => {
                  const tableKey = `${schema.name}.${table.name}`;
                  const isTableExpanded = expandedTables.has(tableKey);
                  const tableCols = columns[tableKey] || [];
                  // The table whose data is currently on screen — highlight it so
                  // it's clear which table you're looking at after clicking around.
                  const isActiveTable =
                    tableContext?.schema === schema.name &&
                    tableContext?.table === table.name;

                  return (
                    <div key={tableKey}>
                      <div
                        className={`flex items-center gap-1.5 pl-7 pr-3 py-[5px] cursor-pointer transition-colors ${
                          isActiveTable ? "bg-accent-subtle text-accent" : "hover:bg-bg-hover"
                        }`}
                        onClick={() => {
                          toggleTable(schema.name, table.name);
                          handleTableClick(schema.name, table.name);
                        }}
                      >
                        <span className="text-text-faint w-3.5 flex items-center justify-center">
                          {isTableExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </span>
                        <Table2 size={12} className={`shrink-0 ${isActiveTable ? "text-accent" : "text-table-icon"}`} />
                        <span className={`truncate ${isActiveTable ? "text-accent font-medium" : "text-text-secondary"}`} title={table.name}>{table.name}</span>
                        {table.estimated_rows !== null && table.estimated_rows > 0 && (
                          <span className="text-text-faint ml-auto text-[10px] tabular-nums">
                            ~{table.estimated_rows}
                          </span>
                        )}
                      </div>

                      {isTableExpanded && (
                        <div className="animate-slide-in">
                          {tableCols.map((col) => (
                            <div
                              key={`${tableKey}.${col.name}`}
                              className="flex items-center gap-1.5 pl-14 pr-3 py-[3px] text-text-muted hover:bg-bg-hover cursor-default transition-colors"
                              title={`${col.name} : ${col.data_type}`}
                            >
                              {col.is_primary_key ? (
                                <Key size={10} className="text-pk-icon shrink-0" />
                              ) : (
                                <Columns3 size={10} className="text-column-icon shrink-0" />
                              )}
                              <span className="flex-1 min-w-0 truncate">{col.name}</span>
                              <span className="text-text-faint text-[10px] font-mono min-w-0 truncate max-w-[50%]">
                                {abbreviateType(col.data_type)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
