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
CREATE INDEX IF NOT EXISTS idx_links_target ON links (target_file_id);
