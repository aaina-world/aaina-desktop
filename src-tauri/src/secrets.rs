// Secrets (the OpenAI key, ChatGPT sign-in tokens) are kept in the operating system's keychain: Keychain on Mac,
// Credential Manager on Windows, the Secret Service (GNOME Keyring, KWallet) on Linux. Only these names can be read or
// written.
//
// Windows keeps at most about 2.5 KB in one credential, and the ChatGPT tokens are longer, so a long value is kept in
// numbered parts ("chatgpt_tokens.1", ".2", …) with the main entry saying how many there are. Every system does the same,
// so a value always reads back the way it was written.
use keyring::Entry;

const SERVICE: &str = "world.aaina.desktop";
const ALLOWED: [&str; 3] = ["openai_api_key", "chatgpt_tokens", "chatgpt_account"];
/// Characters in one part: well under every keychain's limit (Windows stores UTF-16, 1280 characters at most).
const PART: usize = 1000;
/// What the main entry holds when the value is in parts. No real key or token starts like this.
const PARTS_MARK: &str = "aaina-parts:";
/// Errors the screens turn into plain words (see src/lib/data/secrets.ts).
const UNAVAILABLE: &str = "KEYCHAIN_UNAVAILABLE";

/// Only these names can be read, written or deleted; anything else a page asks for is refused.
fn is_allowed(name: &str) -> bool {
    ALLOWED.contains(&name)
}

/// The keychain itself, behind a trait so the part logic can be tested without one.
trait Store {
    fn get(&self, key: &str) -> Result<Option<String>, String>;
    fn set(&self, key: &str, value: &str) -> Result<(), String>;
    fn delete(&self, key: &str) -> Result<(), String>;
}

struct Keychain;

fn unavailable(e: keyring::Error) -> String {
    match e {
        keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_) => format!("{UNAVAILABLE}: {e}"),
        other => other.to_string(),
    }
}

impl Store for Keychain {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        match Entry::new(SERVICE, key).map_err(unavailable)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(unavailable(e)),
        }
    }
    fn set(&self, key: &str, value: &str) -> Result<(), String> {
        Entry::new(SERVICE, key)
            .map_err(unavailable)?
            .set_password(value)
            .map_err(unavailable)
    }
    fn delete(&self, key: &str) -> Result<(), String> {
        match Entry::new(SERVICE, key).map_err(unavailable)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(unavailable(e)),
        }
    }
}

fn part_key(name: &str, i: usize) -> String {
    format!("{name}.{i}")
}

fn part_count(main: &str) -> Option<usize> {
    main.strip_prefix(PARTS_MARK)?.parse().ok()
}

fn checked(name: &str) -> Result<(), String> {
    if is_allowed(name) { Ok(()) } else { Err("unknown secret".into()) }
}

fn get_in(store: &dyn Store, name: &str) -> Result<Option<String>, String> {
    checked(name)?;
    let Some(main) = store.get(name)? else { return Ok(None) };
    let Some(count) = part_count(&main) else { return Ok(Some(main)) };
    let mut value = String::new();
    for i in 1..=count {
        match store.get(&part_key(name, i))? {
            Some(part) => value.push_str(&part),
            None => return Ok(None), // a part went missing: treat it as never saved
        }
    }
    Ok(Some(value))
}

fn delete_parts(store: &dyn Store, name: &str) -> Result<(), String> {
    if let Some(count) = store.get(name)?.as_deref().and_then(part_count) {
        for i in 1..=count {
            store.delete(&part_key(name, i))?;
        }
    }
    Ok(())
}

fn set_in(store: &dyn Store, name: &str, value: &str) -> Result<(), String> {
    checked(name)?;
    delete_parts(store, name)?;
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= PART && !value.starts_with(PARTS_MARK) {
        return store.set(name, value);
    }
    let parts: Vec<String> = chars.chunks(PART).map(|c| c.iter().collect()).collect();
    for (i, part) in parts.iter().enumerate() {
        store.set(&part_key(name, i + 1), part)?;
    }
    store.set(name, &format!("{PARTS_MARK}{}", parts.len()))
}

fn delete_in(store: &dyn Store, name: &str) -> Result<(), String> {
    checked(name)?;
    delete_parts(store, name)?;
    store.delete(name)
}

// The commands are async so they run off the main thread: the system may ask the person to allow keychain access, and the
// window must keep drawing while that question is open.

#[tauri::command]
pub async fn secret_get(name: String) -> Result<Option<String>, String> {
    get_in(&Keychain, &name)
}

#[tauri::command]
pub async fn secret_set(name: String, value: String) -> Result<(), String> {
    set_in(&Keychain, &name, &value)
}

#[tauri::command]
pub async fn secret_delete(name: String) -> Result<(), String> {
    delete_in(&Keychain, &name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::BTreeMap;

    /// A keychain in memory that, like Windows, refuses values over 1280 characters.
    #[derive(Default)]
    struct Memory(RefCell<BTreeMap<String, String>>);
    impl Store for Memory {
        fn get(&self, key: &str) -> Result<Option<String>, String> {
            Ok(self.0.borrow().get(key).cloned())
        }
        fn set(&self, key: &str, value: &str) -> Result<(), String> {
            if value.encode_utf16().count() > 1280 {
                return Err("too long".into());
            }
            self.0.borrow_mut().insert(key.into(), value.into());
            Ok(())
        }
        fn delete(&self, key: &str) -> Result<(), String> {
            self.0.borrow_mut().remove(key);
            Ok(())
        }
    }

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
            "chatgpt_tokens.1",
            "../openai_api_key",
            "world.aaina.desktop",
            "password",
        ] {
            assert!(!is_allowed(name), "{name:?} should be refused");
        }
    }

    #[test]
    fn a_name_that_is_not_allowed_never_reaches_the_keychain() {
        let store = Memory::default();
        assert_eq!(get_in(&store, "something_else").err().as_deref(), Some("unknown secret"));
        assert_eq!(set_in(&store, "something_else", "x").err().as_deref(), Some("unknown secret"));
        assert_eq!(delete_in(&store, "something_else").err().as_deref(), Some("unknown secret"));
        assert_eq!(get_in(&store, "chatgpt_tokens.1").err().as_deref(), Some("unknown secret"));
        assert!(store.0.borrow().is_empty());
    }

    #[test]
    fn a_short_value_is_one_entry() {
        let store = Memory::default();
        set_in(&store, "openai_api_key", "sk-proj-abc").unwrap();
        assert_eq!(get_in(&store, "openai_api_key").unwrap().as_deref(), Some("sk-proj-abc"));
        assert_eq!(store.0.borrow().len(), 1);
    }

    #[test]
    fn a_long_value_is_kept_in_parts_and_reads_back_whole() {
        let store = Memory::default();
        let tokens = format!("{{\"accessToken\":\"{}\",\"idToken\":\"{}\"}}", "a".repeat(2600), "é".repeat(1500));
        set_in(&store, "chatgpt_tokens", &tokens).unwrap();
        assert_eq!(get_in(&store, "chatgpt_tokens").unwrap().as_deref(), Some(tokens.as_str()));
        assert!(store.0.borrow().len() > 2);
    }

    #[test]
    fn writing_again_or_deleting_leaves_no_old_parts_behind() {
        let store = Memory::default();
        set_in(&store, "chatgpt_tokens", &"x".repeat(4500)).unwrap();
        set_in(&store, "chatgpt_tokens", &"y".repeat(1500)).unwrap();
        assert_eq!(get_in(&store, "chatgpt_tokens").unwrap(), Some("y".repeat(1500)));
        assert_eq!(store.0.borrow().len(), 3); // the main entry and two parts
        set_in(&store, "chatgpt_tokens", "short").unwrap();
        assert_eq!(store.0.borrow().len(), 1);
        delete_in(&store, "chatgpt_tokens").unwrap();
        assert!(store.0.borrow().is_empty());
    }

    #[test]
    fn a_value_saved_before_parts_existed_still_reads() {
        let store = Memory::default();
        store.set("openai_api_key", "sk-old").unwrap();
        assert_eq!(get_in(&store, "openai_api_key").unwrap().as_deref(), Some("sk-old"));
    }

    #[test]
    fn a_missing_part_reads_as_not_saved() {
        let store = Memory::default();
        set_in(&store, "chatgpt_tokens", &"z".repeat(2500)).unwrap();
        store.delete("chatgpt_tokens.2").unwrap();
        assert_eq!(get_in(&store, "chatgpt_tokens").unwrap(), None);
    }

    /// The real keychain of this computer. Run with `cargo test -- --ignored` where one is available (CI does, on Windows
    /// and on Linux with GNOME Keyring).
    #[test]
    #[ignore]
    fn the_system_keychain_keeps_a_long_value() {
        let tokens = format!("{{\"accessToken\":\"{}\"}}", "t".repeat(5000));
        set_in(&Keychain, "chatgpt_tokens", &tokens).unwrap();
        assert_eq!(get_in(&Keychain, "chatgpt_tokens").unwrap().as_deref(), Some(tokens.as_str()));
        delete_in(&Keychain, "chatgpt_tokens").unwrap();
        assert_eq!(get_in(&Keychain, "chatgpt_tokens").unwrap(), None);
    }
}
