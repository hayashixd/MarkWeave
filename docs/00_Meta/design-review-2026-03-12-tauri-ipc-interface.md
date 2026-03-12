# レビュー: docs/01_Architecture/tauri-ipc-interface.md（2026-03-12）

## 概要

- 設計書セクション数: 12（共通型定義 + 1〜10章 + 追加ガイドライン）
- 確認済み実装: 26 項目
- 未実装（要注意）: 8 項目
- 保留（feature-list.md 管理済み）: 2 項目

---

## セクション別レビュー結果

### §共通型定義

#### 設計要件（抜粋）
- `src/types/tauri-commands.ts` に `TauriError` / `TauriResult<T>` を定義する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `src/types/tauri-commands.ts` に共通型が存在する | ❌ 未実装 | （該当ファイル未確認） |

#### 未実装・不一致の詳細
- **共通型定義ファイル**: 設計書では `src/types/tauri-commands.ts` を定義先としているが、実装側に同名ファイルが存在しない。

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
| `watch_file` | ❌ 未実装 | （コマンド実装未確認） |

#### 未実装・不一致の詳細
- **watch_file**: 設計書の必須コマンド定義はあるが、`src-tauri/src/commands/` 配下に該当コマンドを確認できない。

---

### §2 ワークスペース管理コマンド

#### 設計要件（抜粋）
- `list_workspace_files(rootPath, recursive, extensions?)` を提供する。
- `watch_workspace(rootPath, eventName)` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `list_workspace_files` の存在 | ⚠️ 部分準拠 | `src-tauri/src/commands/fs_commands.rs:175` |
| `list_workspace_files` の引数/戻り値契約一致 | ⚠️ 部分準拠 | `docs/01_Architecture/tauri-ipc-interface.md`（§2定義） / `src-tauri/src/commands/fs_commands.rs:175` |
| `watch_workspace` | ❌ 未実装 | （コマンド実装未確認） |

#### 未実装・不一致の詳細
- **list_workspace_files 契約差分**: 設計書は `recursive` 引数と `WorkspaceFile[]` を定義しているが、実装は `root_path, extensions` を受け取り `FileNode` ツリーを返す。
- **watch_workspace**: 設計書定義のコマンドを確認できない。

---

### §3 画像・アセット管理コマンド

#### 設計要件（抜粋）
- `save_image` / `cache_remote_image` / `purge_image_cache` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `save_image` | ❌ 未実装 | （コマンド実装未確認） |
| `cache_remote_image` | ❌ 未実装 | （コマンド実装未確認） |
| `purge_image_cache` | ❌ 未実装 | （コマンド実装未確認） |

#### 未実装・不一致の詳細
- **画像コマンド群**: 設計書で定義された3コマンドを `src-tauri/src/commands/` 配下で確認できない。

---

### §4 検索コマンド

#### 設計要件（抜粋）
- `search_workspace` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `search_workspace` | ❌ 未実装 | （コマンド実装未確認） |

#### 未実装・不一致の詳細
- **search_workspace**: 設計書必須コマンドを実装側で確認できない。

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
| `execute_metadata_query` の `params` 引数契約 | ⚠️ 部分準拠 | `docs/01_Architecture/tauri-ipc-interface.md`（§5定義） / `src-tauri/src/commands/db_commands.rs:43` |

#### 未実装・不一致の詳細
- **execute_metadata_query 引数差分**: 設計書は `params` 配列を定義しているが、実装は `sql` のみを受け取る。

---

### §6 Wikiリンクコマンド

#### 設計要件（抜粋）
- `scan_wikilinks` / `get_graph_data(rootPath)` / `get_backlinks(filePath, workspaceRoot)` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `scan_wikilinks` | 🔶 保留（管理済み） | `docs/00_Meta/feature-list.md:873`, `docs/00_Meta/feature-list.md:893` |
| `get_graph_data` の存在 | ✅ 準拠 | `src-tauri/src/commands/db_commands.rs:232` |
| `get_graph_data` の引数契約一致 | ⚠️ 部分準拠 | `docs/01_Architecture/tauri-ipc-interface.md`（§6定義） / `src-tauri/src/commands/db_commands.rs:232` |
| `get_backlinks` | ✅ 準拠 | `src-tauri/src/commands/db_commands.rs:72` |

#### 未実装・不一致の詳細
- **scan_wikilinks**: 設計書上の必須コマンドだが実装名としては未確認。`feature-list` で設計書全体が `🔶` 管理されているため保留扱い。
- **get_graph_data 契約差分**: 設計書は `rootPath` 引数を定義しているが、実装は DB State を引数に持つ構成。

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

#### 未実装・不一致の詳細
- 該当なし。

---

### §8 プラグイン管理コマンド

#### 設計要件（抜粋）
- `is_safe_mode_active` / `restart_app` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `is_safe_mode_active` | ✅ 準拠 | `src-tauri/src/commands/plugin_commands.rs:290` |
| `restart_app` | ✅ 準拠 | `src-tauri/src/commands/window_commands.rs:33` |

#### 未実装・不一致の詳細
- 該当なし。

---

### §9 ウィンドウ・アプリ管理コマンド

#### 設計要件（抜粋）
- `set_title_dirty` / `get_app_version` / `print_to_pdf` / ファイルロック系コマンド群 / `emit_to_window` / `detach_tab_to_window` を提供する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `set_title_dirty` | ✅ 準拠 | `src-tauri/src/commands/window_commands.rs:8` |
| `get_app_version` | 🔶 保留（管理済み） | `docs/00_Meta/feature-list.md:873` |
| `print_to_pdf` | ⚠️ 部分準拠 | `src-tauri/src/commands/export_commands.rs:41` |
| `try_acquire_file_lock` / `release_file_lock` / `transfer_file_lock` | ✅ 準拠 | `src-tauri/src/commands/window_sync.rs:81`, `src-tauri/src/commands/window_sync.rs:104`, `src-tauri/src/commands/window_sync.rs:123` |
| `notify_write_access_denied` / `emit_to_window` / `detach_tab_to_window` | ✅ 準拠 | `src-tauri/src/commands/window_sync.rs:153`, `src-tauri/src/commands/window_sync.rs:232`, `src-tauri/src/commands/window_sync.rs:172` |

#### 未実装・不一致の詳細
- **get_app_version**: 設計書定義コマンドは未確認。`tauri-ipc-interface` 全体が `feature-list` で `🔶` 管理されているため保留扱い。
- **print_to_pdf 戻り値差分**: 設計書は「PDF バイト数返却」を定義しているが、実装は印刷ダイアログ方式で `Ok(0)` を返す。

---

### §10 エラー型定義

#### 設計要件（抜粋）
- `src/utils/tauri-error.ts` に `TauriCommandError` / `parseTauriError` / `tauriInvoke<T>` を定義する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `src/utils/tauri-error.ts` の存在 | ❌ 未実装 | （該当ファイル未確認） |
| 代替のエラー翻訳層 | ⚠️ 部分準拠 | `src/lib/tauri-commands.ts:1` |

#### 未実装・不一致の詳細
- **tauri-error.ts**: 設計書指定ファイル/型/関数を確認できない。
- **エラー変換契約差分**: 実装は `translateError` による変換を行うが、設計書で定義された `TauriCommandError` クラス体系とは一致しない。

---

### §コマンド追加ガイドライン

#### 設計要件（抜粋）
- 実装コマンドは `invoke_handler` に登録される。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 実装済みコマンドの `invoke_handler` 登録 | ✅ 準拠 | `src-tauri/src/lib.rs:39` |

#### 未実装・不一致の詳細
- 該当なし。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 26 |
| ⚠️ 部分準拠 | 6 |
| ❌ 未実装 | 8 |
| 🔶 保留（管理済み） | 2 |

### 主要な未実装・不一致（❌ / ⚠️ のみ列挙）

1. **共通型定義ファイル** — `src/types/tauri-commands.ts` の `TauriError` / `TauriResult` を確認できない。
2. **ファイル監視コマンド** — `watch_file` が未実装。
3. **ワークスペース監視コマンド** — `watch_workspace` が未実装。
4. **画像系コマンド** — `save_image` / `cache_remote_image` / `purge_image_cache` が未実装。
5. **検索コマンド** — `search_workspace` が未実装。
6. **契約差分（workspace/metadata/wiki/pdf/error）** — 引数・戻り値または型体系が設計書定義と一致しない箇所を確認。
