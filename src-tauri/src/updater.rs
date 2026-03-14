//! 自動アップデート機能 (distribution-design.md §5)
//!
//! - 起動時にバックグラウンドでアップデートをチェックし、見つかれば `update-available` イベントを emit。
//! - フロントエンドから `check_for_updates` コマンドを呼び出すと手動チェックを実行。
//! - フロントエンドから `install_update` コマンドを呼び出すとダウンロード＋インストールを実行。

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

/// フロントエンドに送る「アップデートあり」通知の型
#[derive(Clone, Serialize)]
pub struct UpdateAvailablePayload {
    pub version: String,
    pub body: String,
}

/// 保留中のアップデートを保持するアプリ状態
pub struct PendingUpdate(pub Mutex<Option<tauri_plugin_updater::Update>>);

/// 起動時バックグラウンドチェック（lib.rs の setup() から spawn）
pub async fn background_check(app: AppHandle) {
    if let Err(e) = do_check(&app, false).await {
        log::warn!("起動時アップデートチェック失敗: {e}");
    }
}

/// Tauri コマンド: 手動でアップデートを確認する
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<bool, String> {
    do_check(&app, true).await.map_err(|e| e.to_string())
}

/// Tauri コマンド: ダウンロード＋インストールを実行する
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let pending = app
        .try_state::<PendingUpdate>()
        .ok_or("アップデート情報が見つかりません")?;

    let update = {
        let mut guard = pending.0.lock().unwrap();
        guard.take()
    };

    let Some(update) = update else {
        return Err("インストール待ちのアップデートがありません".to_string());
    };

    let app_clone = app.clone();
    update
        .download_and_install(
            |downloaded, total| {
                if let Some(total) = total {
                    let percent = (downloaded as f64 / total as f64 * 100.0) as u32;
                    let _ = app_clone.emit("update-progress", percent);
                }
            },
            || {
                let _ = app.emit("update-installed", ());
            },
        )
        .await
        .map_err(|e| e.to_string())
}

// ─── internal ────────────────────────────────────────────────────────────────

/// アップデートをチェックし、見つかれば `update-available` イベントを emit してアプリ状態に保存する。
/// `notify_not_found` が true のときは最新版でも `update-not-found` を emit する（手動確認時）。
async fn do_check(app: &AppHandle, notify_not_found: bool) -> anyhow::Result<bool> {
    let updater = app.updater().map_err(|e| anyhow::anyhow!("{e}"))?;

    match updater.check().await {
        Ok(Some(update)) => {
            let payload = UpdateAvailablePayload {
                version: update.version.clone(),
                body: update.body.clone().unwrap_or_default(),
            };
            app.emit("update-available", payload)?;

            // アプリ状態に保存（install_update コマンドで使用）
            if let Some(state) = app.try_state::<PendingUpdate>() {
                *state.0.lock().unwrap() = Some(update);
            }
            Ok(true)
        }
        Ok(None) => {
            if notify_not_found {
                app.emit("update-not-found", ())?;
            }
            Ok(false)
        }
        Err(e) => {
            log::warn!("アップデートチェック失敗: {e}");
            if notify_not_found {
                app.emit("update-check-error", e.to_string())?;
            }
            Ok(false)
        }
    }
}
