//! ファイル・ワークスペース監視用 Tauri コマンド。
//!
//! tauri-ipc-interface.md §1 `watch_file` / §2 `watch_workspace` に準拠。
//! `notify` クレートを使用してファイルシステムの変更を監視し、
//! フロントエンドに Tauri イベントとして通知する。

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

/// 監視中の watcher を管理するレジストリ。
/// ファイルパス → Watcher のマッピングを保持する。
pub struct WatcherRegistry {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl WatcherRegistry {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

/// 単一ファイルの変更を監視する Tauri コマンド。
///
/// tauri-ipc-interface.md §1 `watch_file` に準拠。
/// ファイルが変更されると `event_name` でイベントを emit する。
#[tauri::command]
pub async fn watch_file(
    app: AppHandle,
    registry: State<'_, WatcherRegistry>,
    path: String,
    event_name: String,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);
    if !watch_path.exists() {
        return Err(format!(
            "FILE_NOT_FOUND: ファイルが見つかりません: {}",
            path
        ));
    }

    let app_handle = app.clone();
    let event_name_clone = event_name.clone();
    let path_clone = path.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {
                        let _ = app_handle.emit(
                            &event_name_clone,
                            serde_json::json!({
                                "path": path_clone,
                                "kind": format!("{:?}", event.kind),
                            }),
                        );
                    }
                    _ => {}
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("IO_ERROR: ファイル監視の開始に失敗: {}", e))?;

    watcher
        .watch(watch_path.as_path(), RecursiveMode::NonRecursive)
        .map_err(|e| format!("IO_ERROR: ファイル監視の登録に失敗: {}", e))?;

    // レジストリに保存して watcher がドロップされないようにする
    let mut watchers = registry
        .watchers
        .lock()
        .map_err(|e| format!("IO_ERROR: ロック取得エラー: {}", e))?;
    watchers.insert(path, watcher);

    Ok(())
}

/// ワークスペースディレクトリの変更を監視する Tauri コマンド。
///
/// tauri-ipc-interface.md §2 `watch_workspace` に準拠。
/// ファイルの作成・変更・削除・リネームを検知し `event_name` でイベントを emit する。
#[tauri::command]
pub async fn watch_workspace(
    app: AppHandle,
    registry: State<'_, WatcherRegistry>,
    root_path: String,
    event_name: String,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&root_path);
    if !watch_path.is_dir() {
        return Err(format!(
            "FILE_NOT_FOUND: ディレクトリが見つかりません: {}",
            root_path
        ));
    }

    let app_handle = app.clone();
    let event_name_clone = event_name.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let event_type = match event.kind {
                    EventKind::Create(_) => "created",
                    EventKind::Modify(notify::event::ModifyKind::Name(_)) => "renamed",
                    EventKind::Modify(_) => "modified",
                    EventKind::Remove(_) => "deleted",
                    _ => return,
                };

                let path = event
                    .paths
                    .first()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let old_path = if event_type == "renamed" {
                    event.paths.get(1).map(|p| p.to_string_lossy().to_string())
                } else {
                    None
                };

                let _ = app_handle.emit(
                    &event_name_clone,
                    serde_json::json!({
                        "type": event_type,
                        "path": path,
                        "oldPath": old_path,
                    }),
                );
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("IO_ERROR: ワークスペース監視の開始に失敗: {}", e))?;

    watcher
        .watch(watch_path.as_path(), RecursiveMode::Recursive)
        .map_err(|e| format!("IO_ERROR: ワークスペース監視の登録に失敗: {}", e))?;

    let mut watchers = registry
        .watchers
        .lock()
        .map_err(|e| format!("IO_ERROR: ロック取得エラー: {}", e))?;
    watchers.insert(root_path, watcher);

    Ok(())
}
