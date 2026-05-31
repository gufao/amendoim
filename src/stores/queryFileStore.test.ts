import { describe, it, expect, beforeEach } from "vitest";
import { useQueryFileStore } from "./queryFileStore";

describe("useQueryFileStore - getNextTitle and addQuery dynamic numbering", () => {
  beforeEach(() => {
    // Reset the store to an empty queries array before each test
    useQueryFileStore.setState({ queries: [] });
  });

  it("should create 'SQL Query 1' when there are no existing queries", () => {
    const store = useQueryFileStore.getState();
    const query = store.addQuery("conn-1");
    expect(query.title).toBe("SQL Query 1");
    expect(useQueryFileStore.getState().queries.length).toBe(1);
  });

  it("should create 'SQL Query 3' when 'SQL Query 1' and 'SQL Query 2' exist", () => {
    const store = useQueryFileStore.getState();
    store.addQuery("conn-1"); // SQL Query 1
    store.addQuery("conn-1"); // SQL Query 2
    const query = store.addQuery("conn-1"); // Should be SQL Query 3
    expect(query.title).toBe("SQL Query 3");
  });

  it("should not reuse 'SQL Query 1' if it was deleted/not present but higher queries exist, continuing monotonically", () => {
    const store = useQueryFileStore.getState();
    
    // Manually set state to simulate "SQL Query 2" and "SQL Query 3" being present but no "SQL Query 1"
    useQueryFileStore.setState({
      queries: [
        { id: "q2", title: "SQL Query 2", sql: "", connectionId: "conn-1", createdAt: 0, updatedAt: 0 },
        { id: "q3", title: "SQL Query 3", sql: "", connectionId: "conn-1", createdAt: 0, updatedAt: 0 }
      ]
    });

    const query = useQueryFileStore.getState().addQuery("conn-1");
    expect(query.title).toBe("SQL Query 4");
  });

  it("should not fill the gap 'SQL Query 2' if 1 and 3 exist but 2 is missing, continuing monotonically", () => {
    useQueryFileStore.setState({
      queries: [
        { id: "q1", title: "SQL Query 1", sql: "", connectionId: "conn-1", createdAt: 0, updatedAt: 0 },
        { id: "q3", title: "SQL Query 3", sql: "", connectionId: "conn-1", createdAt: 0, updatedAt: 0 }
      ]
    });

    const query = useQueryFileStore.getState().addQuery("conn-1");
    expect(query.title).toBe("SQL Query 4");
  });

  it("should not be affected by custom query names", () => {
    useQueryFileStore.setState({
      queries: [
        { id: "qc", title: "Custom Query Name", sql: "", connectionId: "conn-1", createdAt: 0, updatedAt: 0 },
        { id: "q1", title: "SQL Query 1", sql: "", connectionId: "conn-1", createdAt: 0, updatedAt: 0 }
      ]
    });

    const query = useQueryFileStore.getState().addQuery("conn-1");
    expect(query.title).toBe("SQL Query 2");
  });
});
