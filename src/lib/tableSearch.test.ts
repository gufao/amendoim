import { describe, it, expect } from "vitest";
import { rankTables, type TableEntry } from "./tableSearch";

function e(schema: string, table: string, estimatedRows: number | null = null): TableEntry {
  return { schema, table, estimatedRows };
}

const ENTRIES: TableEntry[] = [
  e("public", "users"),
  e("public", "user_roles"),
  e("public", "orders"),
  e("auth", "users"),
  e("billing", "user_invoices"),
];

describe("rankTables — empty query", () => {
  it("returns every entry sorted by schema then table", () => {
    const result = rankTables(ENTRIES, "");
    expect(result.map((r) => `${r.schema}.${r.table}`)).toEqual([
      "auth.users",
      "billing.user_invoices",
      "public.orders",
      "public.user_roles",
      "public.users",
    ]);
  });

  it("respects the limit", () => {
    expect(rankTables(ENTRIES, "", 2)).toHaveLength(2);
  });
});

describe("rankTables — matching", () => {
  it("is case-insensitive", () => {
    const result = rankTables(ENTRIES, "USERS");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.table.toLowerCase().includes("users"))).toBe(true);
  });

  it("ranks exact name match before substring matches", () => {
    const set = [e("public", "users"), e("public", "superusers"), e("auth", "users")];
    const result = rankTables(set, "users");
    // The two exact `users` matches (score 0, tie-broken alphabetically by
    // schema) come before `superusers`, which only matches as a substring.
    expect(result.map((r) => `${r.schema}.${r.table}`)).toEqual([
      "auth.users",
      "public.users",
      "public.superusers",
    ]);
  });

  it("matches on the qualified schema.table form", () => {
    const result = rankTables(ENTRIES, "auth.us");
    expect(result.map((r) => `${r.schema}.${r.table}`)).toEqual(["auth.users"]);
  });

  it("matches substrings inside the table name", () => {
    const result = rankTables(ENTRIES, "invoice");
    expect(result.map((r) => r.table)).toEqual(["user_invoices"]);
  });

  it("returns nothing when there is no match", () => {
    expect(rankTables(ENTRIES, "zzz_nope")).toEqual([]);
  });
});
