use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
}

impl ConnectionConfig {
    pub fn connection_string(&self) -> String {
        format!(
            "postgres://{}:{}@{}:{}/{}",
            urlencoding::encode(&self.user),
            urlencoding::encode(&self.password),
            urlencoding::encode(&self.host),
            self.port,
            urlencoding::encode(&self.database),
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnections {
    pub connections: Vec<ConnectionConfig>,
}

impl Default for SavedConnections {
    fn default() -> Self {
        Self {
            connections: Vec::new(),
        }
    }
}
