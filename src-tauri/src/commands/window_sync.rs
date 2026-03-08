/// ウィンドウ間同期コマンド
///
/// window-tab-session-design.md §11 に準拠:
/// - FileLockRegistry によるファイルロック管理
/// - ウィンドウ間のファイルロック取得・解放・譲渡
/// - タブをウィンドウに切り出す機能 (WebviewWindow)
///
/// ファイルは必ず 1 ウィンドウだけが書き込み権限を持ち、
/// 他のウィンドウは Read-Only モードでのみ開ける。

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// ファイルロック状態を Rust 側で一元管理する（Source of Truth）
///
/// key: ファイルの絶対パス
/// value: ロックを保有するウィンドウの label
pub struct FileLockRegistry(pub Mutex<HashMap<String, String>>);

impl FileLockRegistry {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }

    /// ロックの取得を試みる。成功すれば true を返す。
    pub fn try_acquire(&self, file_path: &str, window_label: &str) -> bool {
        let mut map = self.0.lock().unwrap();
        if map.contains_key(file_path) {
            return false;
        }
        map.insert(file_path.to_string(), window_label.to_string());
        true
    }

    /// ロックを解放する。保有者のみ解放できる。
    pub fn release(&self, file_path: &str, window_label: &str) -> bool {
        let mut map = self.0.lock().unwrap();
        if map.get(file_path).map(|s| s.as_str()) == Some(window_label) {
            map.remove(file_path);
            return true;
        }
        false
    }

    /// ロック保有者のウィンドウ label を返す。
    pub fn get_owner(&self, file_path: &str) -> Option<String> {
        self.0.lock().unwrap().get(file_path).cloned()
    }

    /// ロック保有者を別のウィンドウに移譲する。
    pub fn transfer(&self, file_path: &str, from_label: &str, to_label: &str) -> bool {
        let mut map = self.0.lock().unwrap();
        if map.get(file_path).map(|s| s.as_str()) == Some(from_label) {
            map.insert(file_path.to_string(), to_label.to_string());
            return true;
        }
        false
    }

    /// 特定ウィンドウが保有するすべてのロックを解放する（ウィンドウクローズ時）。
    pub fn release_all_for_window(&self, window_label: &str) -> Vec<String> {
        let mut map = self.0.lock().unwrap();
        let paths: Vec<String> = map
            .iter()
            .filter(|(_, label)| label.as_str() == window_label)
            .map(|(path, _)| path.clone())
            .collect();
        for path in &paths {
            map.remove(path);
        }
        paths
    }
}

/// ファイルロックの取得を試みる。
///
/// 成功: `{ acquired: true, ownerLabel: null }`
/// 失敗: `{ acquired: false, ownerLabel: "現在の保有者" }`
#[tauri::command]
pub fn try_acquire_file_lock(
    app: AppHandle,
    registry: State<FileLockRegistry>,
    file_path: String,
    window_label: String,
) -> serde_json::Value {
    if registry.try_acquire(&file_path, &window_label) {
        let _ = app.emit(
            "file-lock-acquired",
            serde_json::json!({
                "filePath": file_path,
                "windowLabel": window_label,
            }),
        );
        serde_json::json!({ "acquired": true, "ownerLabel": null })
    } else {
        let owner = registry.get_owner(&file_path);
        serde_json::json!({ "acquired": false, "ownerLabel": owner })
    }
}

/// ファイルロックを解放する。
#[tauri::command]
pub fn release_file_lock(
    app: AppHandle,
    registry: State<FileLockRegistry>,
    file_path: String,
    window_label: String,
) {
    if registry.release(&file_path, &window_label) {
        let _ = app.emit(
            "file-lock-released",
            serde_json::json!({
                "filePath": file_path,
                "windowLabel": window_label,
            }),
        );
    }
}

/// ファイルロックを譲渡する。
#[tauri::command]
pub fn transfer_file_lock(
    app: AppHandle,
    registry: State<FileLockRegistry>,
    file_path: String,
    from_label: String,
    to_label: String,
) -> bool {
    if registry.transfer(&file_path, &from_label, &to_label) {
        let _ = app.emit(
            "file-lock-released",
            serde_json::json!({
                "filePath": file_path,
                "windowLabel": from_label,
            }),
        );
        let _ = app.emit(
            "file-lock-acquired",
            serde_json::json!({
                "filePath": file_path,
                "windowLabel": to_label,
            }),
        );
        true
    } else {
        false
    }
}

/// 書き込み権限の拒否を通知する。
#[tauri::command]
pub fn notify_write_access_denied(
    app: AppHandle,
    file_path: String,
    requester_label: String,
) {
    let _ = app.emit_to(
        &requester_label,
        "write-access-denied",
        serde_json::json!({
            "filePath": file_path,
        }),
    );
}

/// タブを新しいウィンドウに切り出す。
///
/// 新しい WebviewWindow を作成し、元のウィンドウにタブ削除イベント、
/// 新しいウィンドウにファイル情報を送信する。
#[tauri::command]
pub async fn detach_tab_to_window(
    app: AppHandle,
    registry: State<'_, FileLockRegistry>,
    source_window_label: String,
    file_path: Option<String>,
    file_name: String,
    content: String,
    encoding: String,
    line_ending: String,
    file_type: String,
) -> Result<String, String> {
    // ウィンドウ連番を生成
    let window_id = {
        let counter = app
            .try_state::<WindowCounter>()
            .ok_or("WindowCounter state not found")?;
        counter.next()
    };
    let label = format!("detached-{}", window_id);

    // 新しい WebviewWindow を作成
    let _new_window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title(format!("{} - Markdown Editor", file_name))
        .inner_size(1000.0, 700.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("ウィンドウの作成に失敗しました: {}", e))?;

    // ファイルロックを新しいウィンドウに移譲
    if let Some(ref path) = file_path {
        registry.transfer(path, &source_window_label, &label);
    }

    // 新しいウィンドウにファイル情報を送信（ウィンドウ初期化後に受信される）
    let payload = serde_json::json!({
        "filePath": file_path,
        "fileName": file_name,
        "content": content,
        "encoding": encoding,
        "lineEnding": line_ending,
        "fileType": file_type,
    });

    // 少し待ってからイベントを送信（WebView の読み込み待ち）
    let label_clone = label.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let _ = app_clone.emit_to(&label_clone, "init-detached-tab", payload);
    });

    Ok(label)
}

/// ウィンドウ連番カウンタ
pub struct WindowCounter(Mutex<u32>);

impl WindowCounter {
    pub fn new() -> Self {
        Self(Mutex::new(0))
    }

    pub fn next(&self) -> u32 {
        let mut count = self.0.lock().unwrap();
        *count += 1;
        *count
    }
}
