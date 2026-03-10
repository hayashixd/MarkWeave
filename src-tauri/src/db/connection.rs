use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use super::migrations::run_migrations;

/// Tauri の State として管理される SQLite 接続ラッパー
pub struct MetadataDb {
    conn: Mutex<Connection>,
    db_path: PathBuf,
}

impl MetadataDb {
    /// ワークスペースルートから .md-editor/metadata.db のパスを算出して接続を開く
    pub fn open(workspace_root: &Path) -> Result<Self, String> {
        let db_dir = workspace_root.join(".md-editor");
        std::fs::create_dir_all(&db_dir).map_err(|e| {
            format!(".md-editor ディレクトリの作成に失敗: {}", e)
        })?;

        let db_path = db_dir.join("metadata.db");
        let mut conn = Connection::open(&db_path).map_err(|e| {
            format!("SQLite 接続の確立に失敗: {}", e)
        })?;

        run_migrations(&mut conn).map_err(|e| {
            format!("DB マイグレーションに失敗: {}", e)
        })?;

        Ok(Self {
            conn: Mutex::new(conn),
            db_path,
        })
    }

    /// 接続の Mutex ロックを取得する
    pub fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.conn.lock().map_err(|e| format!("DB ロック取得に失敗: {}", e))
    }

    /// DB ファイルのパスを返す
    pub fn path(&self) -> &Path {
        &self.db_path
    }
}

/// AppHandle から MetadataDb State を取得するヘルパー
pub fn get_metadata_db(app: &AppHandle) -> Result<tauri::State<'_, MetadataDb>, String> {
    app.try_state::<MetadataDb>()
        .ok_or_else(|| "MetadataDb が初期化されていません".to_string())
}
