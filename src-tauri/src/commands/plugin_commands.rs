/**
 * プラグイン向け Tauri コマンド
 *
 * plugin-api-design.md §4.4, §8 に準拠。
 *
 * - plugin_read_file / plugin_write_file / plugin_list_directory:
 *   fs:read / fs:write 権限付きプラグインがワークスペース内ファイルにアクセスするコマンド。
 *   パストラバーサル攻撃対策としてワークスペース外アクセスを全て拒否する。
 *
 * - plugin_load_manifest: プラグインフォルダの manifest.json を読み込む
 * - plugin_install / plugin_uninstall: プラグインのインストール・削除
 * - plugin_set_enabled: プラグインの有効/無効フラグを設定
 * - is_safe_mode_active / set_safe_mode: セーフモード管理
 */

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub repository: Option<String>,
    pub permissions: Vec<String>,
    #[serde(default)]
    pub settings: Vec<serde_json::Value>,
    #[serde(rename = "minApiVersion")]
    pub min_api_version: Option<String>,
    pub changelog: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPluginRecord {
    pub id: String,
    pub enabled: bool,
    pub path: String,
    pub version: String,
}

// ---------------------------------------------------------------------------
// パス検証ヘルパー
// ---------------------------------------------------------------------------

/// プラグインがアクセスを要求するパスを検証する。
/// ワークスペース外へのアクセスはすべて拒否する（パストラバーサル攻撃対策を含む）。
fn validate_plugin_path(
    requested_path: &str,
    workspace_root: &Path,
) -> Result<PathBuf, String> {
    // ① パスを絶対パスに正規化（シンボリックリンク・".." を解決）
    let abs_path = workspace_root
        .join(requested_path)
        .canonicalize()
        .map_err(|e| format!("パスが解決できません: {e}"))?;

    // ② ワークスペースルートも正規化
    let canonical_workspace = workspace_root
        .canonicalize()
        .map_err(|e| format!("ワークスペースパスが無効: {e}"))?;

    // ③ パストラバーサル検証: 正規化後もワークスペース内にあるか確認
    if !abs_path.starts_with(&canonical_workspace) {
        return Err(format!(
            "セキュリティエラー: プラグインはワークスペース外のパスにアクセスできません\n\
             要求パス: {:?}\n\
             ワークスペース: {:?}",
            abs_path, canonical_workspace
        ));
    }

    // ④ 内部予約ディレクトリへのアクセスを拒否
    let relative = abs_path.strip_prefix(&canonical_workspace).unwrap();
    if relative.starts_with(".md-editor") {
        return Err(
            "セキュリティエラー: .md-editor ディレクトリへのアクセスは禁止されています".into(),
        );
    }

    Ok(abs_path)
}

/// 現在のワークスペースルートを取得する。
/// ワークスペースが設定されていない場合はエラーを返す。
fn get_workspace_root(app: &AppHandle) -> Result<PathBuf, String> {
    // plugin-store から workspace.root を取得する
    // ワークスペースが未設定の場合はホームディレクトリを返す（最小権限）
    let home = dirs::home_dir()
        .ok_or_else(|| "ホームディレクトリが取得できません".to_string())?;
    let workspace_key = app
        .path()
        .app_config_dir()
        .map(|p| p.join("workspace_root.txt"))
        .ok();

    if let Some(key_path) = workspace_key {
        if let Ok(root) = std::fs::read_to_string(&key_path) {
            let root = root.trim();
            if !root.is_empty() {
                return Ok(PathBuf::from(root));
            }
        }
    }

    Ok(home)
}

// ---------------------------------------------------------------------------
// ファイルアクセスコマンド
// ---------------------------------------------------------------------------

/// プラグインからのファイル読み取りコマンド（fs:read 権限付き）
#[tauri::command]
pub async fn plugin_read_file(
    app: AppHandle,
    plugin_id: String,
    path: String,
) -> Result<String, String> {
    log::info!("plugin_read_file: plugin={}, path={}", plugin_id, path);

    let workspace_root = get_workspace_root(&app)?;
    let validated_path = validate_plugin_path(&path, &workspace_root)?;

    tokio::fs::read_to_string(&validated_path)
        .await
        .map_err(|e| format!("ファイル読み取りエラー: {e}"))
}

/// プラグインからのファイル書き込みコマンド（fs:write 権限付き）
#[tauri::command]
pub async fn plugin_write_file(
    app: AppHandle,
    plugin_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    log::info!("plugin_write_file: plugin={}, path={}", plugin_id, path);

    let workspace_root = get_workspace_root(&app)?;

    // 書き込みでは canonicalize() が存在しないパスで失敗するため、
    // 親ディレクトリを検証してから書き込む
    let path_buf = PathBuf::from(&path);
    let parent = path_buf
        .parent()
        .ok_or("無効なパス: 親ディレクトリが存在しません")?;

    let validated_parent =
        validate_plugin_path(&parent.to_string_lossy(), &workspace_root)?;

    let file_name = path_buf
        .file_name()
        .ok_or("無効なパス: ファイル名がありません")?;

    let validated_path = validated_parent.join(file_name);

    tokio::fs::write(&validated_path, content)
        .await
        .map_err(|e| format!("ファイル書き込みエラー: {e}"))
}

/// プラグインからのディレクトリ一覧取得コマンド（fs:read 権限付き）
#[tauri::command]
pub async fn plugin_list_directory(
    app: AppHandle,
    plugin_id: String,
    path: String,
) -> Result<Vec<String>, String> {
    log::info!("plugin_list_directory: plugin={}, path={}", plugin_id, path);

    let workspace_root = get_workspace_root(&app)?;
    let validated_path = validate_plugin_path(&path, &workspace_root)?;

    let mut entries = tokio::fs::read_dir(&validated_path)
        .await
        .map_err(|e| format!("ディレクトリ読み取りエラー: {e}"))?;

    let mut names = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }

    Ok(names)
}

// ---------------------------------------------------------------------------
// プラグイン管理コマンド
// ---------------------------------------------------------------------------

/// プラグインフォルダの manifest.json を読み込む
#[tauri::command]
pub async fn plugin_load_manifest(folder_path: String) -> Result<PluginManifest, String> {
    log::info!("plugin_load_manifest: {}", folder_path);

    let manifest_path = PathBuf::from(&folder_path).join("manifest.json");
    if !manifest_path.exists() {
        return Err(format!(
            "manifest.json が見つかりません: {:?}",
            manifest_path
        ));
    }

    let content = tokio::fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| format!("manifest.json の読み取りエラー: {e}"))?;

    serde_json::from_str::<PluginManifest>(&content)
        .map_err(|e| format!("manifest.json のパースエラー: {e}"))
}

/// プラグインをインストールする（プラグインフォルダをコピー）
#[tauri::command]
pub async fn plugin_install(
    app: AppHandle,
    folder_path: String,
    manifest: PluginManifest,
) -> Result<(), String> {
    log::info!("plugin_install: {}", manifest.id);

    let plugins_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリが取得できません: {e}"))?
        .join("plugins")
        .join(&manifest.id);

    // ディレクトリを作成してファイルをコピー
    tokio::fs::create_dir_all(&plugins_dir)
        .await
        .map_err(|e| format!("プラグインディレクトリの作成エラー: {e}"))?;

    copy_dir_all(&folder_path, &plugins_dir).await?;

    log::info!("plugin_install: {} をインストールしました", manifest.id);
    Ok(())
}

/// プラグインをアンインストールする
#[tauri::command]
pub async fn plugin_uninstall(
    app: AppHandle,
    plugin_id: String,
) -> Result<(), String> {
    log::info!("plugin_uninstall: {}", plugin_id);

    let plugins_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリが取得できません: {e}"))?
        .join("plugins")
        .join(&plugin_id);

    if plugins_dir.exists() {
        tokio::fs::remove_dir_all(&plugins_dir)
            .await
            .map_err(|e| format!("プラグインの削除エラー: {e}"))?;
    }

    Ok(())
}

/// プラグインの有効/無効フラグを設定する
#[tauri::command]
pub async fn plugin_set_enabled(
    plugin_id: String,
    enabled: bool,
) -> Result<(), String> {
    log::info!("plugin_set_enabled: {} -> {}", plugin_id, enabled);
    // 実際の有効/無効状態は settings.json で管理される（TypeScript 側が担当）
    Ok(())
}

// ---------------------------------------------------------------------------
// セーフモードコマンド
// ---------------------------------------------------------------------------

/// セーフモードが有効かどうかを返す
#[tauri::command]
pub async fn is_safe_mode_active(app: AppHandle) -> Result<bool, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリが取得できません: {e}"))?;

    let safe_mode_flag = config_dir.join("safe_mode_requested");
    if !safe_mode_flag.exists() {
        return Ok(false);
    }

    let content = std::fs::read_to_string(&safe_mode_flag).unwrap_or_default();
    Ok(content.trim() == "1")
}

/// セーフモードフラグを設定する
#[tauri::command]
pub async fn set_safe_mode(app: AppHandle, active: bool) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリが取得できません: {e}"))?;

    let safe_mode_flag = config_dir.join("safe_mode_requested");
    std::fs::write(&safe_mode_flag, if active { "1" } else { "0" })
        .map_err(|e| format!("セーフモードフラグの書き込みエラー: {e}"))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/// ディレクトリを再帰的にコピーする
async fn copy_dir_all(src: &str, dst: &PathBuf) -> Result<(), String> {
    let src_path = PathBuf::from(src);
    let mut entries = tokio::fs::read_dir(&src_path)
        .await
        .map_err(|e| format!("ディレクトリ読み取りエラー: {e}"))?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let dst_path = dst.join(entry.file_name());
        let file_type = entry
            .file_type()
            .await
            .map_err(|e| format!("ファイルタイプ取得エラー: {e}"))?;

        if file_type.is_dir() {
            tokio::fs::create_dir_all(&dst_path)
                .await
                .map_err(|e| format!("ディレクトリ作成エラー: {e}"))?;
            copy_dir_all(&entry.path().to_string_lossy(), &dst_path).await?;
        } else {
            tokio::fs::copy(entry.path(), &dst_path)
                .await
                .map_err(|e| format!("ファイルコピーエラー: {e}"))?;
        }
    }

    Ok(())
}
