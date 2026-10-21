// Aaina Desktop's native side. Almost everything lives in the web view (src/); Rust only provides what a web page
// can't do safely: the system keychain for the OpenAI key and the ChatGPT sign-in tokens, and the sign-in redirect.
mod oauth;
mod secrets;

use tauri::{DragDropEvent, Manager, WebviewEvent};
use tauri_plugin_fs::FsExt;

/// Photos dragged onto the window may be read (and shown) by the page: the files themselves, nothing around them.
fn allow_dropped(webview: &tauri::Webview, paths: &[std::path::PathBuf]) {
    for path in paths {
        let photo = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| matches!(e.to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "png" | "webp"))
            .unwrap_or(false);
        if photo && path.is_file() {
            let _ = webview.fs_scope().allow_file(path);
            let _ = webview.asset_protocol_scope().allow_file(path);
        }
    }
}

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
        // Folders chosen in a file window (photos folder, save folder, a backup) stay allowed after a restart.
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .on_webview_event(|webview, event| {
            if let WebviewEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                allow_dropped(webview, paths);
            }
        })
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
