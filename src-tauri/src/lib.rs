mod commands;
mod db;
mod fs;
mod menu;
mod models;

use commands::db_commands;
use commands::export_commands;
use commands::fs_commands;
use commands::git_commands;
use commands::image_commands;
use commands::plugin_commands;
use commands::recent_files;
use commands::search_commands;
use commands::watch_commands;
use commands::window_commands;
use commands::window_sync;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
        .manage(window_sync::FileLockRegistry::new())
        .manage(window_sync::WindowCounter::new())
        .manage(watch_commands::WatcherRegistry::new())
        .invoke_handler(tauri::generate_handler![
            export_commands::print_to_pdf,
            export_commands::check_pandoc,
            export_commands::export_with_pandoc,
            fs_commands::read_file,
            fs_commands::write_file,
            fs_commands::file_exists,
            fs_commands::get_path_info,
            fs_commands::list_workspace_files,
            fs_commands::list_markdown_files,
            fs_commands::rename_file,
            fs_commands::write_file_bytes,
            fs_commands::backup_file,
            fs_commands::move_to_trash,
            window_commands::set_title_dirty,
            window_commands::restart_app,
            window_sync::try_acquire_file_lock,
            window_sync::release_file_lock,
            window_sync::transfer_file_lock,
            window_sync::notify_write_access_denied,
            window_sync::detach_tab_to_window,
            window_sync::emit_to_window,
            plugin_commands::plugin_read_file,
            plugin_commands::plugin_write_file,
            plugin_commands::plugin_list_directory,
            plugin_commands::plugin_load_manifest,
            plugin_commands::plugin_install,
            plugin_commands::plugin_uninstall,
            plugin_commands::plugin_set_enabled,
            plugin_commands::is_safe_mode_active,
            plugin_commands::set_safe_mode,
            recent_files::add_to_recent_documents,
            db_commands::init_metadata_db,
            db_commands::index_workspace_metadata,
            db_commands::update_metadata_for_file,
            db_commands::execute_metadata_query,
            db_commands::get_graph_data,
            db_commands::get_backlinks,
            git_commands::git_status,
            git_commands::git_diff,
            git_commands::git_stage,
            git_commands::git_unstage,
            git_commands::git_commit,
            git_commands::git_log,
            git_commands::git_branch_info,
            watch_commands::watch_file,
            watch_commands::watch_workspace,
            image_commands::save_image,
            image_commands::cache_remote_image,
            image_commands::purge_image_cache,
            search_commands::search_workspace,
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
        .on_window_event(|window, event| {
            // ウィンドウが閉じられるとき、そのウィンドウが保持するファイルロックを全解放
            if let tauri::WindowEvent::Destroyed = event {
                let label = window.label().to_string();
                if let Some(registry) = window.try_state::<window_sync::FileLockRegistry>() {
                    let released = registry.release_all_for_window(&label);
                    for path in released {
                        let _ = window.emit("file-lock-released", serde_json::json!({
                            "filePath": path,
                            "windowLabel": label,
                        }));
                    }
                }
            }
        })
        .setup(|app| {
            // ネイティブメニューバーを構築 (app-shell-design.md §2)
            let handle = app.handle().clone();
            if let Err(e) = menu::native_menu::build_menu(&handle) {
                log::error!("Failed to build native menu: {}", e);
            }
            menu::native_menu::setup_menu_event_handler(&handle);

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
