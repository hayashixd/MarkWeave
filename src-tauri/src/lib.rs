mod commands;
mod db;
mod fs;
mod menu;
mod models;

use commands::fs_commands;
use commands::window_commands;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // 2つ目の起動試行時に呼ばれる
            // argv = ["app_path", "/path/to/file.md", ...]
            if let Some(path) = argv.get(1) {
                let _ = app.emit("open-file-request", path.as_str());
            }
            // 既存ウィンドウをフォアグラウンドに表示
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            fs_commands::read_file,
            fs_commands::write_file,
            fs_commands::file_exists,
            window_commands::set_title_dirty,
        ])
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("app".into()),
                    }),
                ])
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .max_file_size(5_000_000)
                .level(log::LevelFilter::Info)
                .level_for("app_lib", log::LevelFilter::Debug)
                .build(),
        )
        .setup(|app| {
            // 初回起動時のコマンドライン引数からファイルパスを処理
            let args: Vec<String> = std::env::args().collect();
            if let Some(path) = args.get(1) {
                let _ = app.emit("open-file-request", path.as_str());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
