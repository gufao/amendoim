use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use crate::models::connection::ConnectionConfig;

pub struct ConnectionManager {
    pools: HashMap<String, PgPool>,
    active_id: Option<String>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            pools: HashMap::new(),
            active_id: None,
        }
    }

    pub async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), String> {
        let conn_str = format!(
            "{}?keepalives=1&keepalives_idle=60",
            config.connection_string()
        );

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(10))
            .idle_timeout(Duration::from_secs(600))
            .test_before_acquire(true)
            .connect(&conn_str)
            .await
            .map_err(|e| format!("Failed to connect: {}", e))?;

        self.pools.insert(config.id.clone(), pool);
        self.active_id = Some(config.id.clone());
        Ok(())
    }

    pub async fn disconnect(&mut self, id: &str) -> Result<(), String> {
        if let Some(pool) = self.pools.remove(id) {
            pool.close().await;
        }
        if self.active_id.as_deref() == Some(id) {
            self.active_id = None;
        }
        Ok(())
    }

    pub async fn test_connection(config: &ConnectionConfig) -> Result<(), String> {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&config.connection_string())
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| format!("Query test failed: {}", e))?;

        pool.close().await;
        Ok(())
    }

    pub fn get_active_pool(&self) -> Result<&PgPool, String> {
        let id = self.active_id.as_ref().ok_or("No active connection")?;
        self.pools.get(id).ok_or("Connection pool not found".into())
    }

    pub fn active_id(&self) -> Option<&str> {
        self.active_id.as_deref()
    }

    pub fn is_connected(&self, id: &str) -> bool {
        self.pools.contains_key(id)
    }
}

pub type SharedConnectionManager = Arc<Mutex<ConnectionManager>>;

pub fn create_connection_manager() -> SharedConnectionManager {
    Arc::new(Mutex::new(ConnectionManager::new()))
}
