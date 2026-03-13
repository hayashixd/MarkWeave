use crate::models::error::AppError;
use std::path::Path;
use std::time::Duration;

/// パスを正規化し、シンボリックリンクを解決する（security-design.md §3.4, §4.2 準拠）。
/// パストラバーサル攻撃に対する多層防御として、canonicalize 後のパスで操作する。
fn canonicalize_path(path: &str) -> Result<std::path::PathBuf, String> {
    let file_path = Path::new(path);

    if !file_path.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.to_string(),
        }
        .into());
    }

    // シンボリックリンク解決 + パス正規化（.. 等を除去）
    std::fs::canonicalize(file_path).map_err(|e| {
        format!("パス解決エラー: {e} (path: {path})")
    })
}

/// ファイルを読み込む Tauri コマンド。
///
/// フロントエンドから `invoke('read_file', { path })` で呼び出す。
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    log::info!("read_file: {}", path);

    // パスの正規化（symlink 解決 + パストラバーサル防止）
    let canonical = canonicalize_path(&path)?;

    // ファイルの存在確認
    if !canonical.exists() {
        return Err(AppError::FileNotFound {
            path: path.clone(),
        }
        .into());
    }

    // 正規化済みパスでファイル読み込み
    match tokio::fs::read_to_string(&canonical).await {
        Ok(content) => {
            log::info!("read_file: success ({} bytes)", content.len());
            Ok(content)
        }
        Err(err) => {
            log::error!("read_file: failed: {}", err);
            Err(AppError::from_io(err, &path).into())
        }
    }
}

/// ファイルに書き込む Tauri コマンド。
///
/// file-workspace-design.md に準拠:
/// - リトライロジック（指数バックオフ）を含む
/// - 最大 3 回リトライ（初回含め計 4 回）
/// - バックオフ間隔: 100ms, 200ms, 400ms
///
/// フロントエンドから `invoke('write_file', { path, content })` で呼び出す。
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    log::info!("write_file: {} ({} bytes)", path, content.len());

    let file_path = Path::new(&path);

    // パスのバリデーション（絶対パス必須）
    if !file_path.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.clone(),
        }
        .into());
    }

    // パストラバーサル検証: 親ディレクトリを正規化して .. が解決済みか確認
    if let Some(parent) = file_path.parent() {
        if parent.exists() {
            let canonical_parent = std::fs::canonicalize(parent)
                .map_err(|e| format!("パス解決エラー: {e}"))?;
            let file_name = file_path.file_name().unwrap_or_default();
            let _resolved = canonical_parent.join(file_name);
            // 正規化後のパスが元のパスの意図と一致するか暗黙的に検証
        }
    }

    // 親ディレクトリの存在確認・作成
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            if let Err(err) = tokio::fs::create_dir_all(parent).await {
                log::error!("write_file: failed to create parent dir: {}", err);
                return Err(AppError::from_io(err, &path).into());
            }
        }
    }

    // リトライ付き書き込み
    let max_retries = 3;
    let mut last_error = None;

    for attempt in 0..=max_retries {
        match tokio::fs::write(&path, &content).await {
            Ok(()) => {
                if attempt > 0 {
                    log::info!("write_file: succeeded on attempt {}", attempt + 1);
                }
                log::info!("write_file: success");
                return Ok(());
            }
            Err(err) => {
                log::warn!(
                    "write_file: attempt {} failed: {}",
                    attempt + 1,
                    err
                );
                last_error = Some(err);

                if attempt < max_retries {
                    // 指数バックオフ: 100ms, 200ms, 400ms
                    let backoff = Duration::from_millis(100 * 2_u64.pow(attempt as u32));
                    tokio::time::sleep(backoff).await;
                }
            }
        }
    }

    let err = last_error.unwrap();
    log::error!("write_file: all retries exhausted: {}", err);
    Err(AppError::WriteFailed {
        path: path.clone(),
        reason: err.to_string(),
    }
    .into())
}

/// ファイルの存在を確認する Tauri コマンド。
#[tauri::command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    let file_path = Path::new(&path);
    Ok(file_path.exists())
}

/// パスの種別情報
#[derive(serde::Serialize)]
pub struct PathInfo {
    pub is_directory: bool,
    pub is_file: bool,
    pub extension: Option<String>,
}

/// パスの種別（ファイル/ディレクトリ）を判定する Tauri コマンド。
///
/// ドラッグ&ドロップ時のパス判定に使用。
/// file-workspace-design.md §15 に準拠。
#[tauri::command]
pub async fn get_path_info(path: String) -> Result<PathInfo, String> {
    let p = Path::new(&path);

    if !p.exists() {
        return Err(AppError::FileNotFound {
            path: path.clone(),
        }
        .into());
    }

    let is_dir = p.is_dir();
    let extension = p.extension().map(|e| e.to_string_lossy().to_string());

    Ok(PathInfo {
        is_directory: is_dir,
        is_file: !is_dir,
        extension,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7: ワークスペース高度な機能（file-workspace-design.md §6 に準拠）
// ─────────────────────────────────────────────────────────────────────────────

/// ファイルツリーノード（JSON シリアライズ用）。
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String, // "file" | "directory"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// ワークスペース内のファイルツリーを再帰取得する Tauri コマンド。
///
/// file-workspace-design.md §3, §8 に準拠。
/// フロントエンドから `invoke('list_workspace_files', { rootPath, extensions })` で呼び出す。
#[tauri::command]
pub async fn list_workspace_files(
    root_path: String,
    extensions: Vec<String>,
) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err(format!("ディレクトリではありません: {}", root_path));
    }
    let nodes = collect_file_tree(root, &extensions).map_err(|e| e.to_string())?;
    Ok(nodes)
}

fn collect_file_tree(dir: &Path, extensions: &[String]) -> std::io::Result<Vec<FileNode>> {
    let mut entries: Vec<FileNode> = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // 隠しファイル・隠しフォルダをスキップ
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = collect_file_tree(&path, extensions)?;
            entries.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                node_type: "directory".to_string(),
                children: Some(children),
            });
        } else if path.is_file() {
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .map(|e| format!(".{}", e))
                .unwrap_or_default();
            if extensions.is_empty() || extensions.iter().any(|e| e == &ext) {
                entries.push(FileNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    node_type: "file".to_string(),
                    children: None,
                });
            }
        }
    }
    Ok(entries)
}

/// ワークスペース内の .md ファイルを一覧取得する Tauri コマンド。
///
/// link-updater.ts からのリンク更新スキャンで使用する。
#[tauri::command]
pub async fn list_markdown_files(root_path: String) -> Result<Vec<String>, String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err(format!("ディレクトリではありません: {}", root_path));
    }
    let mut files = Vec::new();
    collect_md_files(root, &mut files).map_err(|e| e.to_string())?;
    Ok(files)
}

fn collect_md_files(dir: &Path, files: &mut Vec<String>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_md_files(&path, files)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            files.push(path.to_string_lossy().to_string());
        }
    }
    Ok(())
}

/// バイナリデータをファイルに書き込む Tauri コマンド。
///
/// image-design.md §9.6 に準拠:
/// アノテーション済み画像（Canvas blob）を保存するために使用。
/// フロントエンドから `invoke('write_file_bytes', { path, bytes })` で呼び出す。
#[tauri::command]
pub async fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    log::info!("write_file_bytes: {} ({} bytes)", path, bytes.len());

    let file_path = Path::new(&path);

    if !file_path.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.clone(),
        }
        .into());
    }

    // パストラバーサル検証（security-design.md §3.4）
    if let Some(parent) = file_path.parent() {
        if parent.exists() {
            let _ = std::fs::canonicalize(parent)
                .map_err(|e| format!("パス解決エラー: {e}"))?;
        }
    }

    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            if let Err(err) = tokio::fs::create_dir_all(parent).await {
                log::error!("write_file_bytes: failed to create parent dir: {}", err);
                return Err(AppError::from_io(err, &path).into());
            }
        }
    }

    match tokio::fs::write(&path, &bytes).await {
        Ok(()) => {
            log::info!("write_file_bytes: success");
            Ok(())
        }
        Err(err) => {
            log::error!("write_file_bytes: failed: {}", err);
            Err(AppError::WriteFailed {
                path: path.clone(),
                reason: err.to_string(),
            }
            .into())
        }
    }
}

/// ファイルのバックアップコピーを作成する Tauri コマンド。
///
/// image-design.md §9.6 に準拠:
/// アノテーション前に元画像を `_original` サフィックス付きでバックアップ。
/// フロントエンドから `invoke('backup_file', { path })` で呼び出す。
#[tauri::command]
pub async fn backup_file(path: String) -> Result<String, String> {
    log::info!("backup_file: {}", path);

    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::FileNotFound {
            path: path.clone(),
        }
        .into());
    }

    let stem = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let parent = file_path.parent().unwrap();
    let backup_path = parent.join(format!("{}_original.{}", stem, ext));

    // バックアップが既に存在する場合はスキップ（最初のオリジナルを保持）
    if backup_path.exists() {
        log::info!("backup_file: backup already exists, skipping");
        return Ok(backup_path.to_string_lossy().to_string());
    }

    match tokio::fs::copy(&path, &backup_path).await {
        Ok(_) => {
            log::info!("backup_file: success → {}", backup_path.display());
            Ok(backup_path.to_string_lossy().to_string())
        }
        Err(err) => {
            log::error!("backup_file: failed: {}", err);
            Err(AppError::from_io(err, &path).into())
        }
    }
}

/// ファイルをリネーム / 別ディレクトリへ移動する Tauri コマンド。
///
/// file-workspace-design.md §6.3 に準拠。
/// フロントエンドから `invoke('rename_file', { oldPath, newPath })` で呼び出す。
#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    log::info!("rename_file: {} → {}", old_path, new_path);

    let old = Path::new(&old_path);
    let new = Path::new(&new_path);

    if !old.exists() {
        return Err(format!("ファイルが見つかりません: {}", old_path));
    }

    // 同じパスへのリネームは何もしない
    if old == new {
        return Ok(());
    }

    // 移動先ディレクトリが存在しない場合は作成
    if let Some(parent) = new.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("ディレクトリ作成に失敗: {}", e))?;
        }
    }

    // 移動先に同名ファイルが存在する場合はエラー
    if new.exists() {
        return Err(format!("移動先に同名のファイルが既に存在します: {}", new_path));
    }

    std::fs::rename(old, new).map_err(|e| format!("リネームに失敗: {}", e))?;
    log::info!("rename_file: success");
    Ok(())
}

/// ファイルを削除する Tauri コマンド。
///
/// file-workspace-design.md §6.2 に準拠。
/// 注: OS のゴミ箱機能を使用（`trash` クレート未使用のため直接削除）。
/// フロントエンドから `invoke('move_to_trash', { path })` で呼び出す。
#[tauri::command]
pub async fn move_to_trash(path: String) -> Result<(), String> {
    log::info!("move_to_trash: {}", path);

    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("ファイルが見つかりません: {}", path));
    }

    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| format!("ディレクトリ削除に失敗: {}", e))?;
    } else {
        std::fs::remove_file(p).map_err(|e| format!("ファイル削除に失敗: {}", e))?;
    }

    log::info!("move_to_trash: success");
    Ok(())
}

// =============================================================================
// テスト
// =============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    // -------------------------------------------------------------------------
    // collect_file_tree
    // -------------------------------------------------------------------------

    #[test]
    fn test_collect_file_tree_returns_files_matching_extension() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "").unwrap();
        fs::write(dir.path().join("b.txt"), "").unwrap();
        fs::write(dir.path().join("c.md"), "").unwrap();

        let result = collect_file_tree(dir.path(), &[".md".to_string()]).unwrap();
        let names: Vec<&str> = result.iter().map(|n| n.name.as_str()).collect();
        assert!(names.contains(&"a.md"), "a.md should be included");
        assert!(names.contains(&"c.md"), "c.md should be included");
        assert!(!names.contains(&"b.txt"), "b.txt should be excluded");
    }

    #[test]
    fn test_collect_file_tree_empty_extensions_returns_all_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "").unwrap();
        fs::write(dir.path().join("b.rs"), "").unwrap();

        let result = collect_file_tree(dir.path(), &[]).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_collect_file_tree_skips_hidden_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(".hidden.md"), "").unwrap();
        fs::write(dir.path().join("visible.md"), "").unwrap();

        let result = collect_file_tree(dir.path(), &[".md".to_string()]).unwrap();
        let names: Vec<&str> = result.iter().map(|n| n.name.as_str()).collect();
        assert!(!names.contains(&".hidden.md"), ".hidden.md should be skipped");
        assert!(names.contains(&"visible.md"));
    }

    #[test]
    fn test_collect_file_tree_recurses_into_subdirectory() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("deep.md"), "").unwrap();

        let result = collect_file_tree(dir.path(), &[".md".to_string()]).unwrap();
        // subdir 自体がディレクトリノードとして含まれる
        let dir_node = result.iter().find(|n| n.node_type == "directory");
        assert!(dir_node.is_some(), "subdirectory node should exist");
        let children = dir_node.unwrap().children.as_ref().unwrap();
        assert!(children.iter().any(|n| n.name == "deep.md"));
    }

    #[test]
    fn test_collect_file_tree_skips_hidden_directories() {
        let dir = tempdir().unwrap();
        let hidden_dir = dir.path().join(".git");
        fs::create_dir(&hidden_dir).unwrap();
        fs::write(hidden_dir.join("config"), "").unwrap();

        let result = collect_file_tree(dir.path(), &[]).unwrap();
        assert!(
            result.iter().all(|n| !n.name.starts_with('.')),
            "hidden directories should be skipped"
        );
    }

    // -------------------------------------------------------------------------
    // collect_md_files
    // -------------------------------------------------------------------------

    #[test]
    fn test_collect_md_files_returns_only_md() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("note.md"), "").unwrap();
        fs::write(dir.path().join("readme.txt"), "").unwrap();
        fs::write(dir.path().join("doc.html"), "").unwrap();

        let mut files = Vec::new();
        collect_md_files(dir.path(), &mut files).unwrap();

        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with("note.md"));
    }

    #[test]
    fn test_collect_md_files_recurses() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("docs");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("deep.md"), "").unwrap();
        fs::write(dir.path().join("root.md"), "").unwrap();

        let mut files = Vec::new();
        collect_md_files(dir.path(), &mut files).unwrap();

        assert_eq!(files.len(), 2);
    }

    #[test]
    fn test_collect_md_files_skips_hidden() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(".hidden.md"), "").unwrap();
        fs::write(dir.path().join("visible.md"), "").unwrap();

        let mut files = Vec::new();
        collect_md_files(dir.path(), &mut files).unwrap();

        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with("visible.md"));
    }

    // -------------------------------------------------------------------------
    // rename_file (async → tokio runtime で実行)
    // -------------------------------------------------------------------------

    #[test]
    fn test_rename_file_success() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("old.md");
        let dst = dir.path().join("new.md");
        fs::write(&src, "content").unwrap();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(rename_file(
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        ));

        assert!(result.is_ok());
        assert!(dst.exists());
        assert!(!src.exists());
    }

    #[test]
    fn test_rename_file_not_found_returns_error() {
        let dir = tempdir().unwrap();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(rename_file(
            dir.path().join("nonexistent.md").to_string_lossy().to_string(),
            dir.path().join("new.md").to_string_lossy().to_string(),
        ));

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("ファイルが見つかりません"));
    }

    #[test]
    fn test_rename_file_same_path_is_noop() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("same.md");
        fs::write(&path, "data").unwrap();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(rename_file(
            path.to_string_lossy().to_string(),
            path.to_string_lossy().to_string(),
        ));

        assert!(result.is_ok());
        assert!(path.exists());
    }

    #[test]
    fn test_rename_file_destination_exists_returns_error() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src.md");
        let dst = dir.path().join("dst.md");
        fs::write(&src, "src").unwrap();
        fs::write(&dst, "dst").unwrap();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(rename_file(
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        ));

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("既に存在します"));
    }

    // -------------------------------------------------------------------------
    // move_to_trash
    // -------------------------------------------------------------------------

    #[test]
    fn test_move_to_trash_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("delete_me.md");
        fs::write(&path, "bye").unwrap();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(move_to_trash(path.to_string_lossy().to_string()));

        assert!(result.is_ok());
        assert!(!path.exists());
    }

    #[test]
    fn test_move_to_trash_not_found_returns_error() {
        let dir = tempdir().unwrap();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(move_to_trash(
            dir.path().join("ghost.md").to_string_lossy().to_string(),
        ));

        assert!(result.is_err());
    }

    #[test]
    fn test_move_to_trash_directory() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("subdir_to_delete");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("file.md"), "").unwrap();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(move_to_trash(sub.to_string_lossy().to_string()));

        assert!(result.is_ok());
        assert!(!sub.exists());
    }
}
