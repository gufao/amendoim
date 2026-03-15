use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "sc.linhares.amendoim";

fn account_key(connection_id: &str) -> String {
    format!("connection-{}", connection_id)
}

pub fn store_password(connection_id: &str, password: &str) -> Result<(), String> {
    let account = account_key(connection_id);
    // Delete existing entry first (set_generic_password fails if it already exists)
    let _ = delete_generic_password(SERVICE_NAME, &account);
    set_generic_password(SERVICE_NAME, &account, password.as_bytes())
        .map_err(|e| format!("Failed to store password in Keychain: {}", e))
}

pub fn get_password(connection_id: &str) -> Result<String, String> {
    let account = account_key(connection_id);
    let bytes = get_generic_password(SERVICE_NAME, &account)
        .map_err(|e| format!("Failed to retrieve password from Keychain: {}", e))?;
    String::from_utf8(bytes)
        .map_err(|e| format!("Invalid password encoding in Keychain: {}", e))
}

pub fn delete_password(connection_id: &str) -> Result<(), String> {
    let account = account_key(connection_id);
    delete_generic_password(SERVICE_NAME, &account)
        .map_err(|e| format!("Failed to delete password from Keychain: {}", e))
}
