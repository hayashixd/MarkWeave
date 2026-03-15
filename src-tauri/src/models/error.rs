use serde::Serialize;

/// アプリケーション全体のエラー型。
/// フロントエンドに返す際は serde でシリアライズされる。
///
/// error-handling-design.md に準拠:
/// - Rust 側の生のエラーは返さず、ユーザー向けのエラーメッセージに変換する
/// - フロントエンドの translateError() でさらに日本語メッセージに変換される
#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", content = "detail")]
pub enum AppError {
    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },

    #[error("Disk is full")]
    DiskFull,

    #[error("File is locked: {path}")]
    FileLocked { path: String },

    #[error("Invalid path: {path}")]
    InvalidPath { path: String },

    #[error("Write failed after retries: {path}, reason: {reason}")]
    WriteFailed { path: String, reason: String },

    #[error("Unknown error: {message}")]
    Unknown { message: String },

    #[error("License key is invalid")]
    LicenseInvalid,

    #[error("License not found")]
    LicenseNotFound,
}

impl AppError {
    /// std::io::Error を AppError に変換する
    pub fn from_io(err: std::io::Error, path: &str) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::FileNotFound {
                path: path.to_string(),
            },
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied {
                path: path.to_string(),
            },
            kind if format!("{:?}", kind).contains("StorageFull") => AppError::DiskFull,
            _ => {
                // WouldBlock はファイルロックの可能性
                if err.kind() == std::io::ErrorKind::WouldBlock {
                    AppError::FileLocked {
                        path: path.to_string(),
                    }
                } else {
                    AppError::Unknown {
                        message: err.to_string(),
                    }
                }
            }
        }
    }
}

/// Tauri コマンドの戻り値で使うため、
/// AppError を String にシリアライズする。
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        serde_json::to_string(&err).unwrap_or_else(|_| err.to_string())
    }
}
