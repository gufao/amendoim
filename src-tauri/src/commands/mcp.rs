use std::sync::Arc;

use serde::Serialize;
use tauri::State;
use tokio::sync::{oneshot, Mutex};

use crate::db::connection::SharedConnectionManager;
use crate::mcp::server;

/// Minimal stdio-to-HTTP bridge for Claude Desktop (no external deps, works with any Node version)
const MCP_BRIDGE_SCRIPT: &str = r#"
const http = require("http");
const readline = require("readline");
const url = new URL(process.argv[2] || "http://127.0.0.1:7432/mcp");
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const req = http.request(
    { hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" } },
    (res) => { let d = ""; res.on("data", (c) => d += c); res.on("end", () => { if (d.trim()) process.stdout.write(d + "\n"); }); }
  );
  req.on("error", (e) => {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Amendoim not running: " + e.message } }) + "\n");
  });
  req.write(line);
  req.end();
});
"#;


pub struct McpServerState {
    pub is_running: bool,
    pub port: u16,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
}

pub type SharedMcpState = Arc<Mutex<McpServerState>>;

pub fn create_mcp_state() -> SharedMcpState {
    Arc::new(Mutex::new(McpServerState {
        is_running: false,
        port: 7432,
        shutdown_tx: None,
    }))
}

#[derive(Serialize)]
pub struct McpStatus {
    pub is_running: bool,
    pub port: u16,
    pub url: String,
}

#[tauri::command]
pub async fn start_mcp_server(
    app_handle: tauri::AppHandle,
    mcp_state: State<'_, SharedMcpState>,
    conn_state: State<'_, SharedConnectionManager>,
) -> Result<McpStatus, String> {
    let mut state = mcp_state.lock().await;
    if state.is_running {
        return Ok(McpStatus {
            is_running: true,
            port: state.port,
            url: format!("http://127.0.0.1:{}/sse", state.port),
        });
    }

    let port = state.port;
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let conn_manager = conn_state.inner().clone();

    let mcp_state_clone = mcp_state.inner().clone();
    tokio::spawn(async move {
        let result = server::start_server(port, conn_manager, app_handle, shutdown_rx).await;
        // When server stops, update state
        let mut s = mcp_state_clone.lock().await;
        s.is_running = false;
        s.shutdown_tx = None;
        if let Err(e) = result {
            eprintln!("MCP server error: {}", e);
        }
    });

    state.is_running = true;
    state.shutdown_tx = Some(shutdown_tx);

    Ok(McpStatus {
        is_running: true,
        port,
        url: format!("http://127.0.0.1:{}/sse", port),
    })
}

#[tauri::command]
pub async fn stop_mcp_server(
    mcp_state: State<'_, SharedMcpState>,
) -> Result<(), String> {
    let mut state = mcp_state.lock().await;
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(());
    }
    state.is_running = false;
    Ok(())
}

#[tauri::command]
pub async fn get_mcp_status(
    mcp_state: State<'_, SharedMcpState>,
) -> Result<McpStatus, String> {
    let state = mcp_state.lock().await;
    Ok(McpStatus {
        is_running: state.is_running,
        port: state.port,
        url: format!("http://127.0.0.1:{}/sse", state.port),
    })
}

#[tauri::command]
pub async fn install_mcp_client(
    client: String,
    mcp_state: State<'_, SharedMcpState>,
) -> Result<String, String> {
    let state = mcp_state.lock().await;
    let port = state.port;
    let url = format!("http://127.0.0.1:{}/sse", port);
    drop(state);

    match client.as_str() {
        "claude-code" => {
            let output = std::process::Command::new("claude")
                .args(["mcp", "add", "amendoim", "--transport", "sse", &url])
                .output()
                .map_err(|e| {
                    format!(
                        "Failed to run 'claude' command. Is Claude Code installed? Error: {}",
                        e
                    )
                })?;

            if output.status.success() {
                Ok("Amendoim added to Claude Code successfully!".into())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Failed: {}", stderr))
            }
        }
        "claude-desktop" => {
            let config_path = dirs::home_dir()
                .ok_or("Could not find home directory")?
                .join("Library/Application Support/Claude/claude_desktop_config.json");

            let mut config: serde_json::Value = if config_path.exists() {
                let content = std::fs::read_to_string(&config_path)
                    .map_err(|e| format!("Failed to read config: {}", e))?;
                serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse config: {}", e))?
            } else {
                serde_json::json!({})
            };

            if config.get("mcpServers").is_none() {
                config["mcpServers"] = serde_json::json!({});
            }
            // Claude Desktop only supports stdio — write a tiny bridge script
            let bridge_dir = dirs::home_dir()
                .ok_or("Could not find home directory")?
                .join(".amendoim");
            std::fs::create_dir_all(&bridge_dir)
                .map_err(|e| format!("Failed to create ~/.amendoim: {}", e))?;

            let bridge_path = bridge_dir.join("mcp-bridge.js");
            std::fs::write(&bridge_path, MCP_BRIDGE_SCRIPT)
                .map_err(|e| format!("Failed to write bridge script: {}", e))?;

            config["mcpServers"]["amendoim"] = serde_json::json!({
                "command": "node",
                "args": [bridge_path.to_string_lossy(), format!("http://127.0.0.1:{}/mcp", port)]
            });

            if let Some(parent) = config_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }

            std::fs::write(
                &config_path,
                serde_json::to_string_pretty(&config).unwrap(),
            )
            .map_err(|e| format!("Failed to write config: {}", e))?;

            Ok("Amendoim added to Claude Desktop. Restart Claude Desktop to apply.".into())
        }
        _ => Err(format!("Unknown client: {}", client)),
    }
}
