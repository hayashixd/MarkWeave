use std::path::Path;
use tauri::{AppHandle, Manager, State};

use crate::db::connection::MetadataDb;
use crate::db::queries::{self, MetadataQueryResult};
use crate::fs::indexer::{self, IndexResult};

/// ワークスペースのメタデータインデックスを初期化する（DB 接続確立 + マイグレーション）
#[tauri::command]
pub async fn init_metadata_db(
    app: AppHandle,
    workspace_root: String,
) -> Result<(), String> {
    let db = MetadataDb::open(Path::new(&workspace_root))?;
    app.manage(db);
    Ok(())
}

/// ワークスペース全体をスキャンしてメタデータインデックスを構築する
#[tauri::command]
pub async fn index_workspace_metadata(
    db: State<'_, MetadataDb>,
    root_path: String,
) -> Result<IndexResult, String> {
    let conn = db.lock()?;
    indexer::full_scan(&conn, Path::new(&root_path))
}

/// 単一ファイルのメタデータインデックスを更新する（ファイル保存時）
#[tauri::command]
pub async fn update_metadata_for_file(
    db: State<'_, MetadataDb>,
    file_path: String,
    workspace_root: String,
) -> Result<(), String> {
    let conn = db.lock()?;
    indexer::update_file(&conn, Path::new(&file_path), Path::new(&workspace_root))
}

/// パース済み SQL を実行してクエリ結果を返す
#[tauri::command]
pub async fn execute_metadata_query(
    db: State<'_, MetadataDb>,
    sql: String,
) -> Result<MetadataQueryResult, String> {
    let conn = db.lock()?;
    queries::execute_query(&conn, &sql)
}
