// Secrets (the OpenAI key, ChatGPT sign-in tokens) are kept in the operating system's keychain: Keychain on Mac,
// Credential Manager on Windows, the Secret Service on Linux. Only these names can be read or written.
use keyring::Entry;

const SERVICE: &str = "world.aaina.desktop";
const ALLOWED: [&str; 3] = ["openai_api_key", "chatgpt_tokens", "chatgpt_account"];

/// Only these names can be read, written or deleted; anything else a page asks for is refused.
fn is_allowed(name: &str) -> bool {
    ALLOWED.contains(&name)
}

fn entry(name: &str) -> Result<Entry, String> {
    if !is_allowed(name) {
        return Err("unknown secret".into());
    }
    Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

fn get(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn set(name: &str, value: &str) -> Result<(), String> {
    entry(name)?.set_password(value).map_err(|e| e.to_string())
}

fn delete(name: &str) -> Result<(), String> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// The commands are async so they run off the main thread: the system may ask the person to allow keychain access, and the
// window must keep drawing while that question is open.

#[tauri::command]
pub async fn secret_get(name: String) -> Result<Option<String>, String> {
    get(&name)
}

#[tauri::command]
pub async fn secret_set(name: String, value: String) -> Result<(), String> {
    set(&name, &value)
}

#[tauri::command]
pub async fn secret_delete(name: String) -> Result<(), String> {
    delete(&name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_exactly_the_three_names_the_app_stores() {
        for name in ["openai_api_key", "chatgpt_tokens", "chatgpt_account"] {
            assert!(is_allowed(name), "{name} should be allowed");
        }
        assert_eq!(ALLOWED.len(), 3);
    }

    #[test]
    fn refuses_everything_else() {
        for name in [
            "",
            "OPENAI_API_KEY",
            "openai_api_key ",
            " openai_api_key",
            "openai_api_key\n",
            "chatgpt",
            "chatgpt_tokens/../x",
            "../openai_api_key",
            "world.aaina.desktop",
            "password",
        ] {
            assert!(!is_allowed(name), "{name:?} should be refused");
        }
    }

    #[test]
    fn a_name_that_is_not_allowed_never_reaches_the_keychain() {
        assert_eq!(entry("something_else").err().as_deref(), Some("unknown secret"));
        assert_eq!(get("something_else").err().as_deref(), Some("unknown secret"));
        assert_eq!(set("something_else", "x").err().as_deref(), Some("unknown secret"));
        assert_eq!(delete("something_else").err().as_deref(), Some("unknown secret"));
    }
}
