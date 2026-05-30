import { describe, it, expect } from "vitest";
import { buildFilterClause, defaultOperatorForType, ANY_COLUMN_VALUE, type Filter } from "./queryStore";

function f(partial: Partial<Filter>): Filter {
  return {
    id: "x",
    column: "name",
    operator: "=",
    value: "",
    enabled: true,
    ...partial,
  };
}

describe("buildFilterClause — single column", () => {
  it("emits `=` with quoted identifier and quoted value", () => {
    expect(buildFilterClause(f({ column: "name", operator: "=", value: "alice" })))
      .toBe(`"name" = 'alice'`);
  });

  it("emits `!=`", () => {
    expect(buildFilterClause(f({ column: "name", operator: "!=", value: "bob" })))
      .toBe(`"name" != 'bob'`);
  });

  it.each([">", ">=", "<", "<="])("emits comparison operator %s as-is", (op) => {
    expect(buildFilterClause(f({ column: "age", operator: op, value: "18" })))
      .toBe(`"age" ${op} '18'`);
  });

  it("emits LIKE with %value% wrapping and ::text cast", () => {
    expect(buildFilterClause(f({ column: "name", operator: "LIKE", value: "ali" })))
      .toBe(`"name"::text LIKE '%ali%'`);
  });

  it("emits NOT LIKE with %value% wrapping and ::text cast", () => {
    expect(buildFilterClause(f({ column: "name", operator: "NOT LIKE", value: "ali" })))
      .toBe(`"name"::text NOT LIKE '%ali%'`);
  });

  it("emits IS NULL without value or quoting", () => {
    expect(buildFilterClause(f({ column: "deleted_at", operator: "IS NULL", value: "anything" })))
      .toBe(`"deleted_at" IS NULL`);
  });

  it("emits IS NOT NULL without value or quoting", () => {
    expect(buildFilterClause(f({ column: "deleted_at", operator: "IS NOT NULL", value: "" })))
      .toBe(`"deleted_at" IS NOT NULL`);
  });

  it("escapes single quotes in value (SQL injection guard) for `=`", () => {
    expect(buildFilterClause(f({ column: "name", operator: "=", value: "O'Brien" })))
      .toBe(`"name" = 'O''Brien'`);
  });

  it("escapes single quotes in value for LIKE", () => {
    expect(buildFilterClause(f({ column: "name", operator: "LIKE", value: "O'Br" })))
      .toBe(`"name"::text LIKE '%O''Br%'`);
  });

  it("preserves camelCase column identifiers via double quotes", () => {
    expect(buildFilterClause(f({ column: "createdAt", operator: ">", value: "2026-01-01" })))
      .toBe(`"createdAt" > '2026-01-01'`);
  });

  it("handles empty value with `=`", () => {
    expect(buildFilterClause(f({ column: "name", operator: "=", value: "" })))
      .toBe(`"name" = ''`);
  });
});

describe("buildFilterClause — ANY column", () => {
  it("returns TRUE when allColumns is missing", () => {
    expect(buildFilterClause(f({ column: ANY_COLUMN_VALUE, operator: "LIKE", value: "x" })))
      .toBe("TRUE");
  });

  it("returns TRUE when allColumns is empty", () => {
    expect(buildFilterClause(f({ column: ANY_COLUMN_VALUE, operator: "LIKE", value: "x" }), []))
      .toBe("TRUE");
  });

  it("ORs across all columns with LIKE wrapping", () => {
    expect(
      buildFilterClause(
        f({ column: ANY_COLUMN_VALUE, operator: "LIKE", value: "ali" }),
        ["name", "email"]
      )
    ).toBe(`("name"::text LIKE '%ali%' OR "email"::text LIKE '%ali%')`);
  });

  it("ORs across columns with NOT LIKE wrapping", () => {
    expect(
      buildFilterClause(
        f({ column: ANY_COLUMN_VALUE, operator: "NOT LIKE", value: "ali" }),
        ["name", "email"]
      )
    ).toBe(`("name"::text NOT LIKE '%ali%' OR "email"::text NOT LIKE '%ali%')`);
  });

  it("ORs across columns with `=` without wildcard wrapping but with ::text cast", () => {
    expect(
      buildFilterClause(
        f({ column: ANY_COLUMN_VALUE, operator: "=", value: "alice" }),
        ["name", "email"]
      )
    ).toBe(`("name"::text = 'alice' OR "email"::text = 'alice')`);
  });

  it("escapes single quotes in ANY-column LIKE", () => {
    expect(
      buildFilterClause(
        f({ column: ANY_COLUMN_VALUE, operator: "LIKE", value: "O'B" }),
        ["name"]
      )
    ).toBe(`("name"::text LIKE '%O''B%')`);
  });
});

describe("defaultOperatorForType", () => {
  it.each([
    "UUID",
    "INT2", "INT4", "INT8",
    "FLOAT4", "FLOAT8", "NUMERIC",
    "BOOL",
    "DATE", "TIMESTAMP", "TIMESTAMPTZ", "TIME", "TIMETZ",
  ])("returns `=` for exact-match type %s", (type) => {
    expect(defaultOperatorForType(type)).toBe("=");
  });

  it.each(["TEXT", "VARCHAR", "JSON", "JSONB", "BYTEA", "INET"])(
    "returns `LIKE` for text-like type %s",
    (type) => {
      expect(defaultOperatorForType(type)).toBe("LIKE");
    }
  );

  it("is case-insensitive: lowercase exact-match returns `=`", () => {
    expect(defaultOperatorForType("timestamptz")).toBe("=");
    expect(defaultOperatorForType("uuid")).toBe("=");
  });

  it("falls back to LIKE for undefined", () => {
    expect(defaultOperatorForType(undefined)).toBe("LIKE");
  });

  it("falls back to LIKE for empty string", () => {
    expect(defaultOperatorForType("")).toBe("LIKE");
  });

  it("falls back to LIKE for unknown types", () => {
    expect(defaultOperatorForType("MONEY")).toBe("LIKE");
    expect(defaultOperatorForType("HSTORE")).toBe("LIKE");
  });
});
