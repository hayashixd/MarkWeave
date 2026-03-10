use tauri::{AppHandle, State};

use crate::db::connection::MetadataDb;
use crate::db::queries::{self, MetadataQueryResult};

/// ワークスペースのメタデータインデックスを初期化する（DB 接続確立 + マイグレーション）
#[tauri::command]
pub async fn init_metadata_db(
    app: AppHandle,
    workspace_root: String,
) -> Result<(), String> {
    let db = MetadataDb::open(std::path::Path::new(&workspace_root))?;
    app.manage(db);
    Ok(())
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
