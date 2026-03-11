# Tauri IPC コマンドインターフェース定義

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-26

フロントエンド（TypeScript）から `invoke()` で呼び出す Tauri コマンドの引数・戻り値型を一覧化したインターフェース定義書。
フロントエンドとバックエンドの**並行開発**・**型安全な統合テスト**・**スキーマドリフト防止**を目的とする。

> **ルール**: 新規 Tauri コマンドを追加する際は、必ずこのドキュメントに型定義を追記してから実装する。
> TypeScript 側の `invoke<T>()` の型パラメータはこのドキュメントの型定義と一致させること。

---

## 目次

1. [ファイル操作コマンド](#1-ファイル操作コマンド)
2. [ワークスペース管理コマンド](#2-ワークスペース管理コマンド)
3. [画像・アセット管理コマンド](#3-画像アセット管理コマンド)
4. [検索コマンド](#4-検索コマンド)
5. [メタデータ・インデックスコマンド](#5-メタデータインデックスコマンド)
6. [Wikiリンクコマンド](#6-wikiリンクコマンド)
7. [Git 統合コマンド](#7-git-統合コマンド)
8. [プラグイン管理コマンド](#8-プラグイン管理コマンド)
9. [ウィンドウ・アプリ管理コマンド](#9-ウィンドウアプリ管理コマンド)
10. [エラー型定義](#10-エラー型定義)

---

## 共通型定義

```typescript
// src/types/tauri-commands.ts

/** Tauri コマンドが返すエラーの共通フォーマット */
export interface TauriError {
  code: string;       // 例: "FILE_NOT_FOUND" | "PERMISSION_DENIED" | "IO_ERROR"
  message: string;    // 人間向けエラーメッセージ（日本語）
  detail?: string;    // デバッグ用の詳細情報（スタックトレース等）
}

/** Result 型（成功/失敗）*/
export type TauriResult<T> = T; // invoke が throw する場合は TauriError がスローされる
```

---

## 1. ファイル操作コマンド

### `read_file`

```typescript
// Rust シグネチャ: pub async fn read_file(path: String) -> Result<String, String>
await invoke<string>('read_file', { path: '/path/to/file.md' });
// 戻り値: ファイルの UTF-8 テキスト内容
// エラー: FILE_NOT_FOUND | PERMISSION_DENIED | ENCODING_ERROR
```

### `write_file`

```typescript
// Rust シグネチャ: pub async fn write_file(path: String, content: String) -> Result<(), String>
await invoke<void>('write_file', { path: '/path/to/file.md', content: '# Hello' });
// 戻り値: なし（成功時は undefined）
// エラー: PERMISSION_DENIED | DISK_FULL | IO_ERROR
```

### `rename_file`

```typescript
interface RenameFileArgs {
  oldPath: string;
  newPath: string;
}
// Rust シグネチャ: pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String>
await invoke<void>('rename_file', { oldPath: '...', newPath: '...' });
// 副作用: image-design.md §3 の updateImagePathsOnMove が TS 側で呼ばれる（Rust 側では行わない）
// エラー: FILE_NOT_FOUND | PERMISSION_DENIED | TARGET_EXISTS
```

### `move_to_trash`

```typescript
// Rust シグネチャ: pub async fn move_to_trash(path: String) -> Result<(), String>
await invoke<void>('move_to_trash', { path: '/path/to/file.md' });
// エラー: FILE_NOT_FOUND | PERMISSION_DENIED
```

### `file_exists`

```typescript
// Rust シグネチャ: pub async fn file_exists(path: String) -> Result<bool, String>
const exists = await invoke<boolean>('file_exists', { path: '/path/to/file.md' });
```

### `watch_file`

```typescript
interface WatchFileArgs {
  path: string;
  eventName: string;  // フロントエンドが listen() するイベント名
}
// Rust シグネチャ: pub async fn watch_file(path: String, event_name: String) -> Result<(), String>
await invoke<void>('watch_file', { path: '...', eventName: 'file-changed' });
// 副作用: ファイル変更時に `event_name` でイベントを emit する
```

---

## 2. ワークスペース管理コマンド

### `list_workspace_files`

```typescript
interface WorkspaceFile {
  path: string;
  name: string;
  isDirectory: boolean;
  modifiedAt: string;    // ISO 8601
  size: number;          // バイト数（ファイルのみ）
}

interface ListWorkspaceFilesArgs {
  rootPath: string;
  recursive: boolean;
  extensions?: string[];  // ['md', 'markdown', 'html'] 等でフィルタ
}

// Rust シグネチャ: pub async fn list_workspace_files(...) -> Result<Vec<WorkspaceFile>, String>
const files = await invoke<WorkspaceFile[]>('list_workspace_files', {
  rootPath: '/workspace',
  recursive: true,
  extensions: ['md', 'markdown'],
});
```

### `watch_workspace`

```typescript
interface WatchWorkspaceArgs {
  rootPath: string;
  eventName: string;
}

interface WorkspaceChangeEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;  // renamed の場合のみ
}

// Rust シグネチャ: pub async fn watch_workspace(root_path: String, event_name: String) -> Result<(), String>
await invoke<void>('watch_workspace', { rootPath: '...', eventName: 'workspace-changed' });
// 副作用: 変更時に { type, path, oldPath } 形式のペイロードで eventName を emit
```

---

## 3. 画像・アセット管理コマンド

### `save_image`

```typescript
interface SaveImageArgs {
  markdownPath: string;
  imageData: number[];   // Uint8Array を number[] に変換（Tauri IPC の制約）
  originalName: string;
  settings: ImageStorageSettings;  // image-design.md §1.2 参照
}

interface SaveImageResult {
  savedPath: string;      // 保存された絶対パス
  relativePath: string;   // markdown ファイルからの相対パス
}

// Rust シグネチャ: pub async fn save_image(...) -> Result<SaveImageResult, String>
const result = await invoke<SaveImageResult>('save_image', { ... });
```

### `cache_remote_image`

```typescript
// Rust シグネチャ: pub async fn cache_remote_image(url: String) -> Result<String, String>
const localPath = await invoke<string>('cache_remote_image', { url: 'https://...' });
// 戻り値: キャッシュされたローカルファイルの絶対パス
// エラー: NETWORK_ERROR | HTTP_ERROR (ステータスコード付き)
```

### `purge_image_cache`

```typescript
// Rust シグネチャ: pub async fn purge_image_cache(max_bytes: u64) -> Result<u64, String>
const freedBytes = await invoke<number>('purge_image_cache', { maxBytes: 100 * 1024 * 1024 });
// 戻り値: 解放したバイト数
```

---

## 4. 検索コマンド

### `search_workspace`

```typescript
interface SearchWorkspaceArgs {
  rootPath: string;
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  includePatterns?: string[];  // glob パターン
  excludePatterns?: string[];
  maxResults?: number;         // デフォルト: 1000
}

interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;    // 行内のマッチ開始位置（バイト）
  matchEnd: number;      // 行内のマッチ終了位置（バイト）
}

interface SearchWorkspaceResult {
  matches: SearchMatch[];
  totalFiles: number;
  searchedFiles: number;
  truncated: boolean;    // maxResults に達して打ち切られた場合 true
}

// Rust シグネチャ: pub async fn search_workspace(...) -> Result<SearchWorkspaceResult, String>
const result = await invoke<SearchWorkspaceResult>('search_workspace', { ... });
```

---

## 5. メタデータ・インデックスコマンド

### `index_workspace_metadata`

```typescript
interface IndexWorkspaceMetadataArgs {
  rootPath: string;
  forceRebuild?: boolean;  // false: 差分更新、true: 全再スキャン
}

interface IndexResult {
  indexedFiles: number;
  skippedFiles: number;
  durationMs: number;
}

// Rust シグネチャ: pub async fn index_workspace_metadata(...) -> Result<IndexResult, String>
const result = await invoke<IndexResult>('index_workspace_metadata', { rootPath: '...' });
```

### `execute_metadata_query`

```typescript
interface ExecuteMetadataQueryArgs {
  sql: string;              // TypeScript 側でパースした SQL（sanitize 済み）
  params: (string | number | null)[];
}

interface MetadataQueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}

// Rust シグネチャ: pub async fn execute_metadata_query(...) -> Result<MetadataQueryResult, String>
const result = await invoke<MetadataQueryResult>('execute_metadata_query', { sql: '...', params: [] });
// 注意: SQL は TypeScript の parseQuery/astToSql で生成されたものに限定。
//       ユーザー入力の生 SQL をそのまま渡さないこと（SQLi 対策）。
```

---

## 6. Wikiリンクコマンド

### `scan_wikilinks`

```typescript
interface ScanWikilinksArgs {
  rootPath: string;
}

interface WikilinkIndex {
  /** ファイルパス → そのファイルへのリンク元リスト */
  backlinks: Record<string, string[]>;
  /** ファイルパス → そのファイルが参照するリンク先リスト */
  forwardlinks: Record<string, string[]>;
}

// Rust シグネチャ: pub async fn scan_wikilinks(root_path: String) -> Result<WikilinkIndex, String>
const index = await invoke<WikilinkIndex>('scan_wikilinks', { rootPath: '...' });
```

### `get_graph_data`

```typescript
interface GraphNode {
  id: string;         // ファイルパス
  label: string;      // ファイル名（拡張子なし）
  tags: string[];
  linkCount: number;
}

interface GraphEdge {
  source: string;     // ファイルパス
  target: string;     // ファイルパス
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Rust シグネチャ: pub async fn get_graph_data(root_path: String) -> Result<GraphData, String>
const graph = await invoke<GraphData>('get_graph_data', { rootPath: '...' });
```

### `get_backlinks`

```typescript
interface BacklinkResult {
  sourcePath: string;   // リンク元ファイルの相対パス
  sourceName: string;   // リンク元ファイル名（拡張子なし）
  sourceTitle: string | null;
  contexts: string[];   // マッチした周辺テキスト（最大3件）
}

// Rust シグネチャ: pub async fn get_backlinks(file_path: String, workspace_root: String) -> Result<Vec<BacklinkResult>, String>
const backlinks = await invoke<BacklinkResult[]>('get_backlinks', {
  filePath: 'relative/path/to/file.md',
  workspaceRoot: '/absolute/workspace/root',
});
```

---

## 7. Git 統合コマンド

### `git_status`

```typescript
interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
}

// Rust シグネチャ: pub async fn git_status(repo_path: String) -> Result<Vec<GitFileStatus>, String>
const statuses = await invoke<GitFileStatus[]>('git_status', { repoPath: '...' });
```

### `git_diff`

```typescript
interface GitDiffArgs {
  repoPath: string;
  filePath: string;
  staged?: boolean;   // false: working tree vs index、true: index vs HEAD
}

// Rust シグネチャ: pub async fn git_diff(...) -> Result<String, String>
const diffText = await invoke<string>('git_diff', { repoPath: '...', filePath: '...' });
// 戻り値: unified diff 形式のテキスト
```

### `git_stage` / `git_unstage`

```typescript
await invoke<void>('git_stage', { repoPath: '...', filePath: '...' });
await invoke<void>('git_unstage', { repoPath: '...', filePath: '...' });
```

### `git_commit`

```typescript
interface GitCommitArgs {
  repoPath: string;
  message: string;
}

interface GitCommitResult {
  sha: string;
  shortSha: string;
}

// Rust シグネチャ: pub async fn git_commit(...) -> Result<GitCommitResult, String>
const result = await invoke<GitCommitResult>('git_commit', { repoPath: '...', message: 'feat: ...' });
```

---

## 8. プラグイン管理コマンド

### `is_safe_mode_active`

```typescript
// Rust シグネチャ: pub fn is_safe_mode_active() -> bool
const safeMode = await invoke<boolean>('is_safe_mode_active');
```

### `restart_app`

```typescript
// Rust シグネチャ: pub fn restart_app(app: AppHandle) -> Result<(), String>
await invoke<void>('restart_app');
// 注: セーフモード制御は別コマンド set_safe_mode で事前に切り替えてから呼び出す
```

---

## 9. ウィンドウ・アプリ管理コマンド

### `set_title_dirty`

```typescript
// Rust シグネチャ: pub fn set_title_dirty(window: Window, dirty: bool, file_name: Option<String>) -> Result<(), String>
await invoke<void>('set_title_dirty', { dirty: true, fileName: 'README.md' });
// 効果: タイトルバーに「● README.md - MarkWeave」と表示
```

### `get_app_version`

```typescript
interface AppVersion {
  version: string;    // "1.2.3"
  buildDate: string;  // ISO 8601
}
// Rust シグネチャ: pub fn get_app_version() -> AppVersion
const version = await invoke<AppVersion>('get_app_version');
```

### `print_to_pdf`

```typescript
// export-interop-design.md §3.2 に準拠

interface PdfOptions {
  paperSize: 'A4' | 'Letter' | 'A3';
  orientation: 'portrait' | 'landscape';
  marginTop: number;     // mm 単位
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  printHeaderFooter: boolean;
}

// Rust シグネチャ: pub async fn print_to_pdf(app: AppHandle, html_content: String, output_path: String, options: PdfOptions) -> Result<u64, String>
const sizeBytes = await invoke<number>('print_to_pdf', {
  htmlContent: '<html>...</html>',
  outputPath: '/path/to/output.pdf',
  options: {
    paperSize: 'A4',
    orientation: 'portrait',
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 25,
    printHeaderFooter: false,
  },
});
// 戻り値: PDF ファイルのバイト数
```

### `try_acquire_file_lock`

```typescript
// window-tab-session-design.md §11 に準拠
// Rust シグネチャ: pub fn try_acquire_file_lock(app: AppHandle, registry: State<FileLockRegistry>, file_path: String, window_label: String) -> serde_json::Value
interface FileLockResult {
  acquired: boolean;
  ownerLabel: string | null;
}
const result = await invoke<FileLockResult>('try_acquire_file_lock', {
  filePath: '/path/to/file.md',
  windowLabel: 'main',
});
```

### `release_file_lock`

```typescript
// Rust シグネチャ: pub fn release_file_lock(app: AppHandle, registry: State<FileLockRegistry>, file_path: String, window_label: String)
await invoke<void>('release_file_lock', {
  filePath: '/path/to/file.md',
  windowLabel: 'main',
});
```

### `transfer_file_lock`

```typescript
// Rust シグネチャ: pub fn transfer_file_lock(app: AppHandle, registry: State<FileLockRegistry>, file_path: String, from_label: String, to_label: String) -> bool
const transferred = await invoke<boolean>('transfer_file_lock', {
  filePath: '/path/to/file.md',
  fromLabel: 'main',
  toLabel: 'detached-1',
});
```

### `notify_write_access_denied`

```typescript
// Rust シグネチャ: pub fn notify_write_access_denied(app: AppHandle, file_path: String, requester_label: String)
await invoke<void>('notify_write_access_denied', {
  filePath: '/path/to/file.md',
  requesterLabel: 'detached-1',
});
```

### `emit_to_window`

```typescript
interface EmitToWindowArgs {
  label: string;        // 送信先ウィンドウの label
  event: string;        // イベント名
  payload: unknown;     // 任意のペイロード
}
// Rust シグネチャ: pub fn emit_to_window(app: AppHandle, label: String, event: String, payload: serde_json::Value) -> Result<(), String>
await invoke<void>('emit_to_window', {
  label: 'detached-1',
  event: 'write-access-transfer-requested',
  payload: { filePath: '...', requesterLabel: 'main', ownerLabel: 'detached-1' },
});
```

### `detach_tab_to_window`

```typescript
// Rust シグネチャ: pub async fn detach_tab_to_window(app: AppHandle, ...) -> Result<String, String>
const newWindowLabel = await invoke<string>('detach_tab_to_window', {
  sourceWindowLabel: 'main',
  filePath: '/path/to/file.md',
  fileName: 'file.md',
  content: '# Hello',
  encoding: 'UTF-8',
  lineEnding: 'LF',
  fileType: 'markdown',
});
// 戻り値: 新しいウィンドウの label（例: "detached-1"）
```

---

## 10. エラー型定義

Rust 側のコマンドはエラーを `String` で返す。フロントエンドでは以下のパターンでコードとメッセージを分離する。

```typescript
// src/utils/tauri-error.ts

export class TauriCommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'TauriCommandError';
  }
}

/**
 * Tauri コマンドエラー文字列を構造化エラーにパースする。
 * Rust 側が "ERROR_CODE: message\ndetail..." 形式で返すことを前提とする。
 */
export function parseTauriError(rawError: unknown): TauriCommandError {
  const raw = String(rawError);
  const colonIndex = raw.indexOf(':');
  if (colonIndex > 0) {
    const code = raw.slice(0, colonIndex).trim();
    const rest = raw.slice(colonIndex + 1).trim();
    const [message, ...detailLines] = rest.split('\n');
    return new TauriCommandError(code, message, detailLines.join('\n') || undefined);
  }
  return new TauriCommandError('UNKNOWN_ERROR', raw);
}

/**
 * invoke() のラッパー。エラーを TauriCommandError に変換する。
 */
export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (err) {
    throw parseTauriError(err);
  }
}
```

---

## コマンド追加ガイドライン

新しい Tauri コマンドを追加する際の手順:

1. **このドキュメントに型定義を追記する**（TypeScript 型 + Rust シグネチャコメント）
2. `src-tauri/src/commands/` に Rust 実装を追加する
3. `src-tauri/src/lib.rs` の `invoke_handler` に登録する
4. TypeScript 側で `tauriInvoke<T>()` を使って呼び出す
5. `testing-strategy-design.md` の Tauri コマンドテスト計画に追記する（必要であれば）

---

## 関連ドキュメント

- [system-design.md](./system-design.md) — システム全体アーキテクチャ・Rust バックエンド構成
- [security-design.md](./security-design.md) — Capabilities・CSP・invoke の権限設計
- [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) — ファイル操作設計
- [image-design.md](../05_Features/Image/image-design.md) — 画像保存・キャッシュ設計
- [metadata-query-design.md](../05_Features/metadata-query-design.md) — SQLite クエリ設計
- [plugin-api-design.md](./plugin-api-design.md) — プラグイン管理

---

*このドキュメントは実装が進むにつれてコマンドを追加・更新する。型の変更は必ずこのドキュメントへの更新と同時に行うこと。*
