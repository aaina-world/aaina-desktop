// Aaina Desktop's native side. Almost everything lives in the web view (src/); Rust only provides what a web page
// can't do safely: the system keychain for the OpenAI key and the ChatGPT sign-in tokens, and the sign-in redirect.
mod oauth;
mod secrets;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("aaina-desktop".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(2_000_000)
                .build(),
        )
        .manage(oauth::Loopback(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            oauth::oauth_loopback_start,
            oauth::oauth_loopback_wait
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aaina Desktop");
}
