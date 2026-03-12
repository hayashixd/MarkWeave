use std::collections::{BTreeSet, HashMap};
use rusqlite::params;
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

// ─── バックリンク取得 ─────────────────────────────────────────────────────────

/// バックリンクエントリ（wikilinks-backlinks-design.md §4, §5）
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkResult {
    /// リンク元ファイルの相対パス
    pub source_path: String,
    /// リンク元ファイル名（拡張子なし）
    pub source_name: String,
    /// リンク元ファイルのタイトル（frontmatter title）
    pub source_title: Option<String>,
    /// マッチした周辺テキスト（コンテキスト）
    pub contexts: Vec<String>,
}

/// 指定ファイルへのバックリンク（Wikiリンク）一覧を取得する。
///
/// SQLite の links テーブルを使い、ワークスペース全体からバックリンクを検索する。
/// BacklinksPanel がワークスペースモードで使用する。
#[tauri::command]
pub async fn get_backlinks(
    db: State<'_, MetadataDb>,
    file_path: String,
    workspace_root: String,
) -> Result<Vec<BacklinkResult>, String> {
    let conn = db.lock()?;

    // 対象ファイルの file_id を取得
    let target_file_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM files WHERE path = ?1",
            params![&file_path],
            |row| row.get(0),
        )
        .ok();

    // 対象ファイルのベース名（拡張子なし、小文字）でもマッチ
    let target_name = std::path::Path::new(&file_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // バックリンクを検索: target_file_id が一致 OR target_name がファイル名に一致
    let sql = if let Some(tid) = target_file_id {
        format!(
            "SELECT DISTINCT f.path, f.name, f.title, l.target_name \
             FROM links l \
             JOIN files f ON l.source_file_id = f.id \
             WHERE l.link_type = 'wiki' \
               AND (l.target_file_id = {} OR LOWER(l.target_name) = ?1) \
             ORDER BY f.path",
            tid
        )
    } else {
        "SELECT DISTINCT f.path, f.name, f.title, l.target_name \
         FROM links l \
         JOIN files f ON l.source_file_id = f.id \
         WHERE l.link_type = 'wiki' AND LOWER(l.target_name) = ?1 \
         ORDER BY f.path"
            .to_string()
    };

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("バックリンク検索準備エラー: {}", e))?;

    let rows: Vec<(String, String, Option<String>, String)> = stmt
        .query_map(params![target_name], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| format!("バックリンク検索エラー: {}", e))?
        .collect::<rusqlite::Result<_>>()
        .map_err(|e| format!("バックリンク読み取りエラー: {}", e))?;

    // 各ソースファイルからコンテキストを抽出
    let ws_root = std::path::Path::new(&workspace_root);
    let mut results: Vec<BacklinkResult> = Vec::new();

    for (source_path, source_name, source_title, _target_name) in &rows {
        let abs_path = ws_root.join(source_path);
        let contexts = match std::fs::read_to_string(&abs_path) {
            Ok(content) => extract_wikilink_contexts(&content, &target_name, 3),
            Err(_) => vec![],
        };

        results.push(BacklinkResult {
            source_path: source_path.clone(),
            source_name: source_name.clone(),
            source_title: source_title.clone(),
            contexts,
        });
    }

    Ok(results)
}

/// ファイル内容から Wikiリンクの周辺テキスト（コンテキスト）を抽出する
fn extract_wikilink_contexts(content: &str, target_name: &str, max_count: usize) -> Vec<String> {
    let pattern = format!(
        r"\[\[{}(?:\|[^\]]+)?\]\]",
        regex::escape(target_name)
    );
    let re = match regex::RegexBuilder::new(&pattern)
        .case_insensitive(true)
        .build()
    {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    let mut contexts = Vec::new();
    for m in re.find_iter(content) {
        if contexts.len() >= max_count {
            break;
        }
        let start = content[..m.start()]
            .char_indices()
            .rev()
            .nth(59)
            .map(|(i, _)| i)
            .unwrap_or(0);
        let end = content[m.end()..]
            .char_indices()
            .nth(59)
            .map(|(i, _)| m.end() + i + 1)
            .unwrap_or(content.len());

        let mut snippet = content[start..end].replace('\n', " ");
        snippet = snippet.trim().to_string();
        if start > 0 {
            snippet = format!("…{}", snippet);
        }
        if end < content.len() {
            snippet = format!("{}…", snippet);
        }
        contexts.push(snippet);
    }
    contexts
}

// ─── グラフビュー用型定義 ─────────────────────────────────────────────────────

/// グラフビュー用のノード（wikilinks-backlinks-design.md §11.2）
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub title: Option<String>,
    /// リンク数（被リンク含む合計）
    pub link_count: u32,
    pub tags: Vec<String>,
    /// 常に false（アクティブ判定はフロントエンド側で行う）
    pub is_active: bool,
}

/// グラフビュー用のエッジ（wikilinks-backlinks-design.md §11.2）
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub is_unresolved: bool,
}

/// `get_graph_data` の返却型（wikilinks-backlinks-design.md §11.2）
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub all_tags: Vec<String>,
}

/// ワークスペース全体の Wikiリンクグラフデータを SQLite から構築して返す。
///
/// - nodes: files テーブルの全行 + 未解決リンクのゴーストノード
/// - edges: links テーブルの wiki タイプのみ
/// - allTags: タグ一覧（フィルタ UI 用）
#[tauri::command]
pub async fn get_graph_data(db: State<'_, MetadataDb>) -> Result<GraphData, String> {
    let conn = db.lock()?;

    // 1. 全ファイルを取得
    let mut file_stmt = conn
        .prepare("SELECT id, path, name, title FROM files ORDER BY path")
        .map_err(|e| format!("SQL 準備エラー（files）: {}", e))?;

    let files: Vec<(i64, String, String, Option<String>)> = file_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| format!("クエリエラー（files）: {}", e))?
        .collect::<rusqlite::Result<_>>()
        .map_err(|e| format!("行読み取りエラー（files）: {}", e))?;

    // 2. ファイルIDをキーとするタグマップを構築
    let mut tags_map: HashMap<i64, Vec<String>> = HashMap::new();
    let mut all_tags_set: BTreeSet<String> = BTreeSet::new();
    {
        let mut tag_stmt = conn
            .prepare("SELECT file_id, tag FROM tags WHERE source = 'frontmatter'")
            .map_err(|e| format!("SQL 準備エラー（tags）: {}", e))?;

        let tag_rows: Vec<(i64, String)> = tag_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| format!("クエリエラー（tags）: {}", e))?
            .collect::<rusqlite::Result<_>>()
            .map_err(|e| format!("行読み取りエラー（tags）: {}", e))?;

        for (file_id, tag) in tag_rows {
            tags_map.entry(file_id).or_default().push(tag.clone());
            all_tags_set.insert(tag);
        }
    }

    // 3. file_id → path のマップ
    let file_id_to_path: HashMap<i64, String> =
        files.iter().map(|(id, path, _, _)| (*id, path.clone())).collect();

    // 4. Wikiリンクを取得してエッジ構築
    let mut link_stmt = conn
        .prepare(
            "SELECT source_file_id, target_name, target_file_id \
             FROM links WHERE link_type = 'wiki'",
        )
        .map_err(|e| format!("SQL 準備エラー（links）: {}", e))?;

    let link_rows: Vec<(i64, String, Option<i64>)> = link_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| format!("クエリエラー（links）: {}", e))?
        .collect::<rusqlite::Result<_>>()
        .map_err(|e| format!("行読み取りエラー（links）: {}", e))?;

    // リンク数カウント（被リンク含む）
    let mut link_count_map: HashMap<i64, u32> = HashMap::new();
    // 未解決リンクのゴーストノード（target_name → ghost_id）
    let mut unresolved_ghosts: HashMap<String, ()> = HashMap::new();

    let mut edges: Vec<GraphEdge> = Vec::new();

    for (source_file_id, target_name, target_file_id) in &link_rows {
        let Some(source_path) = file_id_to_path.get(source_file_id) else {
            continue;
        };

        let (target_id, is_unresolved) = match target_file_id {
            Some(tid) => {
                if let Some(path) = file_id_to_path.get(tid) {
                    (path.clone(), false)
                } else {
                    (format!("__unresolved__{}", target_name), true)
                }
            }
            None => (format!("__unresolved__{}", target_name), true),
        };

        if is_unresolved {
            unresolved_ghosts.entry(target_id.clone()).or_insert(());
        }

        // 送受信両側の linkCount を加算
        *link_count_map.entry(*source_file_id).or_default() += 1;
        if let Some(tid) = target_file_id {
            *link_count_map.entry(*tid).or_default() += 1;
        }

        edges.push(GraphEdge {
            source: source_path.clone(),
            target: target_id,
            is_unresolved,
        });
    }

    // 5. ノード構築（実ファイル）
    let mut nodes: Vec<GraphNode> = files
        .iter()
        .map(|(id, path, name, title)| GraphNode {
            id: path.clone(),
            name: name.clone(),
            title: title.clone(),
            link_count: *link_count_map.get(id).unwrap_or(&0),
            tags: tags_map.get(id).cloned().unwrap_or_default(),
            is_active: false,
        })
        .collect();

    // 6. 未解決ゴーストノードを追加
    for ghost_id in unresolved_ghosts.keys() {
        let name = ghost_id.strip_prefix("__unresolved__").unwrap_or(ghost_id);
        nodes.push(GraphNode {
            id: ghost_id.clone(),
            name: name.to_string(),
            title: None,
            link_count: 0,
            tags: vec![],
            is_active: false,
        });
    }

    Ok(GraphData {
        nodes,
        edges,
        all_tags: all_tags_set.into_iter().collect(),
    })
}
