# Cancel Running Query — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to cancel a long-running PostgreSQL query via a Stop button that replaces the Run button during execution.

**Architecture:** Track the PostgreSQL backend PID before each query execution in a shared Rust map. Cancel via `pg_cancel_backend(pid)` from a separate connection. Frontend toggles Run/Stop button based on `isExecuting` state.

**Tech Stack:** Rust (Tauri, SQLx, Tokio), TypeScript (React, Zustand), PostgreSQL

---

### Task 1: Rust — PID state and cancel command

**Files:**
- Modify: `src-tauri/src/db/executor.rs:1-90`
- Modify: `src-tauri/src/commands/query.rs:1-85`
- Modify: `src-tauri/src/lib.rs:60-76`

- [ ] **Step 1: Add shared PID state type in executor.rs**

Add the PID map type and a helper to create it at the top of `src-tauri/src/db/executor.rs`:

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

/// Maps connection_id → PostgreSQL backend PID for active queries
pub type ActiveQueryPids = Arc<Mutex<HashMap<String, i32>>>;

pub fn create_active_query_pids() -> ActiveQueryPids {
    Arc::new(Mutex::new(HashMap::new()))
}
```

Add `Arc` to the existing `use std::collections::HashMap;` import block and add the `tokio::sync::Mutex` import.

- [ ] **Step 2: Modify execute_query to track PID**

Change the `execute_query` function signature to accept the PID map and a connection ID. Before executing the user's query, get the PID and store it. After execution, remove it.

Replace the current `execute_query` function signature and body (lines 7-90):

```rust
pub async fn execute_query(
    pool: &PgPool,
    sql: &str,
    limit: Option<i64>,
    offset: Option<i64>,
    active_pids: &ActiveQueryPids,
    connection_id: &str,
) -> Result<QueryResult, String> {
    let start = Instant::now();

    // Get and store the backend PID for cancellation support
    let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to get backend PID: {}", e))?;

    active_pids.lock().await.insert(connection_id.to_string(), pid);

    let result = execute_query_inner(pool, sql, limit, offset, start).await;

    // Always clean up PID, even on error
    active_pids.lock().await.remove(connection_id);

    result
}
```

Extract the current query logic into a private helper:

```rust
async fn execute_query_inner(
    pool: &PgPool,
    sql: &str,
    limit: Option<i64>,
    offset: Option<i64>,
    start: Instant,
) -> Result<QueryResult, String> {
    // ... (existing body from lines 14-89, unchanged)
}
```

- [ ] **Step 3: Add cancel_query function in executor.rs**

Add at the end of `src-tauri/src/db/executor.rs`:

```rust
pub async fn cancel_query(
    pool: &PgPool,
    active_pids: &ActiveQueryPids,
    connection_id: &str,
) -> Result<(), String> {
    let pid = {
        let pids = active_pids.lock().await;
        pids.get(connection_id).copied()
    };

    let pid = pid.ok_or("No active query to cancel")?;

    sqlx::query("SELECT pg_cancel_backend($1)")
        .bind(pid)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to cancel query: {}", e))?;

    Ok(())
}
```

- [ ] **Step 4: Add cancel_query Tauri command**

Add to `src-tauri/src/commands/query.rs`:

```rust
use crate::db::executor::ActiveQueryPids;

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
) -> Result<(), String> {
    let manager = state.lock().await;
    let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
    let pool = manager.get_active_pool()?;
    executor::cancel_query(pool, &pids, &connection_id).await
}
```

- [ ] **Step 5: Update existing commands to pass PID state**

Update `execute_query` command in `src-tauri/src/commands/query.rs`:

```rust
#[tauri::command]
pub async fn execute_query(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    sql: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<QueryResult, String> {
    let manager = state.lock().await;
    let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
    let pool = manager.get_active_pool()?;
    executor::execute_query(pool, &sql, limit, offset, &pids, &connection_id).await
}
```

Update `preview_table` to also pass PIDs (it calls `executor::execute_query` directly):

```rust
#[tauri::command]
pub async fn preview_table(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    schema: String,
    table: String,
) -> Result<QueryResult, String> {
    let manager = state.lock().await;
    let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
    let pool = manager.get_active_pool()?;

    // Get total count
    let count_sql = format!("SELECT count(*) as total FROM \"{}\".\"{}\"", schema, table);
    let count_row = sqlx::query(&count_sql)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Count error: {}", e))?;
    let total: i64 = count_row.try_get("total").unwrap_or(0);

    // Get data
    let select_sql = format!("SELECT * FROM \"{}\".\"{}\" LIMIT 1000", schema, table);
    let mut result = executor::execute_query(pool, &select_sql, None, None, &pids, &connection_id).await?;
    result.total_rows = Some(total);

    Ok(result)
}
```

Update `export_csv` similarly:

```rust
#[tauri::command]
pub async fn export_csv(
    state: State<'_, SharedConnectionManager>,
    pids: State<'_, ActiveQueryPids>,
    sql: String,
) -> Result<String, String> {
    let manager = state.lock().await;
    let connection_id = manager.active_id().ok_or("No active connection")?.to_string();
    let pool = manager.get_active_pool()?;
    let result = executor::execute_query(pool, &sql, None, None, &pids, &connection_id).await?;

    // ... rest unchanged (CSV building logic from lines 54-84)
}
```

- [ ] **Step 6: Register PID state and cancel command in lib.rs**

In `src-tauri/src/lib.rs`, add the PID state management and register the new command:

```rust
use db::executor::create_active_query_pids;
```

Add `.manage(create_active_query_pids())` after the existing `.manage(create_connection_manager())` line.

Add `commands::query::cancel_query,` to the `invoke_handler` list under the query commands section.

- [ ] **Step 7: Build and verify Rust compiles**

Run: `cd /Users/augustodarochalinhares/ThreadCode/amendoim && cargo build --manifest-path src-tauri/Cargo.toml`

Expected: Successful compilation with no errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/db/executor.rs src-tauri/src/commands/query.rs src-tauri/src/lib.rs
git commit -m "feat: add query cancellation support via pg_cancel_backend"
```

---

### Task 2: Frontend — Tauri bridge, store, and i18n

**Files:**
- Modify: `src/lib/tauri.ts:94-102`
- Modify: `src/stores/queryStore.ts:43-63,154-186`
- Modify: `src/i18n/en.ts:54-56`
- Modify: `src/i18n/pt-BR.ts:51-54`

- [ ] **Step 1: Add cancelQuery to Tauri bridge**

Add after the `exportCsv` function in `src/lib/tauri.ts` (after line 102):

```typescript
export const cancelQuery = () =>
  invoke<void>("cancel_query");
```

- [ ] **Step 2: Add cancelQuery action to store interface**

In `src/stores/queryStore.ts`, add to the `QueryState` interface (after line 52, the `executeQuery` line):

```typescript
  cancelQuery: (id: string) => Promise<void>;
```

- [ ] **Step 3: Implement cancelQuery action in store**

Add after the `executeQuery` action (after line 186) in the `create` block:

```typescript
  cancelQuery: async (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || !tab.isExecuting) return;

    try {
      await api.cancelQuery();
    } catch (e) {
      // If cancel itself fails, still let the original query finish naturally
      console.warn("Cancel failed:", e);
    }
  },
```

- [ ] **Step 4: Handle cancellation error in executeQuery**

Modify the `catch` block in `executeQuery` (lines 176-185) to detect cancellation:

```typescript
    } catch (e) {
      const errorStr = String(e);
      const isCancelled = errorStr.includes("57014") || errorStr.toLowerCase().includes("cancel");
      if (!isCancelled) {
        trackEvent("query_error");
      }
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id
            ? {
                ...t,
                error: isCancelled ? t("results.cancelled") : errorStr,
                isExecuting: false,
              }
            : t
        ),
      }));
    }
```

Wait — `t()` is not available in the store. Instead, use a sentinel string that the UI can detect:

```typescript
    } catch (e) {
      const errorStr = String(e);
      const isCancelled = errorStr.includes("57014") || errorStr.toLowerCase().includes("cancel");
      if (!isCancelled) {
        trackEvent("query_error");
      }
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id
            ? {
                ...t,
                error: isCancelled ? null : errorStr,
                isExecuting: false,
              }
            : t
        ),
      }));
    }
```

When cancelled: set `error` to `null` (silently clear, no scary error). The results area will just show the previous result or empty state.

- [ ] **Step 5: Add i18n keys for Stop button**

In `src/i18n/pt-BR.ts`, add after line 53 (`"topBar.run"`):

```typescript
  "topBar.stop": "Parar",
  "topBar.cancelQuery": "Cancelar Query (Cmd+Enter)",
```

In `src/i18n/en.ts`, add after line 55 (`"topBar.run"`):

```typescript
  "topBar.stop": "Stop",
  "topBar.cancelQuery": "Cancel Query (Cmd+Enter)",
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/tauri.ts src/stores/queryStore.ts src/i18n/en.ts src/i18n/pt-BR.ts
git commit -m "feat: add cancel query action and i18n keys"
```

---

### Task 3: Frontend — TopBar Run/Stop toggle

**Files:**
- Modify: `src/components/layout/TopBar.tsx:1-78`
- Modify: `src/hooks/useQuery.ts:72-88`

- [ ] **Step 1: Add cancelQuery to useTabsQuery hook**

In `src/hooks/useQuery.ts`, add to `useTabsQuery` (line 72-88):

```typescript
export function useTabsQuery() {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const activeTab = useActiveTab();
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const removeTab = useQueryStore((s) => s.removeTab);
  const addTab = useQueryStore((s) => s.addTab);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const cancelQuery = useQueryStore((s) => s.cancelQuery);

  const executeActiveQuery = useCallback(() => {
    if (activeTab?.id) {
      executeQuery(activeTab.id);
    }
  }, [activeTab?.id, executeQuery]);

  const cancelActiveQuery = useCallback(() => {
    if (activeTab?.id) {
      cancelQuery(activeTab.id);
    }
  }, [activeTab?.id, cancelQuery]);

  return { tabs, activeTabId, activeTab, setActiveTab, removeTab, addTab, executeActiveQuery, cancelActiveQuery };
}
```

- [ ] **Step 2: Update TopBar to toggle Run/Stop**

Replace the TopBar component in `src/components/layout/TopBar.tsx`:

```tsx
import { X, Plus, Play, Square, Loader2, FileCode2 } from "lucide-react";
import { useTabsQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";

export function TopBar() {
  const t = useT();
  const { tabs, activeTabId, setActiveTab, removeTab, addTab, executeActiveQuery, cancelActiveQuery, activeTab } =
    useTabsQuery();

  const isExecuting = activeTab?.isExecuting ?? false;

  return (
    <div className="h-10 bg-bg-secondary border-b border-border flex items-center shrink-0">
      {/* Tabs */}
      <div className="flex-1 flex items-end h-full overflow-x-auto gap-px pl-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`group relative flex items-center gap-1.5 px-3 h-[34px] mt-auto cursor-pointer text-xs transition-colors rounded-t-lg ${
                isActive
                  ? "bg-bg-primary text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover/50"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <FileCode2 size={12} className={isActive ? "text-accent" : "text-text-faint"} />
              <span className="max-w-28 truncate">{tab.title}</span>
              {tab.isExecuting && (
                <Loader2 size={10} className="animate-spin text-accent" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className={`p-0.5 rounded transition-opacity ${
                  isActive
                    ? "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                    : "opacity-0 group-hover:opacity-100 text-text-faint hover:text-text-secondary hover:bg-bg-active"
                }`}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => addTab()}
          className="p-1.5 mx-1 my-auto rounded-md hover:bg-bg-hover text-text-faint hover:text-text-secondary transition-colors"
          title={t("topBar.newQuery")}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Run / Stop button */}
      <div className="flex items-center px-3 gap-2 shrink-0">
        <div className="text-[10px] text-text-faint hidden sm:block">
          {"\u2318"}Enter
        </div>
        {isExecuting ? (
          <button
            onClick={cancelActiveQuery}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-medium bg-error hover:bg-error/80 text-white transition-all active:scale-[0.97] shadow-sm"
            title={t("topBar.cancelQuery")}
          >
            <Square size={13} fill="currentColor" />
            <span>{t("topBar.stop")}</span>
          </button>
        ) : (
          <button
            onClick={executeActiveQuery}
            disabled={!activeTab || !activeTab.sql.trim()}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm shadow-accent/20"
            title={t("topBar.executeQuery")}
          >
            <Play size={13} fill="currentColor" />
            <span>{t("topBar.run")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update editor Cmd+Enter to toggle execute/cancel**

In `src/components/editor/SqlEditor.tsx`, the Monaco action at line 66-71 calls `executeActiveQuery()`. We need it to cancel if already executing. Update the `useEditorQuery` hook or handle it in the editor:

Modify `src/hooks/useQuery.ts` — update `useEditorQuery` to also expose cancel:

```typescript
export function useEditorQuery() {
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const isExecuting = useQueryStore((s) => {
    if (!s.activeTabId) return false;
    return s.tabs.find((t) => t.id === s.activeTabId)?.isExecuting ?? false;
  });
  const sql = useQueryStore((s) => {
    if (!s.activeTabId) return "";
    return s.tabs.find((t) => t.id === s.activeTabId)?.sql ?? "";
  });
  const updateSql = useQueryStore((s) => s.updateSql);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const cancelQuery = useQueryStore((s) => s.cancelQuery);

  const toggleActiveQuery = useCallback(() => {
    if (!activeTabId) return;
    if (isExecuting) {
      cancelQuery(activeTabId);
    } else {
      executeQuery(activeTabId);
    }
  }, [activeTabId, isExecuting, executeQuery, cancelQuery]);

  return {
    activeTab: activeTabId ? { id: activeTabId, sql } : null,
    updateSql,
    executeActiveQuery: toggleActiveQuery,
  };
}
```

This way the existing Monaco keybinding (`Cmd+Enter → executeActiveQuery()`) will automatically toggle between execute and cancel. No changes needed in `SqlEditor.tsx`.

- [ ] **Step 4: Build frontend and verify**

Run: `cd /Users/augustodarochalinhares/ThreadCode/amendoim && npm run build`

Expected: Successful build with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/TopBar.tsx src/hooks/useQuery.ts
git commit -m "feat: toggle Run/Stop button and Cmd+Enter for query cancellation"
```

---

### Task 4: Full build and manual test

**Files:** None (verification only)

- [ ] **Step 1: Full Tauri build check**

Run: `cd /Users/augustodarochalinhares/ThreadCode/amendoim && npm run tauri build -- --debug 2>&1 | tail -20`

Expected: Successful build.

- [ ] **Step 2: Version bump**

Update version in `src-tauri/tauri.conf.json` and `package.json` — bump patch version.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: query cancellation via pg_cancel_backend, bump version"
```

- [ ] **Step 4: Tag for release**

```bash
git tag v<new-version>
git push && git push --tags
```
