# Cancel Running Query

## Objective

Allow users to cancel a long-running query by clicking a Stop button in the TopBar. Uses PostgreSQL's `pg_cancel_backend(pid)` for graceful server-side cancellation.

## Rust Side (`src-tauri/`)

### PID Tracking

- Shared state: `Mutex<HashMap<String, i32>>` mapping `connection_id` to PostgreSQL backend PID
- Managed as Tauri app state

### Modified Query Execution (`db/executor.rs`)

1. Before user query: run `SELECT pg_backend_pid()` on the same connection, store PID in map
2. Execute user query normally
3. On completion (success or error): remove PID from map

### New Tauri Command: `cancel_query`

Location: `commands/query.rs`

1. Receive `connection_id` parameter
2. Look up PID in the shared map
3. Acquire a separate connection from the pool
4. Execute `SELECT pg_cancel_backend($1)` with the stored PID
5. PostgreSQL sends cancellation signal to the running query
6. The original query returns error code `57014` (query_canceled)

### Error Handling

- SQLx propagates the `57014` error naturally
- The frontend distinguishes cancellation from real errors using this code

## Frontend (`src/`)

### State (`stores/queryStore.ts`)

- New action: `cancelQuery(tabId: string)`
  - Gets `connectionId` from active connection
  - Calls `api.cancelQuery(connectionId)`
- No new state fields needed — `isExecuting` already tracks running state
- On error from `executeQuery`: check if error message contains the string `"57014"` (PostgreSQL query_canceled SQLSTATE)
  - If cancellation: set `error` to `"Query cancelada"` — displayed as neutral info, not red error styling
  - If real error: display normally with current red error styling

### Tauri Bridge (`lib/tauri.ts`)

- New function: `cancelQuery(connectionId: string): Promise<void>`
  - Invokes `cancel_query` Tauri command

### TopBar (`components/layout/TopBar.tsx`)

- When `isExecuting === false`: Run button with Play icon (current behavior)
- When `isExecuting === true`: button becomes Stop with Square icon, distinct color (red/accent)
- Click on Stop calls `cancelQuery` from the store
- Keyboard shortcut: `Cmd/Ctrl+Enter` toggles between execute and cancel based on `isExecuting`

### User Flow

1. User clicks Run (or Cmd+Enter) -> `isExecuting = true` -> button becomes Stop
2. User clicks Stop (or Cmd+Enter) -> calls `cancelQuery` -> Rust cancels via `pg_cancel_backend`
3. Original query returns cancellation error -> store detects it -> `isExecuting = false` -> button reverts to Run
4. Results area shows friendly "Query cancelada" message

## Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/db/executor.rs` | PID tracking before/after query execution |
| `src-tauri/src/commands/query.rs` | New `cancel_query` command |
| `src-tauri/src/lib.rs` | Register new command + shared PID state |
| `src/stores/queryStore.ts` | `cancelQuery` action + cancellation error handling |
| `src/lib/tauri.ts` | `cancelQuery` API function |
| `src/components/layout/TopBar.tsx` | Run/Stop toggle button |
