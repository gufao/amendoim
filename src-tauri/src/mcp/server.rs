use std::collections::HashMap;
use std::convert::Infallible;
use std::fs;
use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use tauri::Manager;
use tokio::sync::{mpsc, Mutex};

use crate::db::connection::SharedConnectionManager;
use crate::models::connection::SavedConnections;

use super::protocol::{JsonRpcRequest, JsonRpcResponse};
use super::tools;

struct McpSession {
    tx: mpsc::UnboundedSender<String>,
}

#[derive(Clone)]
struct McpAppState {
    sessions: Arc<Mutex<HashMap<String, McpSession>>>,
    connection_manager: SharedConnectionManager,
    app_handle: tauri::AppHandle,
}

pub async fn start_server(
    listener: tokio::net::TcpListener,
    connection_manager: SharedConnectionManager,
    app_handle: tauri::AppHandle,
    shutdown_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    let state = McpAppState {
        sessions: Arc::new(Mutex::new(HashMap::new())),
        connection_manager,
        app_handle,
    };

    let app = Router::new()
        // Streamable HTTP transport (newer clients: Claude Desktop, etc.)
        .route("/mcp", post(streamable_handler))
        // SSE transport (Claude Code, Gemini CLI, etc.)
        .route("/sse", get(sse_handler))
        .route("/messages", post(message_handler))
        .with_state(state);

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        })
        .await
        .map_err(|e| format!("Server error: {}", e))
}

// --- Streamable HTTP transport (POST /mcp) ---

async fn streamable_handler(
    State(state): State<McpAppState>,
    headers: HeaderMap,
    Json(request): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    // Notifications (no id) don't need a response
    if request.id.is_none() {
        return StatusCode::ACCEPTED.into_response();
    }

    let response = handle_request(&state, &request).await;

    // Check if client wants SSE
    let accept = headers
        .get("accept")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if accept.contains("text/event-stream") {
        // Return as SSE stream with a single event
        let json_str = serde_json::to_string(&response).unwrap_or_default();
        let stream = async_stream::stream! {
            yield Ok::<_, Infallible>(
                Event::default().event("message").data(json_str)
            );
        };
        Sse::new(stream).into_response()
    } else {
        // Return as plain JSON
        Json(serde_json::to_value(&response).unwrap_or_default()).into_response()
    }
}

// --- SSE transport (GET /sse + POST /messages) ---

async fn sse_handler(State(state): State<McpAppState>) -> impl IntoResponse {
    let session_id = uuid::Uuid::new_v4().to_string();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    state
        .sessions
        .lock()
        .await
        .insert(session_id.clone(), McpSession { tx });

    let endpoint = format!("/messages?sessionId={}", session_id);

    let stream = async_stream::stream! {
        yield Ok::<_, Infallible>(
            Event::default().event("endpoint").data(endpoint)
        );

        while let Some(msg) = rx.recv().await {
            yield Ok::<_, Infallible>(
                Event::default().event("message").data(msg)
            );
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}

#[derive(Deserialize)]
struct MessageQuery {
    #[serde(rename = "sessionId")]
    session_id: String,
}

async fn message_handler(
    State(state): State<McpAppState>,
    Query(query): Query<MessageQuery>,
    Json(request): Json<JsonRpcRequest>,
) -> StatusCode {
    // Notifications (no id) don't need a response
    if request.id.is_none() {
        return StatusCode::ACCEPTED;
    }

    let response = handle_request(&state, &request).await;

    let sessions = state.sessions.lock().await;
    if let Some(session) = sessions.get(&query.session_id) {
        if let Ok(json_str) = serde_json::to_string(&response) {
            let _ = session.tx.send(json_str);
        }
    }

    StatusCode::ACCEPTED
}

// --- Shared request handler ---

async fn handle_request(state: &McpAppState, request: &JsonRpcRequest) -> JsonRpcResponse {
    match request.method.as_str() {
        "initialize" => JsonRpcResponse::success(
            request.id.clone(),
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "amendoim",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
        ),

        "tools/list" => JsonRpcResponse::success(
            request.id.clone(),
            json!({
                "tools": tools::tool_definitions()
            }),
        ),

        "tools/call" => {
            let params = request.params.as_ref();
            let tool_name = params
                .and_then(|p| p.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let arguments = params
                .and_then(|p| p.get("arguments"))
                .cloned()
                .unwrap_or(json!({}));

            // execute_query is dispatched to the frontend; no DB pool needed.
            if tool_name == "execute_query" {
                return match tools::handle_execute_query(&arguments, &state.app_handle) {
                    Ok(result) => JsonRpcResponse::success(request.id.clone(), result),
                    Err(e) => JsonRpcResponse::success(
                        request.id.clone(),
                        json!({
                            "content": [{"type": "text", "text": format!("Error: {}", e)}],
                            "isError": true
                        }),
                    ),
                };
            }

            // list_connections enumerates saved connections and marks which
            // are currently connected, so the AI can ask the user to choose.
            if tool_name == "list_connections" {
                return match list_connections_text(&state).await {
                    Ok(text) => JsonRpcResponse::success(
                        request.id.clone(),
                        json!({"content": [{"type": "text", "text": text}]}),
                    ),
                    Err(e) => JsonRpcResponse::success(
                        request.id.clone(),
                        json!({
                            "content": [{"type": "text", "text": format!("Error: {}", e)}],
                            "isError": true
                        }),
                    ),
                };
            }

            // Schema tools need DB access. If connection_id is provided, route
            // to that specific pool; otherwise fall back to the active one.
            let connection_id = arguments
                .get("connection_id")
                .and_then(|v| v.as_str());
            let manager = state.connection_manager.lock().await;
            let pool_result = match connection_id {
                Some(id) => manager.get_pool_by_id(id),
                None => manager.get_active_pool(),
            };
            match pool_result {
                Ok(pool) => {
                    match tools::handle_schema_tool(pool, tool_name, &arguments).await {
                        Ok(result) => JsonRpcResponse::success(request.id.clone(), result),
                        Err(e) => JsonRpcResponse::success(
                            request.id.clone(),
                            json!({
                                "content": [{"type": "text", "text": format!("Error: {}", e)}],
                                "isError": true
                            }),
                        ),
                    }
                }
                Err(e) => JsonRpcResponse::success(
                    request.id.clone(),
                    json!({
                        "content": [{"type": "text", "text": format!("{}. Use list_connections to see available connections.", e)}],
                        "isError": true
                    }),
                ),
            }
        }

        "ping" => JsonRpcResponse::success(request.id.clone(), json!({})),

        _ => JsonRpcResponse::error(
            request.id.clone(),
            -32601,
            format!("Method not found: {}", request.method),
        ),
    }
}

async fn list_connections_text(state: &McpAppState) -> Result<String, String> {
    let path = state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("connections.json");

    let saved: SavedConnections = if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read connections: {}", e))?;
        serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse connections: {}", e))?
    } else {
        SavedConnections::default()
    };

    let manager = state.connection_manager.lock().await;
    let active = manager.active_id().map(|s| s.to_string());
    let connected: std::collections::HashSet<String> =
        manager.connected_ids().into_iter().collect();
    drop(manager);

    if saved.connections.is_empty() {
        return Ok("No saved connections.".to_string());
    }

    let mut lines = Vec::new();
    for c in &saved.connections {
        let is_connected = connected.contains(&c.id);
        let is_active = active.as_deref() == Some(c.id.as_str());
        let mut tags = Vec::new();
        if is_active {
            tags.push("active");
        } else if is_connected {
            tags.push("connected");
        } else {
            tags.push("not connected");
        }
        lines.push(format!(
            "- id: {}\n  name: {}\n  host: {}:{}\n  database: {}\n  status: {}",
            c.id,
            c.name,
            c.host,
            c.port,
            c.database,
            tags.join(", ")
        ));
    }
    Ok(format!(
        "Connections (pass `connection_id` to other tools to select one):\n{}",
        lines.join("\n")
    ))
}
