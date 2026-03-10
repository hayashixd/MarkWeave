use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};

use super::markdown_parser::{parse_markdown, ParsedMarkdown};

/// インデックス構築結果
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexResult {
    pub indexed_files: usize,
    pub skipped_files: usize,
    pub duration_ms: u64,
}

/// ワークスペース全体をスキャンして .md ファイルをインデックスに登録する
pub fn full_scan(conn: &Connection, workspace_root: &Path) -> Result<IndexResult, String> {
    let start = std::time::Instant::now();

    let mut md_files = Vec::new();
    collect_md_files_recursive(workspace_root, &mut md_files)
        .map_err(|e| format!("ファイル収集エラー: {}", e))?;

    let mut indexed = 0;
    let mut skipped = 0;

    for file_path in &md_files {
        match index_single_file(conn, file_path, workspace_root) {
            Ok(()) => indexed += 1,
            Err(e) => {
                log::warn!("インデックス失敗 {:?}: {}", file_path, e);
                skipped += 1;
            }
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    log::info!(
        "全スキャン完了: {} ファイルインデックス済み, {} スキップ, {}ms",
        indexed,
        skipped,
        duration_ms
    );

    Ok(IndexResult {
        indexed_files: indexed,
        skipped_files: skipped,
        duration_ms,
    })
}

/// 単一ファイルのインデックスを更新する（ファイル保存時に呼ばれる）
pub fn update_file(conn: &Connection, file_path: &Path, workspace_root: &Path) -> Result<(), String> {
    // 既存のレコードがあれば削除（CASCADE で関連テーブルも削除される）
    let rel_path = make_relative(file_path, workspace_root);
    conn.execute("DELETE FROM files WHERE path = ?1", params![rel_path])
        .map_err(|e| format!("既存レコード削除エラー: {}", e))?;

    index_single_file(conn, file_path, workspace_root)
}

/// 単一の Markdown ファイルをパースしてインデックスに登録する
fn index_single_file(
    conn: &Connection,
    file_path: &Path,
    workspace_root: &Path,
) -> Result<(), String> {
    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("ファイル読み取りエラー: {}", e))?;

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("メタデータ取得エラー: {}", e))?;

    let parsed = parse_markdown(&content, file_path);
    let rel_path = make_relative(file_path, workspace_root);
    let name = file_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let size_bytes = metadata.len() as i64;
    let modified_at = system_time_to_iso(metadata.modified().ok());
    let created_at = system_time_to_iso(metadata.created().ok());
    let now = chrono_now_iso();

    // files テーブルに挿入（既存レコードがあれば上書き）
    conn.execute(
        "INSERT OR REPLACE INTO files (path, name, title, created_at, modified_at, word_count, size_bytes, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            rel_path,
            name,
            parsed.title,
            created_at,
            modified_at,
            parsed.word_count as i64,
            size_bytes,
            now,
        ],
    )
    .map_err(|e| format!("files 挿入エラー: {}", e))?;

    let file_id: i64 = conn
        .query_row("SELECT id FROM files WHERE path = ?1", params![rel_path], |row| {
            row.get(0)
        })
        .map_err(|e| format!("file_id 取得エラー: {}", e))?;

    // 関連テーブルをクリア（INSERT OR REPLACE では CASCADE されないため）
    conn.execute("DELETE FROM frontmatter WHERE file_id = ?1", params![file_id])
        .map_err(|e| format!("frontmatter 削除エラー: {}", e))?;
    conn.execute("DELETE FROM tags WHERE file_id = ?1", params![file_id])
        .map_err(|e| format!("tags 削除エラー: {}", e))?;
    conn.execute("DELETE FROM tasks WHERE file_id = ?1", params![file_id])
        .map_err(|e| format!("tasks 削除エラー: {}", e))?;
    conn.execute("DELETE FROM links WHERE file_id = ?1", params![file_id])
        .map_err(|e| format!("links 削除エラー: {}", e))?;

    insert_metadata(conn, file_id, &parsed)?;

    Ok(())
}

/// パース済みメタデータを関連テーブルに挿入する
fn insert_metadata(conn: &Connection, file_id: i64, parsed: &ParsedMarkdown) -> Result<(), String> {
    // frontmatter
    for (key, val) in &parsed.frontmatter {
        let bool_val: Option<i32> = val.bool_val.map(|b| if b { 1 } else { 0 });
        conn.execute(
            "INSERT INTO frontmatter (file_id, key, value, value_num, value_bool) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![file_id, key, val.raw, val.num, bool_val],
        )
        .map_err(|e| format!("frontmatter 挿入エラー: {}", e))?;
    }

    // tags
    for tag in &parsed.tags {
        conn.execute(
            "INSERT INTO tags (file_id, tag, source) VALUES (?1, ?2, ?3)",
            params![file_id, tag.tag, tag.source.to_string()],
        )
        .map_err(|e| format!("tags 挿入エラー: {}", e))?;
    }

    // tasks
    for task in &parsed.tasks {
        conn.execute(
            "INSERT INTO tasks (file_id, text, checked, line_number) VALUES (?1, ?2, ?3, ?4)",
            params![
                file_id,
                task.text,
                if task.checked { 1 } else { 0 },
                task.line_number as i64,
            ],
        )
        .map_err(|e| format!("tasks 挿入エラー: {}", e))?;
    }

    // links
    for link in &parsed.links {
        conn.execute(
            "INSERT INTO links (source_file_id, target_name, link_type, display_text, url) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                file_id,
                link.target_name,
                link.link_type.to_string(),
                link.display_text,
                link.url,
            ],
        )
        .map_err(|e| format!("links 挿入エラー: {}", e))?;
    }

    Ok(())
}

/// ワークスペースルートからの相対パスを生成する
fn make_relative(file_path: &Path, workspace_root: &Path) -> String {
    file_path
        .strip_prefix(workspace_root)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| file_path.to_string_lossy().to_string())
}

/// .md ファイルを再帰的に収集する
fn collect_md_files_recursive(dir: &Path, files: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // 隠しファイル・隠しフォルダ・node_modules をスキップ
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }

        if path.is_dir() {
            collect_md_files_recursive(&path, files)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            files.push(path);
        }
    }
    Ok(())
}

/// SystemTime を ISO 8601 文字列に変換する
fn system_time_to_iso(time: Option<std::time::SystemTime>) -> String {
    match time {
        Some(t) => {
            let duration = t
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default();
            let secs = duration.as_secs();
            // 簡易 ISO 8601 変換
            let days = secs / 86400;
            let remaining = secs % 86400;
            let hours = remaining / 3600;
            let minutes = (remaining % 3600) / 60;
            let seconds = remaining % 60;

            // Unix epoch からの日数を年月日に変換（簡易計算）
            let (year, month, day) = days_to_ymd(days as i64);
            format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                year, month, day, hours, minutes, seconds
            )
        }
        None => String::new(),
    }
}

/// Unix epoch からの日数を年月日に変換
fn days_to_ymd(mut days: i64) -> (i64, i64, i64) {
    // 簡易的な Gregorian calendar 変換
    days += 719468; // shift to 0000-03-01 epoch
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// 現在時刻を ISO 8601 文字列で返す
fn chrono_now_iso() -> String {
    system_time_to_iso(Some(std::time::SystemTime::now()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;
    use std::fs;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();
        conn
    }

    fn create_test_workspace() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();

        // テストファイル1
        let f1 = dir.path().join("note1.md");
        fs::write(
            &f1,
            r#"---
title: テストノート1
tags: [project, work]
status: active
---

# テストノート1

これはテスト文書です。

- [x] 完了タスク
- [ ] 未完了タスク

[[note2]] を参照。
"#,
        )
        .unwrap();

        // テストファイル2
        let f2 = dir.path().join("note2.md");
        fs::write(
            &f2,
            r#"---
title: テストノート2
tags: [project]
---

# テストノート2

[リンク](./note1.md) と [外部](https://example.com)
"#,
        )
        .unwrap();

        // 隠しディレクトリ（スキップされるべき）
        let hidden = dir.path().join(".hidden");
        fs::create_dir_all(&hidden).unwrap();
        fs::write(hidden.join("skip.md"), "# Skip this").unwrap();

        dir
    }

    #[test]
    fn test_full_scan() {
        let conn = setup_test_db();
        let workspace = create_test_workspace();

        let result = full_scan(&conn, workspace.path()).unwrap();
        assert_eq!(result.indexed_files, 2);
        assert_eq!(result.skipped_files, 0);

        // files テーブルの確認
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        // tags テーブルの確認
        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
            .unwrap();
        assert!(tag_count >= 3); // project x2 + work x1

        // tasks テーブルの確認
        let task_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(task_count, 2);
    }

    #[test]
    fn test_update_file() {
        let conn = setup_test_db();
        let workspace = create_test_workspace();

        // 初回スキャン
        full_scan(&conn, workspace.path()).unwrap();

        // ファイルを更新
        let f1 = workspace.path().join("note1.md");
        fs::write(
            &f1,
            r#"---
title: 更新後のノート
tags: [updated]
---

# 更新後

- [ ] 新しいタスク
"#,
        )
        .unwrap();

        // 差分更新
        update_file(&conn, &f1, workspace.path()).unwrap();

        // 更新後のタイトルを確認
        let title: String = conn
            .query_row(
                "SELECT title FROM files WHERE path = 'note1.md'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(title, "更新後のノート");

        // タグが更新されていることを確認
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tags t JOIN files f ON t.file_id = f.id WHERE f.path = 'note1.md'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(tag_count, 1);
    }
}
