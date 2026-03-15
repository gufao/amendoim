import { Key, Columns3, Hash } from "lucide-react";
import { useSchemaStore } from "../../stores/schemaStore";
import { useT } from "../../i18n";

export function TableInfo() {
  const t = useT();
  const { selectedTable, columns, indexes } = useSchemaStore();

  if (!selectedTable) return null;

  const key = `${selectedTable.schema}.${selectedTable.table}`;
  const cols = columns[key] || [];
  const idxs = indexes[key] || [];

  return (
    <div className="border-t border-border bg-bg-secondary">
      <div className="px-3 py-1.5 text-xs font-medium text-text-muted border-b border-border">
        {selectedTable.schema}.{selectedTable.table}
      </div>

      <div className="max-h-40 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left px-3 py-1 font-medium">{t("tableInfo.column")}</th>
              <th className="text-left px-3 py-1 font-medium">{t("tableInfo.type")}</th>
              <th className="text-left px-3 py-1 font-medium">{t("tableInfo.nullable")}</th>
              <th className="text-left px-3 py-1 font-medium">{t("tableInfo.default")}</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((col) => (
              <tr
                key={col.name}
                className="border-b border-border/50 hover:bg-bg-hover"
              >
                <td className="px-3 py-1 flex items-center gap-1">
                  {col.is_primary_key ? (
                    <Key size={10} className="text-yellow-500" />
                  ) : (
                    <Columns3 size={10} className="text-text-muted" />
                  )}
                  <span className="text-text-primary">{col.name}</span>
                </td>
                <td className="px-3 py-1 text-accent">{col.data_type}</td>
                <td className="px-3 py-1 text-text-muted">
                  {col.is_nullable ? t("tableInfo.yes") : t("tableInfo.no")}
                </td>
                <td className="px-3 py-1 text-text-muted truncate max-w-[120px]">
                  {col.column_default || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {idxs.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[11px] font-medium text-text-muted border-t border-border">
              {t("tableInfo.indexes")}
            </div>
            {idxs.map((idx) => (
              <div
                key={idx.name}
                className="px-3 py-1 text-[11px] flex items-center gap-1.5 hover:bg-bg-hover"
              >
                <Hash size={10} className="text-text-muted" />
                <span className="text-text-primary">{idx.name}</span>
                <span className="text-text-muted">({idx.columns})</span>
                {idx.is_unique && (
                  <span className="text-accent text-[9px] uppercase">
                    {t("tableInfo.unique")}
                  </span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
