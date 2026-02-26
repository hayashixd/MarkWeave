mod commands;
mod db;
mod fs;
mod menu;
mod models;

use commands::fs_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            fs_commands::read_file,
            fs_commands::write_file,
            fs_commands::file_exists,
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
