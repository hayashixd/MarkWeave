use crate::models::error::AppError;
use std::path::Path;
use std::time::Duration;

/// ファイルを読み込む Tauri コマンド。
///
/// フロントエンドから `invoke('read_file', { path })` で呼び出す。
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    log::info!("read_file: {}", path);

    let file_path = Path::new(&path);

    // パスのバリデーション
    if !file_path.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.clone(),
        }
        .into());
    }

    // ファイルの存在確認
    if !file_path.exists() {
        return Err(AppError::FileNotFound {
            path: path.clone(),
        }
        .into());
    }

    // ファイル読み込み
    match tokio::fs::read_to_string(&path).await {
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

    // パスのバリデーション
    if !file_path.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.clone(),
        }
        .into());
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
