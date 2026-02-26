# メタデータクエリエンジン設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [SQLite スキーマ設計](#2-sqlite-スキーマ設計)
3. [クエリ構文定義](#3-クエリ構文定義)
4. [SQLite 変換ロジック](#4-sqlite-変換ロジック)
5. [Tauri コマンドとフロントエンド連携](#5-tauri-コマンドとフロントエンド連携)
6. [レンダリング UI 設計](#6-レンダリング-ui-設計)
7. [実装フェーズ](#7-実装フェーズ)

---

## 1. 概要と目的

### 1.1 概要

ワークスペース内の Markdown ファイルの **YAML Front Matter・タグ・タスク・リンク** を SQLite に索引化し、ノートブロック内に記述したクエリ構文で動的なリストやカレンダーを生成する機能。Obsidian の Dataview プラグインに相当する PKM 機能。

### 1.2 設計思想

- **クエリは Markdown ドキュメント内に記述**: `` ```query ``` `` コードブロックとして埋め込む。保存・エクスポート時はクエリ文字列がそのまま保持される
- **ストレージは SQLite（ローカル）**: Tauri バックエンドの Rust で `rusqlite` クレートを使用。ネットワーク不要・プライバシー保護
- **インデックスは差分更新**: ファイル保存時に該当ファイルのみ再解析することでパフォーマンスを維持
- **表示形式は 3 種類**: テーブル・リスト・カレンダー。クエリ内で `VIEW table | list | calendar` を指定

### 1.3 ユースケース例

```markdown
# プロジェクト進捗一覧

```query
SELECT title, tags, status, modified
FROM files
WHERE tags CONTAINS "project"
AND status != "done"
ORDER BY modified DESC
VIEW table
```

# 今月の会議メモ

```query
SELECT title, date, wordcount
FROM files
WHERE tags CONTAINS "meeting"
AND date BETWEEN "2026-02-01" AND "2026-02-28"
ORDER BY date ASC
VIEW list
```
```

### 1.4 MVP 設計制約: クエリ更新タイミング

> **重要**: この制約はシステムの動作を決定づける根本的な設計判断である。
> 実装前に必ず確認すること。

#### 制約: クエリ結果は「ファイル保存後」にのみ更新される

```
ユーザーが Front Matter に "tags: [foo, bar]" と入力（未保存）
         ↓
  自動保存デバウンス（500ms〜1000ms）が完了
         ↓
  Rust バックエンドがファイルを書き込み
         ↓
  update_metadata_for_file() が SQLite インデックスを更新
         ↓
  queryCache がクリアされる
         ↓
  次回クエリ実行時に最新結果が返る ✅

  ← この間（入力中〜保存完了まで）はクエリ結果が古いまま ⚠️
```

#### なぜリアルタイム更新（インメモリ AST + SQLite 統合）を MVP で採用しないか

| 方式 | 説明 | 採用 |
|------|------|------|
| **保存ベース更新（採用）** | ファイル保存完了 → SQLite 更新 → キャッシュクリア | ✅ MVP |
| リアルタイム AST 統合 | TipTap AST 変更 → インメモリ仮想 DB → SQL クエリ | ❌ Phase 8+ |

リアルタイム統合を見送る理由:
1. **複雑性**: TipTap の `EditorState` 変更イベントを監視し、AST を差分解析して
   インメモリの仮想 SQLite テーブルをリアルタイム更新する仕組みは実装コストが高い
2. **一貫性の担保が困難**: IME 変換中・デバウンス中の中間状態が SQLite に混入すると
   クエリ結果が不安定になる
3. **パフォーマンスリスク**: 高頻度の AST 差分解析がタイピング中の入力レイテンシを増加させる

#### ユーザーへの周知

クエリブロックのヘッダー部分に「最終更新: ファイル保存時」を表示し、
結果が必ずしもリアルタイムでないことをヒントとして示す。

```tsx
// QueryBlockView.tsx のヘッダー部分
<div className="query-block-header">
  <span className="query-label">クエリ</span>
  <span className="query-meta">
    {/* 最後にインデックス更新された時刻を表示 */}
    最終更新: {lastIndexedAt ? formatRelativeTime(lastIndexedAt) : '未保存'}
  </span>
  <span className="result-count">{rows.length} 件</span>
</div>
```

#### 影響する操作シナリオ

| シナリオ | 動作 | ユーザー対処 |
|----------|------|------------|
| タグを追加して即クエリ参照 | 古い結果が表示される | ファイルを保存（Ctrl+S）してから参照 |
| 別ファイルのタグを変更 | そのファイルが保存されるまでクエリに反映されない | 保存後に自動反映 |
| ワークスペース外のファイル編集 | インデックス対象外 | 手動で「インデックス再構築」を実行 |

---

## 2. SQLite スキーマ設計

### 2.1 全テーブル概要

```
metadata.db（ワークスペースルートの .md-editor/ 以下に配置）

files         ← ワークスペース内の全 .md ファイル
frontmatter   ← YAML Front Matter の全キー・値
tags          ← #タグ（frontmatter + インライン）
tasks         ← - [ ] / - [x] タスクリスト
links         ← [[Wikiリンク]] と [text](url)
```

### 2.2 files テーブル

```sql
CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  path          TEXT    NOT NULL UNIQUE, -- ワークスペース相対パス（例: "notes/idea.md"）
  name          TEXT    NOT NULL,        -- ファイル名（拡張子なし、例: "idea"）
  title         TEXT,                    -- frontmatter の title、なければ最初の H1
  created_at    TEXT,                    -- frontmatter の date/created、なければファイル作成日時
  modified_at   TEXT    NOT NULL,        -- ファイルの最終更新日時（ISO 8601）
  word_count    INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  indexed_at    TEXT    NOT NULL         -- 最後にインデックスを更新した日時
);
```

### 2.3 frontmatter テーブル

YAML Front Matter の全キー・値をフラット化して格納する。

```sql
CREATE TABLE IF NOT EXISTS frontmatter (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  key        TEXT    NOT NULL,   -- frontmatter のキー（例: "status", "author"）
  value      TEXT,               -- 値（文字列化）
  value_num  REAL,               -- 数値変換可能な場合（比較クエリ用）
  value_bool INTEGER,            -- boolean の場合（0/1）
  UNIQUE (file_id, key)
);

CREATE INDEX IF NOT EXISTS idx_frontmatter_key_value ON frontmatter (key, value);
```

**値の型変換ルール:**

| YAML 値の型 | `value` | `value_num` | `value_bool` |
|------------|---------|-------------|--------------|
| 文字列 `"done"` | `"done"` | `NULL` | `NULL` |
| 数値 `42` | `"42"` | `42.0` | `NULL` |
| boolean `true` | `"true"` | `NULL` | `1` |
| 日付 `2026-02-25` | `"2026-02-25"` | `NULL` | `NULL` |
| 配列 `[a, b]` | `"a,b"` | `NULL` | `NULL` |

### 2.4 tags テーブル

```sql
CREATE TABLE IF NOT EXISTS tags (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag     TEXT    NOT NULL,                                  -- タグ名（# なし）
  source  TEXT    NOT NULL CHECK(source IN ('frontmatter', 'inline'))
                                                             -- 出典: frontmatter か本文インライン
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags (tag);
```

**タグの抽出ルール:**

- Frontmatter: `tags: [project, work]` または `tags: project` → frontmatter ソース
- 本文中の `#project` パターン → inline ソース。ただし、コードブロック内は除外

### 2.5 tasks テーブル

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  text        TEXT    NOT NULL, -- タスクのテキスト（マーカー除く）
  checked     INTEGER NOT NULL DEFAULT 0, -- 0: 未完了, 1: 完了
  line_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_checked ON tasks (checked);
```

### 2.6 links テーブル

```sql
CREATE TABLE IF NOT EXISTS links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  target_name    TEXT    NOT NULL,  -- リンク先ファイル名 or URL
  target_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
                                   -- 解決済み Wikiリンク/内部リンクの場合
  link_type      TEXT    NOT NULL CHECK(link_type IN ('wiki', 'markdown', 'external')),
  display_text   TEXT,
  url            TEXT               -- external リンクの URL
);

CREATE INDEX IF NOT EXISTS idx_links_source ON links (source_file_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links (target_file_id);
```

### 2.7 スキーマ定義（Rust）

```rust
// src-tauri/src/metadata/schema.rs

use rusqlite::{Connection, Result};

pub fn create_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS files (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          path        TEXT NOT NULL UNIQUE,
          name        TEXT NOT NULL,
          title       TEXT,
          created_at  TEXT,
          modified_at TEXT NOT NULL,
          word_count  INTEGER NOT NULL DEFAULT 0,
          size_bytes  INTEGER NOT NULL DEFAULT 0,
          indexed_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS frontmatter (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          key        TEXT NOT NULL,
          value      TEXT,
          value_num  REAL,
          value_bool INTEGER,
          UNIQUE (file_id, key)
        );

        CREATE TABLE IF NOT EXISTS tags (
          id      INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          tag     TEXT NOT NULL,
          source  TEXT NOT NULL CHECK(source IN ('frontmatter', 'inline'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          text        TEXT NOT NULL,
          checked     INTEGER NOT NULL DEFAULT 0,
          line_number INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS links (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          source_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          target_name    TEXT NOT NULL,
          target_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
          link_type      TEXT NOT NULL CHECK(link_type IN ('wiki', 'markdown', 'external')),
          display_text   TEXT,
          url            TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_frontmatter_key_value ON frontmatter (key, value);
        CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags (tag);
        CREATE INDEX IF NOT EXISTS idx_tasks_checked ON tasks (checked);
        CREATE INDEX IF NOT EXISTS idx_links_source ON links (source_file_id);
    ")
}
```

---

## 3. クエリ構文定義

### 3.1 クエリ言語の設計方針

- **SQL に似た読み取り専用構文**: `SELECT ... FROM files WHERE ... ORDER BY ... LIMIT ... VIEW ...`
- ユーザーは SQL を知らなくてもよいが、SQL に親しいユーザーは直感的に使える
- **SELECT フィールド**: 組み込みフィールド（`title`, `tags`, `modified`, `wordcount` 等）と frontmatter の任意キー（`status`, `author` 等）を同列に指定可能
- **WHERE 句**: タグのコンテイン検索・frontmatter 等値/比較・日付範囲を自然なキーワードで書ける

### 3.2 クエリ記法（BNF）

```
query       ::= select_clause from_clause where_clause? order_clause? limit_clause? view_clause

select_clause ::= "SELECT" field_list
field_list    ::= field ("," field)*
field         ::= BUILTIN_FIELD | IDENTIFIER   // frontmatter キー

from_clause   ::= "FROM" "files"

where_clause  ::= "WHERE" condition ("AND" condition)*

condition     ::=
  | field "CONTAINS" string_val              // タグ含有・文字列含有
  | field "=" string_val | number_val
  | field "!=" string_val | number_val
  | field ">" string_val | number_val
  | field "<" string_val | number_val
  | field ">=" string_val | number_val
  | field "<=" string_val | number_val
  | field "BETWEEN" string_val "AND" string_val
  | field "IS" "NULL"
  | field "IS" "NOT" "NULL"

order_clause  ::= "ORDER BY" field ("ASC" | "DESC")?
limit_clause  ::= "LIMIT" NUMBER
view_clause   ::= "VIEW" ("table" | "list" | "calendar")
```

### 3.3 組み込みフィールド一覧

| フィールド名 | 説明 | SQL マッピング |
|-------------|------|--------------|
| `title` | ファイルタイトル | `files.title` |
| `name` | ファイル名（拡張子なし）| `files.name` |
| `path` | ファイルパス | `files.path` |
| `created` | 作成日時 | `files.created_at` |
| `modified` | 最終更新日時 | `files.modified_at` |
| `wordcount` | 単語数 | `files.word_count` |
| `size` | ファイルサイズ（バイト）| `files.size_bytes` |
| `tags` | タグ一覧（カンマ区切り）| `GROUP_CONCAT(tags.tag)` |
| `tasks` | 未完了タスク数 | `COUNT(tasks where checked=0)` |
| `tasks_done` | 完了タスク数 | `COUNT(tasks where checked=1)` |
| `links` | 発リンク数 | `COUNT(links)` |
| `backlinks` | 被リンク数 | `COUNT(incoming links)` |

**frontmatter キーも直接指定可能:**
```
SELECT title, status, author, priority
```
→ `status`, `author`, `priority` は `frontmatter` テーブルを JOIN して解決

### 3.4 クエリ記述例

```sql
-- 例1: タグフィルタ + status フィルタ
SELECT title, tags, status, modified
FROM files
WHERE tags CONTAINS "project"
AND status = "in-progress"
ORDER BY modified DESC
LIMIT 20
VIEW table

-- 例2: 未完了タスクのあるファイル一覧
SELECT title, tasks, modified
FROM files
WHERE tasks > 0
ORDER BY tasks DESC
VIEW list

-- 例3: 特定期間の会議メモ（カレンダービュー）
SELECT title, date
FROM files
WHERE tags CONTAINS "meeting"
AND date BETWEEN "2026-01-01" AND "2026-03-31"
ORDER BY date ASC
VIEW calendar

-- 例4: 著者別ドキュメント
SELECT title, author, wordcount, modified
FROM files
WHERE author = "Alice"
AND wordcount > 500
ORDER BY wordcount DESC
VIEW table
```

---

## 4. SQLite 変換ロジック

### 4.1 パーサー設計

クエリ文字列をトークナイズして AST に変換し、SQLite の `SELECT` 文に変換する。

```typescript
// src/features/metadata/query-parser.ts

export interface QueryAST {
  select: string[];          // SELECT フィールドリスト
  where: WhereCondition[];   // WHERE 条件リスト
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  view: 'table' | 'list' | 'calendar';
}

export interface WhereCondition {
  field: string;
  operator: 'CONTAINS' | '=' | '!=' | '>' | '<' | '>=' | '<=' | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL';
  value?: string | number;
  value2?: string | number;  // BETWEEN の上限値
}
```

### 4.2 TypeScript クエリパーサー

```typescript
// src/features/metadata/query-parser.ts（続き）

const BUILTIN_FIELDS = new Set([
  'title', 'name', 'path', 'created', 'modified',
  'wordcount', 'size', 'tags', 'tasks', 'tasks_done', 'links', 'backlinks',
]);

export function parseQuery(queryText: string): QueryAST {
  const lines = queryText.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const ast: QueryAST = { select: [], where: [], view: 'table' };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^SELECT\s+/i.test(line)) {
      ast.select = line.replace(/^SELECT\s+/i, '')
        .split(',')
        .map(f => f.trim().toLowerCase());
    } else if (/^WHERE\s+/i.test(line)) {
      // WHERE から次の句まで読み取り
      let whereText = line.replace(/^WHERE\s+/i, '');
      while (i + 1 < lines.length && /^AND\s+/i.test(lines[i + 1])) {
        i++;
        whereText += ' AND ' + lines[i].replace(/^AND\s+/i, '');
      }
      ast.where = parseWhereClause(whereText);
    } else if (/^ORDER BY\s+/i.test(line)) {
      const m = line.match(/^ORDER BY\s+(\w+)\s*(ASC|DESC)?$/i);
      if (m) {
        ast.orderBy = { field: m[1].toLowerCase(), direction: (m[2]?.toUpperCase() as 'ASC' | 'DESC') ?? 'DESC' };
      }
    } else if (/^LIMIT\s+(\d+)$/i.test(line)) {
      ast.limit = parseInt(line.replace(/^LIMIT\s+/i, ''), 10);
    } else if (/^VIEW\s+(table|list|calendar)$/i.test(line)) {
      ast.view = line.replace(/^VIEW\s+/i, '').toLowerCase() as 'table' | 'list' | 'calendar';
    }
    i++;
  }

  return ast;
}

export function astToSql(ast: QueryAST): string {
  const fmKeys = ast.select.filter(f => !BUILTIN_FIELDS.has(f));
  const needsTags = ast.select.includes('tags') ||
    ast.where.some(c => c.field === 'tags');
  const needsTasks = ast.select.some(f => f === 'tasks' || f === 'tasks_done') ||
    ast.where.some(c => c.field === 'tasks' || c.field === 'tasks_done');

  // SELECT 句の構築
  const selectCols: string[] = [
    'f.id', 'f.path', 'f.name', 'f.title',
    'f.created_at', 'f.modified_at', 'f.word_count', 'f.size_bytes',
  ];
  if (needsTags) {
    selectCols.push("GROUP_CONCAT(DISTINCT t.tag) AS tags");
  }
  if (needsTasks) {
    selectCols.push(
      "SUM(CASE WHEN tk.checked = 0 THEN 1 ELSE 0 END) AS tasks",
      "SUM(CASE WHEN tk.checked = 1 THEN 1 ELSE 0 END) AS tasks_done",
    );
  }
  // frontmatter キーを MAX(CASE...) パターンで選択
  fmKeys.forEach(key => {
    selectCols.push(
      `MAX(CASE WHEN fm_all.key = '${key}' THEN fm_all.value END) AS "${key}"`,
    );
  });

  // FROM + JOIN
  let sql = `SELECT ${selectCols.join(', ')}\nFROM files f\n`;
  if (needsTags) {
    sql += `LEFT JOIN tags t ON t.file_id = f.id\n`;
  }
  if (needsTasks) {
    sql += `LEFT JOIN tasks tk ON tk.file_id = f.id\n`;
  }
  if (fmKeys.length > 0) {
    sql += `LEFT JOIN frontmatter fm_all ON fm_all.file_id = f.id\n`;
  }

  // WHERE 句
  const whereParts: string[] = [];
  for (const cond of ast.where) {
    whereParts.push(conditionToSql(cond));
  }
  if (whereParts.length > 0) {
    sql += `WHERE ${whereParts.join('\nAND ')}\n`;
  }

  sql += `GROUP BY f.id\n`;

  // ORDER BY
  if (ast.orderBy) {
    const col = builtinToColumn(ast.orderBy.field);
    sql += `ORDER BY ${col} ${ast.orderBy.direction}\n`;
  }

  // LIMIT
  if (ast.limit) {
    sql += `LIMIT ${ast.limit}\n`;
  }

  return sql;
}

function conditionToSql(cond: WhereCondition): string {
  if (cond.field === 'tags') {
    if (cond.operator === 'CONTAINS') {
      return `EXISTS (SELECT 1 FROM tags t2 WHERE t2.file_id = f.id AND t2.tag = ${quote(cond.value)})`;
    }
  }
  if (!BUILTIN_FIELDS.has(cond.field)) {
    // frontmatter フィールド
    const col = `(SELECT fm.value FROM frontmatter fm WHERE fm.file_id = f.id AND fm.key = ${quote(cond.field)} LIMIT 1)`;
    return `${col} ${operatorToSql(cond.operator)} ${quote(cond.value)}`;
  }
  const col = builtinToColumn(cond.field);
  if (cond.operator === 'BETWEEN') {
    return `${col} BETWEEN ${quote(cond.value)} AND ${quote(cond.value2)}`;
  }
  if (cond.operator === 'IS NULL') return `${col} IS NULL`;
  if (cond.operator === 'IS NOT NULL') return `${col} IS NOT NULL`;
  if (cond.operator === 'CONTAINS') {
    return `${col} LIKE ${quote('%' + cond.value + '%')}`;
  }
  return `${col} ${operatorToSql(cond.operator)} ${quote(cond.value)}`;
}

function builtinToColumn(field: string): string {
  const map: Record<string, string> = {
    title: 'f.title', name: 'f.name', path: 'f.path',
    created: 'f.created_at', modified: 'f.modified_at',
    wordcount: 'f.word_count', size: 'f.size_bytes',
  };
  return map[field] ?? field;
}

function quote(v: unknown): string {
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function operatorToSql(op: string): string {
  return op === 'CONTAINS' ? 'LIKE' : op;
}

function parseWhereClause(text: string): WhereCondition[] {
  // AND で分割して各条件をパース（簡略実装）
  return text.split(/\bAND\b/i).map(part => {
    const trimmed = part.trim();
    const betweenM = trimmed.match(/^(\w+)\s+BETWEEN\s+["']?([^"']+)["']?\s+AND\s+["']?([^"']+)["']?$/i);
    if (betweenM) {
      return { field: betweenM[1].toLowerCase(), operator: 'BETWEEN' as const, value: betweenM[2], value2: betweenM[3] };
    }
    const containsM = trimmed.match(/^(\w+)\s+CONTAINS\s+["']([^"']+)["']$/i);
    if (containsM) {
      return { field: containsM[1].toLowerCase(), operator: 'CONTAINS' as const, value: containsM[2] };
    }
    const opM = trimmed.match(/^(\w+)\s*(=|!=|>=|<=|>|<)\s*["']?([^"']+)["']?$/);
    if (opM) {
      return { field: opM[1].toLowerCase(), operator: opM[2] as WhereCondition['operator'], value: opM[3] };
    }
    return { field: trimmed, operator: 'IS NOT NULL' as const };
  });
}
```

---

## 5. Tauri コマンドとフロントエンド連携

### 5.1 Rust 側 Tauri コマンド

```rust
// src-tauri/src/metadata/commands.rs

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize)]
pub struct QueryResultRow {
    pub path: String,
    pub name: String,
    pub title: Option<String>,
    pub fields: std::collections::HashMap<String, serde_json::Value>,
}

/// ワークスペース全スキャンでインデックスを構築（起動時・ワークスペース変更時）
#[tauri::command]
pub async fn build_metadata_index(
    app: AppHandle,
    workspace_root: String,
) -> Result<usize, String> {
    let indexer = MetadataIndexer::new(&app, &workspace_root)?;
    indexer.full_scan().await.map_err(|e| e.to_string())
}

/// 単一ファイルのインデックスを更新（ファイル保存時）
#[tauri::command]
pub async fn update_metadata_for_file(
    app: AppHandle,
    file_path: String,
) -> Result<(), String> {
    let indexer = MetadataIndexer::new_from_cache(&app)?;
    indexer.index_file(&file_path).await.map_err(|e| e.to_string())
}

/// クエリを実行して結果を返す
#[tauri::command]
pub async fn execute_metadata_query(
    app: AppHandle,
    sql: String,
) -> Result<Vec<QueryResultRow>, String> {
    let db = get_metadata_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    execute_query(&conn, &sql).map_err(|e| e.to_string())
}
```

### 5.2 フロントエンド型定義と Zustand ストア

```typescript
// src/features/metadata/types.ts

export interface QueryResultRow {
  path: string;
  name: string;
  title: string | null;
  fields: Record<string, string | number | null>;
}

export interface MetadataQueryStore {
  /** クエリを実行して結果を返す（キャッシュ付き）*/
  executeQuery: (queryText: string) => Promise<QueryResultRow[]>;
  /** ファイル保存時に呼ばれるインデックス更新 */
  updateIndex: (filePath: string) => Promise<void>;
  /** ワークスペース変更時に全インデックスを再構築 */
  rebuildIndex: (workspaceRoot: string) => Promise<void>;
}

// src/features/metadata/metadataStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { parseQuery, astToSql } from './query-parser';

const queryCache = new Map<string, QueryResultRow[]>();

export const useMetadataStore = create<MetadataQueryStore>(() => ({
  executeQuery: async (queryText: string) => {
    const cacheKey = queryText.trim();
    if (queryCache.has(cacheKey)) return queryCache.get(cacheKey)!;

    const ast = parseQuery(queryText);
    const sql = astToSql(ast);
    const rows = await invoke<QueryResultRow[]>('execute_metadata_query', { sql });
    queryCache.set(cacheKey, rows);
    return rows;
  },

  updateIndex: async (filePath: string) => {
    await invoke('update_metadata_for_file', { filePath });
    queryCache.clear(); // キャッシュを無効化
  },

  rebuildIndex: async (workspaceRoot: string) => {
    await invoke('build_metadata_index', { workspaceRoot });
    queryCache.clear();
  },
}));
```

---

## 6. レンダリング UI 設計

クエリ結果はエディタ内でインタラクティブなビューとして表示される。`VIEW table | list | calendar` で表示形式を選択する。

### 6.1 テーブルビュー

```
┌──────────────────────────────────────────────────────────────────┐
│ クエリ結果: 5 件                               [テーブル ▼] [↺]  │
├──────────────────────────┬──────────────┬──────────┬────────────┤
│ タイトル                  │ タグ          │ status   │ 更新日     │
├──────────────────────────┼──────────────┼──────────┼────────────┤
│ ↗ meeting-notes.md       │ #project     │ active   │ 2026-02-24 │
│ ↗ design-overview.md     │ #project     │ draft    │ 2026-02-23 │
│ ↗ sprint-planning.md     │ #project     │ active   │ 2026-02-22 │
│ ↗ retrospective.md       │ #project     │ done     │ 2026-02-20 │
│ ↗ team-sync.md           │ #project     │ active   │ 2026-02-18 │
└──────────────────────────┴──────────────┴──────────┴────────────┘
```

```tsx
// src/features/metadata/views/TableView.tsx
import { QueryResultRow } from '../types';

interface TableViewProps {
  rows: QueryResultRow[];
  fields: string[];
  onRowClick: (row: QueryResultRow) => void;
}

export function TableView({ rows, fields, onRowClick }: TableViewProps) {
  return (
    <div className="metadata-table-view">
      <table>
        <thead>
          <tr>
            {fields.map(f => (
              <th key={f}>{FIELD_LABELS[f] ?? f}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.path} onClick={() => onRowClick(row)}>
              {fields.map(f => (
                <td key={f}>
                  {f === 'title' || f === 'name'
                    ? <span className="file-link">↗ {row.title ?? row.name}</span>
                    : formatFieldValue(f, row.fields[f])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  title: 'タイトル', name: 'ファイル名', path: 'パス',
  created: '作成日', modified: '更新日', wordcount: '文字数',
  tags: 'タグ', tasks: '未完了タスク', tasks_done: '完了タスク',
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (field === 'modified' || field === 'created') {
    return String(value).slice(0, 10); // ISO date の先頭 10 文字
  }
  if (field === 'tags') {
    return String(value).split(',').map(t => `#${t.trim()}`).join(' ');
  }
  return String(value);
}
```

### 6.2 リストビュー

```
• ↗ meeting-notes.md
    #project  ·  active  ·  更新: 2026-02-24  ·  1,234 字

• ↗ design-overview.md
    #project  ·  draft  ·  更新: 2026-02-23  ·  2,567 字

• ↗ sprint-planning.md
    #project  ·  active  ·  更新: 2026-02-22  ·  892 字
```

```tsx
// src/features/metadata/views/ListView.tsx
export function ListView({ rows, fields, onRowClick }: TableViewProps) {
  return (
    <ul className="metadata-list-view">
      {rows.map(row => (
        <li key={row.path} onClick={() => onRowClick(row)}>
          <span className="file-link">↗ {row.title ?? row.name}</span>
          <span className="meta-line">
            {fields
              .filter(f => f !== 'title' && f !== 'name')
              .map(f => <span key={f}>{formatFieldValue(f, row.fields[f])}</span>)
              .reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ' · ', el], [])}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

### 6.3 カレンダービュー

`date` フィールド（または `created` / `modified`）の値でファイルをカレンダーに配置する。

```
     2026年2月
 Mo  Tu  We  Th  Fr  Sa  Su
                          1
  2   3   4   5   6   7   8
  9  10  11  12  13  14  15
 16  17  18  19  20  21  22
 23  24  25  26  27  28

 [24] meeting-notes.md
 [25] design-overview.md
```

```tsx
// src/features/metadata/views/CalendarView.tsx
import { useMemo } from 'react';
import { QueryResultRow } from '../types';

interface CalendarViewProps {
  rows: QueryResultRow[];
  dateField: string;  // 'date' | 'created' | 'modified'
  onRowClick: (row: QueryResultRow) => void;
}

export function CalendarView({ rows, dateField, onRowClick }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());

  const byDate = useMemo(() => {
    const map = new Map<string, QueryResultRow[]>();
    for (const row of rows) {
      const dateVal = row.fields[dateField] ?? row.fields['modified'];
      if (!dateVal) continue;
      const dateStr = String(dateVal).slice(0, 10); // "YYYY-MM-DD"
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(row);
    }
    return map;
  }, [rows, dateField]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  return (
    <div className="metadata-calendar-view">
      <div className="calendar-nav">
        <button onClick={() => prevMonth(year, month, setYear, setMonth)}>‹</button>
        <span>{year}年 {month + 1}月</span>
        <button onClick={() => nextMonth(year, month, setYear, setMonth)}>›</button>
      </div>
      <div className="calendar-grid">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="day-header">{d}</div>
        ))}
        {Array.from({ length: (firstDayOfWeek + 6) % 7 }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entries = byDate.get(dateStr) ?? [];
          return (
            <div key={day} className={`calendar-day ${entries.length ? 'has-entries' : ''}`}>
              <span className="day-num">{day}</span>
              {entries.map(row => (
                <button key={row.path} className="calendar-entry" onClick={() => onRowClick(row)}>
                  {row.title ?? row.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 6.4 クエリブロックコンテナコンポーネント

エディタ内での ```` ```query ```` ブロックを NodeView としてレンダリングする。

```tsx
// src/features/metadata/QueryBlockView.tsx
import { useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { parseQuery, astToSql } from './query-parser';
import { useMetadataStore } from './metadataStore';
import { TableView } from './views/TableView';
import { ListView } from './views/ListView';
import { CalendarView } from './views/CalendarView';
import type { QueryResultRow } from './types';

interface QueryBlockViewProps {
  node: { attrs: { query: string } };
}

export function QueryBlockView({ node }: QueryBlockViewProps) {
  const [rows, setRows] = useState<QueryResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const executeQuery = useMetadataStore(s => s.executeQuery);

  const queryText = node.attrs.query;
  const ast = (() => { try { return parseQuery(queryText); } catch { return null; } })();

  useEffect(() => {
    if (!ast) { setError('クエリ構文エラー'); setLoading(false); return; }
    setLoading(true);
    executeQuery(queryText)
      .then(result => { setRows(result); setError(null); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [queryText]);

  const openFile = (row: QueryResultRow) => {
    // タブでファイルを開く
    import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('open_file_in_tab', { path: row.path })
    );
  };

  return (
    <NodeViewWrapper>
      <div className="query-block" contentEditable={false}>
        <div className="query-block-header">
          <code className="query-source">{queryText.split('\n')[0]}...</code>
          {loading && <span className="loading-spinner" />}
          <span className="result-count">{rows.length} 件</span>
        </div>
        {error && <div className="query-error">{error}</div>}
        {!loading && !error && ast?.view === 'table' && (
          <TableView rows={rows} fields={ast.select} onRowClick={openFile} />
        )}
        {!loading && !error && ast?.view === 'list' && (
          <ListView rows={rows} fields={ast.select} onRowClick={openFile} />
        )}
        {!loading && !error && ast?.view === 'calendar' && (
          <CalendarView rows={rows} dateField="date" onRowClick={openFile} />
        )}
      </div>
    </NodeViewWrapper>
  );
}
```

---

## 7. SQLite データベースマイグレーション戦略

### 7.1 課題：アプリアップデートによるスキーマ変更

Phase 2, 3, ... とアプリがアップデートされるにつれて SQLite スキーマが変更される可能性がある。
ユーザーのローカル `metadata.db` を破壊せずに安全にスキーマを移行する仕組みが必要である。

### 7.2 スキーマバージョン管理

SQLite の `user_version` プラグマを使ってスキーマバージョンを管理する:

```sql
-- アプリ起動時にバージョンを確認
PRAGMA user_version;

-- バージョンを設定（マイグレーション後に実行）
PRAGMA user_version = 3;
```

**スキーマバージョン対応表**:

| `user_version` | 対応 Phase | 変更内容 |
|---------------|-----------|---------|
| 0 | 初期状態（DB 未作成） | — |
| 1 | Phase 7.5 | 初期スキーマ（§2 の files / frontmatter / tags / tasks / links テーブル） |
| 2 | Phase 8 | `tasks` テーブルに `priority` カラム追加 / `links` に `link_type` カラム追加 |
| 3 | 以降 | 今後追加 |

### 7.3 マイグレーション実装（Rust）

```rust
// src-tauri/src/db/migrations.rs

use rusqlite::{Connection, Result};

/// 現在の DB バージョンを取得
fn get_db_version(conn: &Connection) -> Result<u32> {
    conn.pragma_query_value(None, "user_version", |row| row.get(0))
}

/// DB バージョンを設定
fn set_db_version(conn: &Connection, version: u32) -> Result<()> {
    conn.pragma_update(None, "user_version", version)
}

/// アプリ起動時に呼ぶマイグレーションランナー
/// 現在の DB バージョンから最新バージョンまで順番にマイグレーションを適用する。
pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    let current_version = get_db_version(conn)?;
    let target_version = MIGRATIONS.len() as u32;

    if current_version >= target_version {
        return Ok(()); // 最新バージョン、マイグレーション不要
    }

    log::info!(
        "DB マイグレーション開始: version {} → {}",
        current_version, target_version
    );

    // トランザクション内で全マイグレーションを適用（途中失敗時はロールバック）
    let tx = conn.transaction()?;

    for (i, migration) in MIGRATIONS.iter().enumerate() {
        let migration_version = (i + 1) as u32;
        if migration_version > current_version {
            log::info!("  マイグレーション v{} を適用中...", migration_version);
            tx.execute_batch(migration.sql)?;
        }
    }

    set_db_version(&tx, target_version)?;
    tx.commit()?;

    log::info!("DB マイグレーション完了: version {}", target_version);
    Ok(())
}

/// マイグレーション定義リスト（バージョン順）
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "初期スキーマ作成",
        sql: include_str!("sql/migration_v1.sql"),
    },
    Migration {
        version: 2,
        description: "tasks.priority カラム追加 / links.link_type カラム追加",
        sql: include_str!("sql/migration_v2.sql"),
    },
];

struct Migration {
    version: u32,
    description: &'static str,
    sql: &'static str,
}
```

**マイグレーション SQL ファイルの例**:

```sql
-- src-tauri/src/db/sql/migration_v2.sql

-- tasks テーブルに priority カラムを追加（既存行は DEFAULT 値で埋まる）
ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

-- links テーブルに link_type カラムを追加
ALTER TABLE links ADD COLUMN link_type TEXT NOT NULL DEFAULT 'wiki';

-- 既存の Wikiリンクを link_type='wiki' で更新（migration_v1 からの移行時）
UPDATE links SET link_type = 'wiki' WHERE link_type = '';
```

### 7.4 DB バックアップ戦略（マイグレーション前）

スキーマ変更が失敗するリスクに備え、マイグレーション前に DB をバックアップする:

```rust
// src-tauri/src/db/backup.rs

pub async fn backup_db_before_migration(db_path: &Path) -> Result<PathBuf, BackupError> {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_path = db_path.with_file_name(
        format!("metadata.backup_{}.db", timestamp)
    );

    tokio::fs::copy(db_path, &backup_path).await?;
    log::info!("DB バックアップ作成: {:?}", backup_path);

    Ok(backup_path)
}
```

バックアップは最新 3 件のみ保持し、古いものは自動削除する。

### 7.5 マイグレーション失敗時のフォールバック

```
アプリ起動時の DB 初期化フロー:
  │
  ▼
[DB ファイル存在確認]
  │
  ├─ 存在しない → 新規作成（最新スキーマで初期化）
  │
  └─ 存在する
       │
       ▼
     [マイグレーション前バックアップ作成]
       │
       ▼
     [run_migrations() 実行]
       │
       ├─ 成功 → 通常起動
       │
       └─ 失敗
             │
             ▼
           [バックアップから復元]
             │
             ▼
           [エラー通知ダイアログ]
           「データベースの更新に失敗しました。
            前回の状態に復元しました。
            メタデータインデックスを再構築しますか？」
           [再構築する] [スキップ]
             │
             └─ [再構築する] → metadata.db を削除して新規作成
                              → build_metadata_index() をバックグラウンドで実行
```

### 7.6 再インデックス（完全再構築）

マイグレーション失敗時や DB 破損時は、ワークスペース全体を再スキャンして
メタデータインデックスを一から再構築できる:

```rust
// src-tauri/src/db/index.rs

#[tauri::command]
pub async fn rebuild_metadata_index(
    workspace_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // 既存 DB を削除
    let db_path = get_db_path(&app_handle);
    if db_path.exists() {
        tokio::fs::remove_file(&db_path).await.map_err(|e| e.to_string())?;
    }

    // 新規作成 + 最新スキーマで初期化
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    run_migrations(&mut conn.into()).map_err(|e| e.to_string())?;

    // ワークスペース全体を再スキャン（バックグラウンドタスク）
    tokio::spawn(async move {
        build_metadata_index(workspace_path, app_handle).await;
    });

    Ok(())
}
```

---

## 8. 実装フェーズ

| フェーズ | 内容 |
|---------|------|
| Phase 7.5（基盤）| SQLite スキーマ定義・`rusqlite` 統合・ワークスペース全スキャンインデックス構築 |
| Phase 7.5（クエリ）| TypeScript クエリパーサー・`astToSql` 変換・`execute_metadata_query` Tauri コマンド |
| Phase 7.5（UI）| `QueryBlockView` NodeView・テーブルビュー・リストビュー実装 |
| Phase 7.5（差分更新）| ファイル保存時の差分インデックス更新・キャッシュ無効化 |
| Phase 8（拡張）| カレンダービュー・クエリオートコンプリート・クエリ履歴 |

---

## 関連ドキュメント

- [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) — Wikiリンクインデックス（links テーブルと連携）
- [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) — ワークスペース管理（インデックス対象ファイル）
- [performance-design.md](../01_Architecture/performance-design.md) — バックグラウンドインデックス更新のパフォーマンス
- [search-design.md](./search-design.md) — 全文検索との違い（メタデータ vs 本文テキスト）
