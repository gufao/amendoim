import { describe, it, expect } from "vitest";
import { buildFilteredSql, type Filter, ANY_COLUMN_VALUE } from "./queryStore";

const SCHEMA = "public";
const TABLE = "users";

function f(partial: Partial<Filter>): Filter {
  return {
    id: "x",
    column: "name",
    operator: "=",
    value: "alice",
    enabled: true,
    ...partial,
  };
}

describe("buildFilteredSql", () => {
  it("omits ORDER BY when no sort is given (regression: previous behavior)", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 100, []);
    expect(sql).toBe(`SELECT * FROM "public"."users" LIMIT 100`);
  });

  it("appends ORDER BY ASC NULLS LAST when sorted ascending", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 100, [], 0, {
      column: "created_at",
      direction: "asc",
    });
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "created_at" ASC NULLS LAST LIMIT 100`
    );
  });

  it("appends ORDER BY DESC NULLS LAST when sorted descending", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 100, [], 0, {
      column: "created_at",
      direction: "desc",
    });
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "created_at" DESC NULLS LAST LIMIT 100`
    );
  });

  it("works for non-date columns (e.g. name) — sort is column-agnostic", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 50, [], 0, {
      column: "name",
      direction: "asc",
    });
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "name" ASC NULLS LAST LIMIT 50`
    );
  });

  it("preserves clause order WHERE → ORDER BY → LIMIT → OFFSET", () => {
    const sql = buildFilteredSql(
      SCHEMA,
      TABLE,
      [f({ column: "name", operator: "=", value: "alice" })],
      25,
      ["name", "created_at"],
      50,
      { column: "created_at", direction: "desc" }
    );
    expect(sql).toBe(
      `SELECT * FROM "public"."users" WHERE "name" = 'alice' ORDER BY "created_at" DESC NULLS LAST LIMIT 25 OFFSET 50`
    );
  });

  it("places ORDER BY before LIMIT even with offset and no filters", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 10, [], 30, {
      column: "id",
      direction: "asc",
    });
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "id" ASC NULLS LAST LIMIT 10 OFFSET 30`
    );
  });

  it("ignores disabled filters but still applies sort", () => {
    const sql = buildFilteredSql(
      SCHEMA,
      TABLE,
      [f({ enabled: false })],
      100,
      ["name"],
      0,
      { column: "id", direction: "asc" }
    );
    expect(sql).toBe(
      `SELECT * FROM "public"."users" ORDER BY "id" ASC NULLS LAST LIMIT 100`
    );
  });

  it("does not include ORDER BY when sort is null", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 100, [], 0, null);
    expect(sql).toBe(`SELECT * FROM "public"."users" LIMIT 100`);
  });

  it("does not include ORDER BY when sort.column is empty", () => {
    const sql = buildFilteredSql(SCHEMA, TABLE, [], 100, [], 0, {
      column: "",
      direction: "asc",
    });
    expect(sql).toBe(`SELECT * FROM "public"."users" LIMIT 100`);
  });

  it("combines ANY-column filter with sort correctly", () => {
    const sql = buildFilteredSql(
      SCHEMA,
      TABLE,
      [f({ column: ANY_COLUMN_VALUE, operator: "LIKE", value: "ali" })],
      100,
      ["name", "email"],
      0,
      { column: "name", direction: "asc" }
    );
    expect(sql).toBe(
      `SELECT * FROM "public"."users" WHERE ("name"::text LIKE '%ali%' OR "email"::text LIKE '%ali%') ORDER BY "name" ASC NULLS LAST LIMIT 100`
    );
  });
});
