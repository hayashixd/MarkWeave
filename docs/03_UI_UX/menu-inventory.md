# ネイティブメニューバー一覧（SoT）

> このファイルはアプリケーションのネイティブメニューバーの **Single Source of Truth** です。
> 新しい機能をメニューに追加する際は、このファイルを先に更新してから実装してください。
>
> 実装ソース: `src-tauri/src/menu/native_menu.rs`
> フロントエンド受信: `src/hooks/useMenuListener.ts` → `src/components/layout/AppShell.tsx`
> エディタ内機能: `src/components/editor/TipTapEditor.tsx`（カスタムイベント経由）

---

## 凡例

| 列 | 説明 |
|----|------|
| メニューアイテム | メニューに表示されるラベル |
| ID | `native_menu.rs` の `ids::*` 定数 / `useMenuListener` のキー |
| ショートカット | アクセラレータキー（`—` = なし） |
| feature-list.md 対応 | 該当する feature-list.md の機能名（`—` = OS 標準機能等） |
| 実装先 | アクションの処理場所 |

---

## ファイル (ファイル)

| メニューアイテム | ID | ショートカット | feature-list.md 対応 | 実装先 |
|---|---|---|---|---|
| 新規ファイル | `file_new` | Ctrl+N | タブ追加 | AppShell |
| 開く... | `file_open` | Ctrl+O | ファイルを開く | AppShell |
| フォルダを開く... | `file_open_folder` | Ctrl+Shift+O | フォルダを開く | AppShell |
| 最近使ったファイル... | `file_recent_files` | — | 最近使ったファイル | AppShell → Sidebar |
| 最近のワークスペース... | `file_recent_workspaces` | — | ワークスペース切り替え | AppShell → Sidebar |
| ─ セパレータ ─ | | | | |
| 保存 | `file_save` | Ctrl+S | ファイル保存 | AppShell |
| 名前を付けて保存... | `file_save_as` | Ctrl+Shift+S | 名前を付けて保存 | AppShell |
| ─ セパレータ ─ | | | | |
| **エクスポート ▶** | | | | |
| 　HTML にエクスポート... | `file_export_html` | Ctrl+Shift+E | HTML エクスポート | AppShell → ExportDialog |
| 　PDF にエクスポート... | `file_export_pdf` | Ctrl+Alt+P | PDF エクスポート | AppShell → PdfExportDialog |
| 　─ セパレータ ─ | | | | |
| 　Word (.docx) にエクスポート... | `file_export_word` | Ctrl+Alt+W | Pandoc 統合 | AppShell → PandocExportDialog |
| 　LaTeX にエクスポート... | `file_export_latex` | — | Pandoc 統合 | AppShell → PandocExportDialog |
| 　ePub にエクスポート... | `file_export_epub` | — | Pandoc 統合 | AppShell → PandocExportDialog |
| **別名で保存 ▶** | | | | |
| 　Markdown として保存... | `file_save_as_md` | Ctrl+Shift+M | Markdown として保存 | AppShell → ConversionDialog |
| 　HTML として保存... | `file_save_as_html` | Ctrl+Shift+H | HTML として保存 | AppShell → ConversionDialog |
| ─ セパレータ ─ | | | | |
| テンプレートから新規作成... | `file_template_new` | — | テンプレートからページ作成 | CustomEvent → TBD |
| デイリーノート作成 | `file_daily_note` | Ctrl+Alt+D | デイリーノート | AppShell |
| ─ セパレータ ─ | | | | |
| 印刷... | `file_print` | Ctrl+P | — | AppShell → window.print() |
| ─ セパレータ ─ | | | | |
| アプリを終了 | *(PredefinedMenuItem)* | Alt+F4 / Cmd+Q | — | Tauri OS 標準 |

---

## 編集 (編集)

| メニューアイテム | ID | ショートカット | feature-list.md 対応 | 実装先 |
|---|---|---|---|---|
| 元に戻す | *(PredefinedMenuItem)* | Ctrl+Z | — | OS 標準 |
| やり直す | *(PredefinedMenuItem)* | Ctrl+Shift+Z | — | OS 標準 |
| ─ セパレータ ─ | | | | |
| 切り取り | *(PredefinedMenuItem)* | Ctrl+X | — | OS 標準 |
| コピー | *(PredefinedMenuItem)* | Ctrl+C | — | OS 標準 |
| 貼り付け | *(PredefinedMenuItem)* | Ctrl+V | — | OS 標準 |
| プレーンテキストとして貼り付け | `edit_paste_plain` | Ctrl+Shift+V | プレーンテキスト貼り付け | CustomEvent → TipTapEditor |
| ─ セパレータ ─ | | | | |
| すべて選択 | *(PredefinedMenuItem)* | Ctrl+A | — | OS 標準 |
| ─ セパレータ ─ | | | | |
| 検索... | `edit_find` | Ctrl+F | 検索バー | CustomEvent → TipTapEditor |
| 検索と置換... | `edit_find_replace` | Ctrl+H | 検索と置換 | CustomEvent → TipTapEditor |
| ─ セパレータ ─ | | | | |
| 文書統計... | `edit_text_stats` | — | 文書統計ダイアログ | CustomEvent → TipTapEditor |
| ─ セパレータ ─ | | | | |
| 設定... | `edit_preferences` | Ctrl+, | プリファレンスダイアログ | AppShell |

---

## 表示 (表示)

| メニューアイテム | ID | ショートカット | feature-list.md 対応 | 実装先 |
|---|---|---|---|---|
| **エディタモード ▶** | | | | |
| 　WYSIWYG モード | `view_mode_wysiwyg` | — | エディタモード切替 | CustomEvent → TipTapEditor |
| 　ソース表示 | `view_mode_source` | — | エディタモード切替 | CustomEvent → TipTapEditor |
| ─ セパレータ ─ | | | | |
| サイドバーの表示/非表示 | `view_sidebar_toggle` | Ctrl+Shift+L | サイドバー | AppShell |
| アウトラインパネル | `view_outline` | Ctrl+Shift+1 | アウトラインパネル | AppShell |
| ファイルパネル | `view_files` | Ctrl+Shift+2 | ファイルリスト | AppShell |
| AI テンプレート | `view_ai_templates` | Ctrl+Shift+3 | AI テンプレート | AppShell |
| バックリンク | `view_backlinks` | Ctrl+Shift+4 | バックリンクパネル | AppShell |
| タグビュー | `view_tags` | Ctrl+Shift+5 | タグビュー | AppShell |
| Git パネル | `view_git` | Ctrl+Shift+7 | Git パネル | AppShell |
| ─ セパレータ ─ | | | | |
| フローティング目次 | `view_floating_toc` | Ctrl+Shift+T | フローティング TOC パネル | AppShell |
| ペイン分割 | `view_split_pane` | Ctrl+\\ | SplitEditorLayout | AppShell |
| ─ セパレータ ─ | | | | |
| フォーカスモード | `view_focus_mode` | F8 | フォーカスモード | AppShell → settings |
| タイプライターモード | `view_typewriter_mode` | F9 | タイプライターモード | AppShell → settings |
| Zen モード | `view_zen_mode` | F11 | Zen モード | AppShell → settings |
| ─ セパレータ ─ | | | | |
| 実際のサイズ | `view_zoom_reset` | Ctrl+0 | — | CustomEvent → TipTapEditor |
| 拡大 | `view_zoom_in` | Ctrl+= | — | CustomEvent → TipTapEditor |
| 縮小 | `view_zoom_out` | Ctrl+- | — | CustomEvent → TipTapEditor |

---

## ヘルプ (ヘルプ)

| メニューアイテム | ID | ショートカット | feature-list.md 対応 | 実装先 |
|---|---|---|---|---|
| キーボードショートカット一覧 | `help_shortcuts` | — | — | CustomEvent |
| ─ セパレータ ─ | | | | |
| バージョン情報 | *(PredefinedMenuItem)* | — | — | Tauri OS 標準 |
| フィードバックを送る... | `help_feedback` | — | — | CustomEvent |

---

## メニュー追加チェックリスト

新しい機能をメニューに追加する際は、以下の手順を必ず実行してください。

### 1. このファイルを更新
- [ ] 該当するメニューカテゴリのテーブルに行を追加
- [ ] ID・ショートカット・feature-list.md 対応・実装先を記入

### 2. Rust 側を実装
- [ ] `src-tauri/src/menu/native_menu.rs` の `mod ids` に新しい ID 定数を追加
- [ ] `build_menu()` 内の該当サブメニューに `.item()` を追加

### 3. フロントエンド側を実装
- [ ] `src/hooks/useMenuListener.ts` の `MenuActions` インターフェースに新キーを追加
- [ ] `src/components/layout/AppShell.tsx` の `useMenuListener({...})` にハンドラを追加
- [ ] エディタ内機能の場合: `TipTapEditor.tsx` にカスタムイベントリスナーを追加

### 4. feature-list.md を更新
- [ ] `docs/00_Meta/feature-list.md` の該当機能カテゴリの「操作方法」列にメニューパス（例: `メニュー → ファイル → エクスポート → HTML`）を記載

---

## 関連ドキュメント

- [app-shell-design.md §2](./app-shell-design.md) — メニューバー設計仕様
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — キーボードショートカット定義
- [feature-list.md](../00_Meta/feature-list.md) — 機能一覧・実装状態
