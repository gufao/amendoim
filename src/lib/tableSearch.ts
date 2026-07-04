export interface TableEntry {
  schema: string;
  table: string;
  estimatedRows: number | null;
}

/**
 * Ranks tables for the command palette. Matching is case-insensitive and works
 * both on the bare table name and on the qualified `schema.table` form, so a
 * user can type either `users` or `public.users`.
 *
 * Ordering (best first): exact name > name prefix > qualified prefix >
 * name substring > qualified substring, ties broken alphabetically by table
 * then schema. An empty query returns everything sorted alphabetically.
 */
export function rankTables(
  entries: TableEntry[],
  query: string,
  limit = 50,
): TableEntry[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return [...entries]
      .sort(
        (a, b) =>
          a.schema.localeCompare(b.schema) || a.table.localeCompare(b.table),
      )
      .slice(0, limit);
  }

  const scored: { entry: TableEntry; score: number }[] = [];
  for (const entry of entries) {
    const table = entry.table.toLowerCase();
    const qualified = `${entry.schema.toLowerCase()}.${table}`;

    let score = -1;
    if (table === q) score = 0;
    else if (table.startsWith(q)) score = 1;
    else if (qualified.startsWith(q)) score = 2;
    else if (table.includes(q)) score = 3;
    else if (qualified.includes(q)) score = 4;

    if (score >= 0) scored.push({ entry, score });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.table.localeCompare(b.entry.table) ||
      a.entry.schema.localeCompare(b.entry.schema),
  );

  return scored.slice(0, limit).map((s) => s.entry);
}
