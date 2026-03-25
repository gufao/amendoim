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
import { useQueryStore } from "../../stores/queryStore";
import { useT } from "../../i18n";

export function SchemaTree() {
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
  const t = useT();

  const handleTableClick = (schema: string, table: string) => {
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

  return (
    <div className="text-xs select-none pb-4">
      {schemas.map((schema) => {
        const isExpanded = expandedSchemas.has(schema.name);
        const schemaTables = tables[schema.name] || [];

        return (
          <div key={schema.name}>
            <div
              className="flex items-center gap-1.5 px-3 py-[5px] cursor-pointer hover:bg-bg-hover transition-colors"
              onClick={() => toggleSchema(schema.name)}
            >
              <span className="text-text-faint w-3.5 flex items-center justify-center">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <Layers size={12} className="text-schema-icon shrink-0" />
              <span className="truncate font-medium text-text-secondary">{schema.name}</span>
              {schemaTables.length > 0 && (
                <span className="text-text-faint ml-auto text-[10px] tabular-nums">
                  {schemaTables.length}
                </span>
              )}
            </div>

            {isExpanded && (
              <div className="animate-slide-in">
                {schemaTables.map((table) => {
                  const tableKey = `${schema.name}.${table.name}`;
                  const isTableExpanded = expandedTables.has(tableKey);
                  const tableCols = columns[tableKey] || [];

                  return (
                    <div key={tableKey}>
                      <div
                        className="flex items-center gap-1.5 pl-7 pr-3 py-[5px] cursor-pointer hover:bg-bg-hover transition-colors"
                        onClick={() => {
                          toggleTable(schema.name, table.name);
                          selectTable(schema.name, table.name);
                          handleTableClick(schema.name, table.name);
                        }}
                      >
                        <span className="text-text-faint w-3.5 flex items-center justify-center">
                          {isTableExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </span>
                        <Table2 size={12} className="text-table-icon shrink-0" />
                        <span className="truncate text-text-secondary">{table.name}</span>
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
                            >
                              {col.is_primary_key ? (
                                <Key size={10} className="text-pk-icon shrink-0" />
                              ) : (
                                <Columns3 size={10} className="text-column-icon shrink-0" />
                              )}
                              <span className="truncate">{col.name}</span>
                              <span className="text-text-faint ml-auto text-[10px] font-mono shrink-0">
                                {col.data_type}
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
