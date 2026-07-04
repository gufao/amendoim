import { describe, it, expect } from "vitest";
import {
  upsertSearchFilter,
  TABLE_SEARCH_FILTER_ID,
  ANY_COLUMN_VALUE,
  type Filter,
} from "./queryStore";

function f(partial: Partial<Filter>): Filter {
  return {
    id: "col-1",
    column: "name",
    operator: "=",
    value: "",
    enabled: true,
    ...partial,
  };
}

describe("upsertSearchFilter", () => {
  it("adds a reserved any-column LIKE filter when none exists", () => {
    const result = upsertSearchFilter([], "maria");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: TABLE_SEARCH_FILTER_ID,
      column: ANY_COLUMN_VALUE,
      operator: "LIKE",
      value: "maria",
      enabled: true,
    });
  });

  it("puts the search filter first, before existing column filters", () => {
    const existing = [f({ id: "col-1", column: "email" })];
    const result = upsertSearchFilter(existing, "maria");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(TABLE_SEARCH_FILTER_ID);
    expect(result[1].id).toBe("col-1");
  });

  it("replaces the value of an existing search filter without duplicating it", () => {
    const first = upsertSearchFilter([], "maria");
    const second = upsertSearchFilter(first, "joão");
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(TABLE_SEARCH_FILTER_ID);
    expect(second[0].value).toBe("joão");
  });

  it("removes the search filter when the value is empty", () => {
    const withSearch = upsertSearchFilter([f({ id: "col-1" })], "maria");
    const cleared = upsertSearchFilter(withSearch, "");
    expect(cleared).toHaveLength(1);
    expect(cleared[0].id).toBe("col-1");
    expect(cleared.some((x) => x.id === TABLE_SEARCH_FILTER_ID)).toBe(false);
  });

  it("removes the search filter when the value is only whitespace", () => {
    const withSearch = upsertSearchFilter([], "maria");
    const cleared = upsertSearchFilter(withSearch, "   ");
    expect(cleared).toHaveLength(0);
  });

  it("preserves the raw value (including internal spaces) when committing", () => {
    const result = upsertSearchFilter([], "  san jose  ");
    expect(result[0].value).toBe("  san jose  ");
  });

  it("does not mutate the input array", () => {
    const input = [f({ id: "col-1" })];
    const copy = [...input];
    upsertSearchFilter(input, "maria");
    expect(input).toEqual(copy);
  });
});
