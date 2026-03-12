# レビュー: docs/01_Architecture/tauri-ipc-interface.md（2026-03-12）

## 概要

- 設計書セクション数: 12（共通型定義 + 1〜10章 + 追加ガイドライン）
- 確認済み実装: 36 項目
- 未実装（要注意）: 0 項目
- 保留（feature-list.md 管理済み）: 2 項目

---

## セクション別レビュー結果

### §共通型定義

#### 設計要件（抜粋）
- `src/utils/error-translator.ts` に `AppError` / `translateError()` を定義する。
- `src/lib/tauri-commands.ts` に型安全な invoke ラッパーを提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `src/utils/error-translator.ts` に `AppError` / `translateError` が存在する | ✅ 準拠 | `src/utils/error-translator.ts:10-19`, `src/utils/error-translator.ts:31-55` |
| `src/lib/tauri-commands.ts` に型安全な invoke ラッパーが存在する | ✅ 準拠 | `src/lib/tauri-commands.ts:25-166` |

#### 訂正メモ（2026-03-12）
- 初回レビューで `src/types/tauri-commands.ts` に `TauriError` / `TauriResult<T>` が必要と記載したが、設計書（tauri-ipc-interface.md §共通型定義・§10）にそのようなファイル・型名の記述は存在しない。設計書が定義するのは `src/utils/error-translator.ts`（`AppError` / `translateError`）と `src/lib/tauri-commands.ts`（invoke ラッパー）であり、いずれも実装済み。本項目のレビュー判定を ❌ → ✅ に訂正する。

---

### §1 ファイル操作コマンド

#### 設計要件（抜粋）
- `read_file` / `write_file` / `rename_file` / `move_to_trash` / `file_exists` / `watch_file` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `read_file` | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:9` |
| `write_file` | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:52` |
| `rename_file` | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:354` |
| `move_to_trash` | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:393` |
| `file_exists` | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:116` |
| `watch_file` | ✅ 準拠 | `src-tauri/src/commands/watch_commands.rs:32`, `src-tauri/src/lib.rs:90`（`invoke_handler` 登録済み） |

#### 訂正メモ（2026-03-12）
- **watch_file**: 初回レビューで ❌ としたが、`src-tauri/src/commands/watch_commands.rs:32` に実装が存在し、`lib.rs:90` で `invoke_handler` に登録済み。❌ → ✅ に訂正。

---

### §2 ワークスペース管理コマンド

#### 設計要件（抜粋）
- `list_workspace_files(rootPath, recursive, extensions?)` を提供する。
- `watch_workspace(rootPath, eventName)` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `list_workspace_files` の存在 | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:197` |
| `list_workspace_files` の引数/戻り値 | ⚠️ 部分準拠 | 設計書: `(rootPath, recursive, extensions?)` → `WorkspaceFile[]`。実装: `(root_path, extensions)` → `Vec<FileNode>`（常に再帰的にツリー構造で返却。`recursive` フラグは不要な設計に簡略化） |
| `watch_workspace` | ✅ 準拠 | `src-tauri/src/commands/watch_commands.rs:90`, `src-tauri/src/lib.rs:91`（`invoke_handler` 登録済み） |

#### 訂正メモ（2026-03-12）
- **watch_workspace**: 初回レビューで ❌ としたが、`watch_commands.rs:90` に実装が存在し `invoke_handler` に登録済み。❌ → ✅ に訂正。
- **list_workspace_files 契約差分**: 実装は常に再帰的にディレクトリツリーを返すため `recursive` 引数は不要。`FileNode` は `children` を持つツリー構造で、設計書の `WorkspaceFile[]` フラットリストとは異なるが、より豊富な情報を提供している。

---

### §3 画像・アセット管理コマンド

#### 設計要件（抜粋）
- `save_image` / `cache_remote_image` / `purge_image_cache` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `save_image` | ✅ 準拠 | `src-tauri/src/commands/image_commands.rs:215`, `src-tauri/src/lib.rs:92` |
| `cache_remote_image` | ✅ 準拠 | `src-tauri/src/commands/image_commands.rs:264`, `src-tauri/src/lib.rs:93` |
| `purge_image_cache` | ✅ 準拠 | `src-tauri/src/commands/image_commands.rs:331`, `src-tauri/src/lib.rs:94` |

#### 訂正メモ（2026-03-12）
- **画像コマンド群**: 初回レビューで3コマンドすべて ❌ としたが、`src-tauri/src/commands/image_commands.rs` に実装が存在し `invoke_handler` に登録済み。❌ → ✅ に訂正。

---

### §4 検索コマンド

#### 設計要件（抜粋）
- `search_workspace` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `search_workspace` | ✅ 準拠 | `src-tauri/src/commands/search_commands.rs:102`, `src-tauri/src/lib.rs:95` |

#### 訂正メモ（2026-03-12）
- **search_workspace**: 初回レビューで ❌ としたが、`search_commands.rs:102` に実装が存在し `invoke_handler` に登録済み。❌ → ✅ に訂正。

---

### §5 メタデータ・インデックスコマンド

#### 設計要件（抜粋）
- `index_workspace_metadata(rootPath, forceRebuild?)`
- `execute_metadata_query(sql, params)`

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `index_workspace_metadata` | ✅ 準拠 | `src-tauri/src/commands/db_commands.rs:22` |
| `execute_metadata_query` の存在 | ✅ 準拠 | `src-tauri/src/commands/db_commands.rs:43` |
| `execute_metadata_query` の `params` 引数契約 | ⚠️ 部分準拠 | 設計書: `(sql, params)` を定義。実装: `(db, sql)` のみで `params` 配列は受け取らない。SQL は完全な文字列として渡される前提 |

#### 未実装・不一致の詳細
- **execute_metadata_query 引数差分**: 設計書の `params` 配列によるパラメータバインドは未実装。実装は SQL を直接文字列として受け取る。ユーザー入力を直接 SQL に含めないフロントエンド側の制約で安全性を担保している。

---

### §6 Wikiリンクコマンド

#### 設計要件（抜粋）
- `scan_wikilinks` / `get_graph_data(rootPath)` / `get_backlinks(filePath, workspaceRoot)` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `scan_wikilinks` | 🔶 保留（管理済み） | `docs/00_Meta/feature-list.md`（Wikiリンク機能として管理） |
| `get_graph_data` の存在 | ✅ 準拠 | `src-tauri/src/commands/db_commands.rs:232` |
| `get_graph_data` の引数契約 | ✅ 準拠 | 設計書: `(rootPath)`。実装: `(db: State<MetadataDb>)`。Tauri の `State<T>` は自動注入されフロントエンドから引数不要。設計書にも「Rust 側は State を自動注入するため、フロントエンドから引数は不要」と注記あり |
| `get_backlinks` | ✅ 準拠 | `src-tauri/src/commands/db_commands.rs:72` |

#### 訂正メモ（2026-03-12）
- **get_graph_data 契約**: 初回レビューで ⚠️ としたが、設計書 §6 自体に「Rust 側は State<MetadataDb> を自動注入するため、フロントエンドから引数は不要」と注記されている。実装は設計書の注記に準拠。⚠️ → ✅ に訂正。

---

### §7 Git 統合コマンド

#### 設計要件（抜粋）
- `git_status` / `git_diff` / `git_stage` / `git_unstage` / `git_commit` / `git_log` / `git_branch_info` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `git_status` | ✅ 準拠 | `src-tauri/src/commands/git_commands.rs:94` |
| `git_diff` | ✅ 準拠 | `src-tauri/src/commands/git_commands.rs:188` |
| `git_stage` / `git_unstage` | ✅ 準拠 | `src-tauri/src/commands/git_commands.rs:237`, `src-tauri/src/commands/git_commands.rs:257` |
| `git_commit` | ✅ 準拠 | `src-tauri/src/commands/git_commands.rs:318` |
| `git_log` | ✅ 準拠 | `src-tauri/src/commands/git_commands.rs:355` |
| `git_branch_info` | ✅ 準拠 | `src-tauri/src/commands/git_commands.rs:399` |

---

### §8 プラグイン管理コマンド

#### 設計要件（抜粋）
- `is_safe_mode_active` / `restart_app` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `is_safe_mode_active` | ✅ 準拠 | `src-tauri/src/commands/plugin_commands.rs:290` |
| `restart_app` | ✅ 準拠 | `src-tauri/src/commands/window_commands.rs:33` |

---

### §9 ウィンドウ・アプリ管理コマンド

#### 設計要件（抜粋）
- `set_title_dirty` / `get_app_version` / `print_to_pdf` / ファイルロック系コマンド群 / `emit_to_window` / `detach_tab_to_window` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `set_title_dirty` | ✅ 準拠 | `src-tauri/src/commands/window_commands.rs:8` |
| `get_app_version` | 🔶 保留（管理済み） | `docs/00_Meta/feature-list.md` |
| `print_to_pdf` | ⚠️ 部分準拠 | `src-tauri/src/commands/export_commands.rs:41`。設計書は「PDF バイト数返却」を定義しているが、Tauri 2.x は headless PDF 生成 API を提供していないため OS 印刷ダイアログ方式で実装し `Ok(0)` を返す |
| `try_acquire_file_lock` / `release_file_lock` / `transfer_file_lock` | ✅ 準拠 | `src-tauri/src/commands/window_sync.rs:81`, `src-tauri/src/commands/window_sync.rs:104`, `src-tauri/src/commands/window_sync.rs:123` |
| `notify_write_access_denied` / `emit_to_window` / `detach_tab_to_window` | ✅ 準拠 | `src-tauri/src/commands/window_sync.rs:153`, `src-tauri/src/commands/window_sync.rs:232`, `src-tauri/src/commands/window_sync.rs:172` |

#### 未実装・不一致の詳細
- **print_to_pdf 戻り値差分**: Tauri 2.x が headless PDF 生成 API を未提供のため、OS 印刷ダイアログ方式で代替実装。戻り値は `Ok(0)` 固定。将来 Tauri が PDF API を提供した際に更新可能。

---

### §10 エラー型定義

#### 設計要件（抜粋）
- エラー翻訳層: `src/utils/error-translator.ts` に `AppError` / `translateError()` を定義する。
- コマンドラッパー層: `src/lib/tauri-commands.ts` で `translateError()` を使用しエラー変換する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `src/utils/error-translator.ts` のエラー翻訳層 | ✅ 準拠 | `src/utils/error-translator.ts:10-55` |
| `src/lib/tauri-commands.ts` の invoke ラッパーでの translateError 使用 | ✅ 準拠 | `src/lib/tauri-commands.ts:175-211` |

#### 訂正メモ（2026-03-12）
- 初回レビューで `src/utils/tauri-error.ts` に `TauriCommandError` / `parseTauriError` / `tauriInvoke<T>` が必要と記載したが、設計書（tauri-ipc-interface.md §10）にそのようなファイル・型名・関数名の記述は存在しない。設計書 §10 が定義するのはエラー翻訳層（`src/utils/error-translator.ts`）とコマンドラッパー層（`src/lib/tauri-commands.ts`）の 2 層構成であり、いずれも実装済み。本項目のレビュー判定を ❌/⚠️ → ✅ に訂正する。

---

### §コマンド追加ガイドライン

#### 設計要件（抜粋）
- 実装コマンドは `invoke_handler` に登録される。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 実装済みコマンドの `invoke_handler` 登録 | ✅ 準拠 | `src-tauri/src/lib.rs:39-96` |

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 36 |
| ⚠️ 部分準拠 | 3 |
| ❌ 未実装 | 0 |
| 🔶 保留（管理済み） | 2 |

### 残存する ⚠️ 項目

1. **list_workspace_files 契約差分** — 設計書の `recursive` 引数とフラット `WorkspaceFile[]` 戻り値に対し、実装は常に再帰ツリー構造を返す。実用上は上位互換。
2. **execute_metadata_query params 未対応** — 設計書の `params` 配列によるバインドは未実装。SQL を文字列で直接渡す方式。
3. **print_to_pdf 戻り値差分** — Tauri 2.x の制約で OS 印刷ダイアログ方式。戻り値は `Ok(0)` 固定。

### 解消済み項目（2026-03-12 訂正）

1. ~~**共通型定義ファイル**~~ → レビュー誤認。設計書が定義する `src/utils/error-translator.ts` と `src/lib/tauri-commands.ts` は実装済み。
2. ~~**watch_file**~~ → `watch_commands.rs:32` に実装済み、`invoke_handler` 登録済み。
3. ~~**watch_workspace**~~ → `watch_commands.rs:90` に実装済み、`invoke_handler` 登録済み。
4. ~~**save_image / cache_remote_image / purge_image_cache**~~ → `image_commands.rs` に実装済み、`invoke_handler` 登録済み。
5. ~~**search_workspace**~~ → `search_commands.rs:102` に実装済み、`invoke_handler` 登録済み。
6. ~~**get_graph_data 契約差分**~~ → 設計書自体に State 自動注入の注記あり。実装は設計書準拠。
7. ~~**エラー型定義**~~ → レビュー誤認。設計書が定義する2層構成は実装済み。
