use serde::{Deserialize, Serialize};

/// ファイルメタデータの構造体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub is_dirty: bool,
}
