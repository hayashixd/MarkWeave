use rusqlite::{Connection, Result};

/// 現在の DB バージョンを取得
fn get_db_version(conn: &Connection) -> Result<u32> {
    conn.pragma_query_value(None, "user_version", |row| row.get(0))
}

/// DB バージョンを設定
fn set_db_version(conn: &Connection, version: u32) -> Result<()> {
    conn.pragma_update(None, "user_version", version)
}

struct Migration {
    version: u32,
    description: &'static str,
    sql: &'static str,
}

/// マイグレーション定義リスト（バージョン順）
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "初期スキーマ作成（files / frontmatter / tags / tasks / links）",
        sql: include_str!("sql/migration_v1.sql"),
    },
];

/// アプリ起動時に呼ぶマイグレーションランナー。
/// 現在の DB バージョンから最新バージョンまで順番にマイグレーションを適用する。
pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    let current_version = get_db_version(conn)?;
    let target_version = MIGRATIONS.len() as u32;

    if current_version >= target_version {
        return Ok(());
    }

    log::info!(
        "DB マイグレーション開始: version {} → {}",
        current_version,
        target_version
    );

    let tx = conn.transaction()?;

    for migration in MIGRATIONS.iter() {
        if migration.version > current_version {
            log::info!(
                "  マイグレーション v{} を適用中: {}",
                migration.version,
                migration.description
            );
            tx.execute_batch(migration.sql)?;
        }
    }

    set_db_version(&tx, target_version)?;
    tx.commit()?;

    log::info!("DB マイグレーション完了: version {}", target_version);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fresh_migration() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();

        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, 1);

        // files テーブルが存在することを確認
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='files'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // frontmatter テーブルが存在することを確認
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='frontmatter'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // tags テーブルが存在することを確認
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // tasks テーブルが存在することを確認
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tasks'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // links テーブルが存在することを確認
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='links'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_idempotent_migration() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();
        // 2回目の実行は何もしない
        run_migrations(&mut conn).unwrap();
        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, 1);
    }

    #[test]
    fn test_schema_structure() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();

        // files テーブルにレコードを挿入できることを確認
        conn.execute(
            "INSERT INTO files (path, name, title, created_at, modified_at, word_count, size_bytes, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                "notes/test.md",
                "test",
                "Test Note",
                "2026-01-01T00:00:00Z",
                "2026-03-10T00:00:00Z",
                100,
                1024,
                "2026-03-10T00:00:00Z",
            ],
        )
        .unwrap();

        let file_id: i64 = conn
            .query_row("SELECT id FROM files WHERE path = 'notes/test.md'", [], |row| {
                row.get(0)
            })
            .unwrap();

        // frontmatter 挿入
        conn.execute(
            "INSERT INTO frontmatter (file_id, key, value, value_num, value_bool) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![file_id, "status", "draft", rusqlite::types::Null, rusqlite::types::Null],
        )
        .unwrap();

        // tags 挿入
        conn.execute(
            "INSERT INTO tags (file_id, tag, source) VALUES (?1, ?2, ?3)",
            rusqlite::params![file_id, "project", "frontmatter"],
        )
        .unwrap();

        // tasks 挿入
        conn.execute(
            "INSERT INTO tasks (file_id, text, checked, line_number) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![file_id, "タスク1", 0, 10],
        )
        .unwrap();

        // links 挿入
        conn.execute(
            "INSERT INTO links (source_file_id, target_name, link_type, display_text) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![file_id, "other-note", "wiki", "Other Note"],
        )
        .unwrap();

        // CASCADE 削除の確認
        conn.execute("DELETE FROM files WHERE id = ?1", rusqlite::params![file_id])
            .unwrap();

        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
            .unwrap();
        assert_eq!(tag_count, 0, "CASCADE 削除でタグも削除されるべき");
    }
}
