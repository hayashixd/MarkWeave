# 総合機能一覧・開発ロードマップ・設計網羅度・実装ログ

> **本ドキュメントは以下の 4 ファイルを統合した Single Source of Truth（SoT）です。**
> - 旧 `roadmap.md` — フェーズ別実装タスクリスト
> - 旧 `design-coverage.md` — 設計検討済み項目一覧
> - 旧 `feature-list.md` — 設計書↔機能↔実装進捗対応表
> - 旧 `IMPLEMENTATION_LOG.md` — 実装進捗ログ
>
> 更新日: 2026-03-08

---

## 凡例

| 記号 | 意味 |
|------|------|
| ✅ | 実装済み（ソースコード確認済み） |
| 🔶 | 一部実装（主要機能は実装済みだが後続タスクが残存） |
| ❌ | 未実装 |

---

## Phase 1: MVP（最小実用製品）

基本的なWYSIWYG編集が動作する状態。**全タスク実装完了。**

### セットアップ

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| プロジェクト初期化 | Vite + React + TypeScript による SPA 基盤 | `npm run dev` で開発サーバー起動 | ✅ |
| ESLint / Prettier | コード品質・フォーマット統一 | コミット時に自動実行 | ✅ |
| Vitest テスト環境 | ユニットテスト基盤 | `npm run test` | ✅ |
| Playwright E2E テスト | エンドツーエンドテスト基盤 | `npm run test:e2e` | ✅ |
| Tauri 2.0 プロジェクト | Rust バックエンド（`src-tauri/`） | `npm run tauri dev` でネイティブアプリ起動 | ✅ |
| Tauri Capabilities | `capabilities/default.json` による権限制御 | 自動適用 | ✅ |
| CSP 設定 | `script-src 'self'`, `connect-src 'none'` | `tauri.conf.json` で定義 | ✅ |

### コア機能

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| TipTap エディタ基盤 | ProseMirror ベースの WYSIWYG エディタコア | アプリ起動時に自動ロード（`src/components/editor/`） | ✅ |
| Markdown パーサ | remark + remark-gfm による MD → TipTap JSON 変換 | `src/lib/markdown-to-tiptap.ts` | ✅ |
| AST シリアライザ | remark-stringify による TipTap JSON → MD 変換 | `src/lib/tiptap-to-markdown.ts` | ✅ |
| ファイル読み書き | Tauri plugin-fs + Rust コマンドによるファイル I/O | `Ctrl+O`（開く）/ `Ctrl+S`（保存） | ✅ |
| Zustand ストア | `settingsStore`, `tabStore` 等のクライアント状態管理 | `src/store/` 以下に 13 ストア | ✅ |

### ファイル管理基本機能

詳細設計: [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §9, §15

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| ファイルを開くダイアログ | OS ネイティブのファイル選択 | `Ctrl+O` | ✅ |
| 名前を付けて保存 | 保存先を指定して保存 | `Ctrl+Shift+S` / 新規ファイルの `Ctrl+S` | ✅ |
| ドラッグ&ドロップ | ファイルをウィンドウにドロップして開く | ファイルをエディタ領域にドラッグ | ✅ |

### ユーザー設定

詳細設計: [user-settings-design.md](../07_Platform_Settings/user-settings-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| AppSettings 型定義 | 設定スキーマと DEFAULT_SETTINGS | `src/settings/types.ts`, `src/settings/defaults.ts` | ✅ |
| settingsStore | Zustand + plugin-store による設定永続化 | `src/store/settingsStore.ts` | ✅ |
| プリファレンスダイアログ | 外観・エディタ・執筆・プラグインの 4 タブ設定 UI | メニュー → 設定、または `Ctrl+,` | ✅ |
| 設定マイグレーション | バージョン間の設定スキーマ移行 | `src/settings/migrate.ts`（起動時自動実行） | ✅ |

### スマートペースト

詳細設計: [smart-paste-design.md](../06_Export_Interop/smart-paste-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| htmlToMarkdown() | turndown + DOMPurify による HTML → MD 変換 | クリップボードからの貼り付け時に自動適用 | ✅ |
| SmartPasteExtension | TipTap プラグインとして統合 | `src/extensions/SmartPasteExtension.ts` | ✅ |
| プレーンテキスト貼り付け | 書式なし貼り付け | `Ctrl+Shift+V` | ✅ |

### エラーハンドリング・診断ログ

詳細設計: [error-handling-design.md](../08_Testing_Quality/error-handling-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| tauri-plugin-log | Rust 側のログ出力基盤 | 自動（バックエンドログファイル出力） | ✅ |
| logger ユーティリティ | フロントエンド用ロガー | `src/utils/` 内で呼び出し | ✅ |
| AppErrorBoundary / EditorErrorBoundary | React エラー境界によるクラッシュ防止 | アプリ全体・エディタ領域に自動適用 | ✅ |
| toastStore | トースト通知の状態管理と表示 | `src/store/toastStore.ts` + `ToastContainer` | ✅ |
| Tauri コマンドエラー翻訳層 | Rust エラーをフロントエンド向けに変換 | `src-tauri/src/models/error.rs` | ✅ |
| パース失敗フォールバック | パース失敗時にソースモードで表示 | 自動（パースエラー検出時） | ✅ |

### タブ・セッション管理

詳細設計: [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| タブバー UI | タブの開閉・切り替え | `src/components/tabs/TabBar.tsx` | ✅ |
| タブストア | addTab / removeTab / updateContent / markSaved | `src/store/tabStore.ts` | ✅ |
| 未保存マーカー | タブタイトルとステータスバーに `●` 表示 | 未保存変更がある場合に自動表示 | ✅ |
| タイトルバー未保存反映 | Rust コマンド経由でウィンドウタイトルに反映 | 自動（保存状態変化時） | ✅ |
| 未保存確認ダイアログ | タブ・ウィンドウ閉じる時の保存確認 | タブの×ボタン / ウィンドウ閉じる時 | ✅ |
| ウィンドウクローズガード | `onCloseRequested` による未保存ガード | ウィンドウの×ボタン押下時 | ✅ |
| セッション保存・復元 | @tauri-apps/plugin-store によるタブ状態永続化 | 起動時に自動復元 | ✅ |
| ファイル関連付け | `.md` ファイルのダブルクリックで起動 | `tauri.conf.json` の `fileAssociations` | ✅ |
| シングルインスタンス | 二重起動防止 | `tauri-plugin-single-instance` | ✅ |
| 外部ファイルオープン | OS からのファイルオープンイベント受信 | `useFileOpenListener` フック | ✅ |

### WYSIWYG 要素

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| 見出し（H1〜H6） | 6 段階の見出し表示・編集 | `# ` 〜 `###### ` で自動変換 / `Ctrl+1`〜`6` | ✅ |
| 段落 | 基本テキストブロック | 通常入力 | ✅ |
| 太字 | テキストの太字装飾 | `Ctrl+B` / `**text**` | ✅ |
| 斜体 | テキストの斜体装飾 | `Ctrl+I` / `*text*` | ✅ |
| 取り消し線 | テキストの取り消し線 | `~~text~~` | ✅ |
| インラインコード | コードの等幅表示 | `` `code` `` | ✅ |
| リンク | ハイパーリンク | `Ctrl+K` でダイアログ / `[text](url)` | ✅ |
| 引用ブロック | 引用文の表示 | `> ` で自動変換 | ✅ |
| リスト（順序なし/あり） | 箇条書き・番号付きリスト | `- ` / `1. ` で自動変換 | ✅ |
| タスクリスト | チェックボックス付きリスト | `- [ ] ` で自動変換 | ✅ |
| コードブロック | シンタックスハイライト付きコード表示 | ` ``` ` で自動変換 / lowlight 統合済み | ✅ |
| 水平線 | 区切り線 | `---` で自動変換 | ✅ |
| ソースモード切替 | WYSIWYG ↔ Markdown ソース切替 | `Ctrl+/` | ✅ |

### オートフォーマット

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| 見出し変換 | `# ` → H1 等の自動変換 | 行頭で `# ` + スペース | ✅ |
| リスト変換 | `- ` → リスト自動変換 | 行頭で `- ` + スペース | ✅ |
| 引用変換 | `> ` → 引用ブロック変換 | 行頭で `> ` + スペース | ✅ |
| コードブロック変換 | ` ``` ` → コードブロック変換 | 行頭で ` ``` ` + Enter | ✅ |

### キーボードショートカット

詳細設計: [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| 太字 | テキスト太字化 | `Ctrl+B` | ✅ |
| 斜体 | テキスト斜体化 | `Ctrl+I` | ✅ |
| リンク挿入 | リンクダイアログ表示 | `Ctrl+K` | ✅ |
| Undo / Redo | 操作の取り消し・やり直し | `Ctrl+Z` / `Ctrl+Shift+Z` | ✅ |
| 保存 | ファイル保存 | `Ctrl+S` | ✅ |
| 見出しレベル | 見出しレベル設定 | `Ctrl+1` 〜 `Ctrl+6` | ✅ |

---

## Phase 2: テーブル編集

Excelライクなテーブル操作。**全タスク実装完了。**

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| テーブルレンダリング | GFM テーブルの WYSIWYG 表示 | MD のテーブル記法で自動表示 | ✅ |
| セル移動 | Tab / Shift+Tab でセル間移動 | テーブル内で `Tab` / `Shift+Tab` | ✅ |
| 新行追加 | 末尾セルで Tab → 新行挿入 | 最後のセルで `Tab` | ✅ |
| 行の追加・削除 | コンテキストメニューで行操作 | セル右クリック → 行操作 | ✅ |
| 列の追加・削除 | コンテキストメニューで列操作 | セル右クリック → 列操作 | ✅ |
| 行ドラッグ並び替え | 行の D&D 並び替え | 行ハンドルをドラッグ | ✅ |
| 列ドラッグ並び替え | 列の D&D 並び替え | 列ヘッダーをドラッグ | ✅ |
| 列幅リサイズ | 列の幅をドラッグで調整 | 列境界をドラッグ | ✅ |
| 列配置 | テキスト配置（左/中央/右） | コンテキストメニューから選択 | ✅ |
| テーブル GUI 挿入 | 行数・列数指定でテーブル作成 | ツールバーまたはスラッシュコマンド | ✅ |

---

## Phase 3: リッチ機能

**全タスク実装完了。**

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| 数式（KaTeX） | インライン・ブロック数式レンダリング | `$...$`（インライン）/ `$$...$$`（ブロック） | ✅ |
| Mermaid 図表 | フローチャート等の図表表示 | ` ```mermaid ` コードブロック | ✅ |
| 画像ドラッグ&ドロップ | 画像ファイルを D&D で挿入 | 画像ファイルをエディタにドラッグ | ✅ |
| クリップボード画像貼り付け | スクリーンショット等を貼り付け | `Ctrl+V`（画像コピー後） | ✅ |
| アウトラインパネル | 見出しナビゲーション | サイドバーの「アウトライン」タブ | ✅ |
| 検索 | ファイル内テキスト検索 | `Ctrl+F` | ✅ |
| 検索・置換 | テキスト検索＆置換 | `Ctrl+H` | ✅ |
| クイックオープン | ファイル名ファジー検索で開く | `Ctrl+P` | ✅ |
| 行番号ジャンプ | 指定行へ移動 | `Ctrl+G` | ✅ |
| 行ブックマーク | 行にブックマークを設置・ジャンプ | `Ctrl+F2`（設置）/ `F2`（次へ）/ `Shift+F2`（前へ） | ✅ |
| 矩形選択 | ソースモードでの矩形選択 | `Alt+ドラッグ`（ソースモード限定） | ✅ |
| 単語補完 | 文書内単語の自動補完 | `Ctrl+Space` | ✅ |
| テキスト整形コマンド | 空白除去・全角/半角変換・行ソート | メニュー → テキスト整形 | ✅ |
| 文字コード表示・再読み込み | UTF-8 / UTF-8 BOM / Shift-JIS 対応 | ステータスバーのエンコーディング表示クリック | ✅ |
| 改行コード切り替え | LF / CRLF の切り替え保存 | ステータスバーの改行コード表示クリック | ✅ |
| インデント設定 | タブ幅・タブ/スペース変換・自動インデント | 設定ダイアログ → エディタタブ | ✅ |
| 文書統計ダイアログ | 文字数・単語数・読了時間 | メニュー → 文書統計 | ✅ |

### ワークスペース管理

詳細設計: [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| フォルダを開く | ワークスペースとしてフォルダを開く | `Ctrl+Shift+O` | ✅ |
| ファイルツリーサイドバー | フォルダ構造のツリー表示 | サイドバーの「ファイル」タブ | ✅ |
| 外部ファイル変更検知 | 外部でのファイル変更を通知 | 自動（ファイルウォッチャーで検出） | ✅ |
| クロスファイルリンク | リンクをクリックして別ファイルを開く | `Ctrl+クリック` | ✅ |
| ファイル作成・削除・リネーム | ファイルツリーでの操作 | 右クリックコンテキストメニュー | ✅ |
| ワークスペースセッション保存 | ワークスペースの状態を永続化 | 終了時自動保存・起動時自動復元 | ✅ |

### スマートペースト拡張

詳細設計: [smart-paste-design.md](../06_Export_Interop/smart-paste-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| ask モード確認バー | ペースト方法の確認 UI | 設定で ask モード有効時に自動表示 | ✅ |
| 画像 data-URI 保存連携 | ペースト画像のファイル保存 | 画像ペースト時に自動処理 | ✅ |
| 数式 LaTeX カスタムルール | LaTeX 数式の Turndown 変換ルール | 数式含む HTML ペースト時に自動適用 | ✅ |

---

## Phase 4: MD → HTML エクスポート

**全タスク実装完了。**

詳細設計: [export-interop-design.md](../06_Export_Interop/export-interop-design.md)

### 変換パイプライン

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| remark-rehype 統合 | MD AST → HTML AST 変換 | エクスポート実行時に自動処理 | ✅ |
| rehype-highlight | コードのシンタックスハイライト | エクスポート HTML にハイライト CSS 埋め込み | ✅ |
| rehype-katex | 数式の HTML レンダリング | エクスポート HTML に KaTeX CSS 埋め込み | ✅ |
| rehype-stringify | HTML 文字列生成 | パイプライン最終段階 | ✅ |
| HTML テンプレートエンジン | テンプレートへの埋め込み | テーマ別テンプレート適用 | ✅ |
| CSS インライン化 | juice による CSS インライン化 | エクスポート時に自動実行 | ✅ |

### エクスポートオプション UI

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| テーマ選択 | GitHub / ドキュメント等 | エクスポートダイアログで選択 | ✅ |
| TOC 自動生成 | 目次のトグル | エクスポートダイアログで ON/OFF | ✅ |
| 数式・図表レンダリング | レンダリングのトグル | エクスポートダイアログで ON/OFF | ✅ |
| エクスポートダイアログ | オプション選択 UI | メニュー → ファイル → エクスポート → HTML | ✅ |

### HTML テーマ CSS

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| GitHub Markdown スタイル | GitHub 風の見た目 | エクスポートテーマ選択 | ✅ |
| ドキュメントスタイル | 書籍風の見た目 | エクスポートテーマ選択 | ✅ |
| プレゼンテーションスタイル | スライド風の見た目 | エクスポートテーマ選択 | ✅ |

---

## Phase 5: HTML WYSIWYG 編集

**全タスク実装完了。**

詳細設計: [html-editing-design.md](../05_Features/HTML/html-editing-design.md)

### 基盤構築

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| rehype-parse 統合 | HTML → 内部 AST パース | `.html` ファイルを開くと自動適用 | ✅ |
| HTML 用 AST シリアライザ | 内部 AST → HTML 文字列 | 保存時に自動処理 | ✅ |
| HTML 用 ProseMirror スキーマ | div・セマンティック要素等のスキーマ | `src/extensions/HtmlExtensions.ts` | ✅ |
| 編集モード自動切替 | 拡張子による MD/HTML モード切替 | `.html` → HTML モード / `.md` → MD モード | ✅ |

### WYSIWYG モード

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| 基本ブロック要素編集 | h1〜h6, p, ul, ol, blockquote, pre, table | 通常の WYSIWYG 操作 | ✅ |
| 基本インライン要素編集 | strong, em, a, img, code, s | ツールバー・ショートカット | ✅ |
| HTML 固有インライン要素 | mark, span, sup, sub | HTML 専用ツールバー | ✅ |
| div ブロック操作 | div の追加・削除・ネスト | HTML 専用ツールバー | ✅ |
| セマンティック要素 | section, article, header, footer, nav | HTML 専用ツールバー | ✅ |

### ソースコードモード

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| HTML シンタックスハイライト | CodeMirror による HTML 構文強調 | ソースモードで自動適用 | ✅ |
| HTML オートコンプリート | タグ補完 | ソースモードで `<` 入力時 | ✅ |
| エラー表示 | 未閉じタグ等のエラー | ソースモードで自動検出 | ✅ |

### スプリットモード

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| 並列表示 | 左：ソース / 右：プレビュー | モード切替ボタンで「スプリット」選択 | ✅ |
| 同期スクロール | ソースとプレビューのスクロール同期 | 自動 | ✅ |
| モード切替ボタン | WYSIWYG / ソース / スプリット | ステータスバー or ツールバー | ✅ |

### HTML 専用ツールバー

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| テキスト色ピッカー | `color` スタイル設定 | ツールバーの色ボタン | ✅ |
| 背景色ピッカー | `background-color` スタイル設定 | ツールバーの背景色ボタン | ✅ |
| フォントサイズ選択 | フォントサイズ設定 | ツールバーのサイズ選択 | ✅ |
| テキスト配置 | 左/中央/右/均等 | ツールバーの配置ボタン | ✅ |
| div ブロック挿入 | div 要素の挿入 | ツールバーの div ボタン | ✅ |

### メタデータ編集パネル

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| title 編集 | `<title>` タグ編集 | HTML メタデータパネル | ✅ |
| meta description 編集 | `<meta name="description">` 編集 | HTML メタデータパネル | ✅ |
| CSS リンク管理 | CSS ファイルの追加・削除 | HTML メタデータパネル | ✅ |
| JS リンク管理 | JavaScript ファイルの追加・削除 | HTML メタデータパネル | ✅ |

---

## Phase 6: HTML ↔ MD 変換

**全タスク実装完了。**

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| HTML → Markdown 変換 | turndown による HTML → MD 変換 | メニュー → ファイル → 別名で保存 → Markdown として保存 | ✅ |
| 変換ロス警告 | 変換できない要素のリスト表示 | 変換実行時に自動表示 | ✅ |
| Markdown として保存 | HTML → MD 変換して保存 | メニュー → ファイル → 別名で保存 → Markdown として保存 | ✅ |
| HTML として保存 | MD → HTML 変換して保存 | メニュー → ファイル → 別名で保存 → HTML として保存 | ✅ |
| 新規タブで開く | 変換結果を新しいタブに表示 | 変換ダイアログのオプション | ✅ |

---

## Phase 7: 高度な機能

**全タスク実装完了。**

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| テーマシステム | CSS 変数ベースの 8 テーマ（ライト/ダーク/GitHub/ドキュメント等） | 設定 → 外観 → テーマ選択 | ✅ |
| PDF エクスポート | Markdown → PDF 変換 | メニュー → ファイル → エクスポート → PDF | ✅ |
| Pandoc 統合 | Word / LaTeX / EPUB エクスポート | メニュー → ファイル → エクスポート → Pandoc | ✅ |
| Pandoc インストール確認 | 起動時 / エクスポート時の自動確認 | 自動（未インストール時にダイアログ表示） | ✅ |
| フォーカスモード | 現在段落のみ強調表示 | メニュー → 表示 → フォーカスモード | ✅ |
| タイプライターモード | カーソル行を常に中央固定 | メニュー → 表示 → タイプライターモード | ✅ |
| YAML Front Matter 編集 | 折りたたみパネル・生 YAML 編集・サマリー表示 | エディタ上部の FM パネル | ✅ |
| プラグイン API | 拡張ポイント・サンドボックス・ライフサイクル管理 | 設定 → プラグインタブ | ✅ |
| ファイルドラッグ移動 | ファイルツリーでの D&D 移動 | ファイルをドラッグして移動 | ✅ |
| リンク自動更新 | リネーム・移動時の MD リンク自動更新 | リネーム実行時に自動 | ✅ |
| ワークスペース切り替え | 最近使ったワークスペース一覧 | メニュー → ファイル → 最近のワークスペース | ✅ |
| ウィンドウ状態記憶・復元 | 位置・サイズ・最大化状態の保存 | 自動（終了時保存・起動時復元） | ✅ |
| タブバーダブルクリック | 空き領域ダブルクリックで最大化トグル + ドラッグ移動 | タブバー空き領域をダブルクリック | ✅ |
| 最近使ったファイル | Tauri ネイティブメニューの動的更新 | メニュー → ファイル → 最近使ったファイル | ✅ |
| Windows ジャンプリスト | `SHAddToRecentDocs` 登録 | Windows のタスクバー右クリック | ✅ |
| タブ→ウィンドウ切り出し | タブを別ウィンドウに分離 | タブを D&D でウィンドウ外にドロップ | ✅ |

### スラッシュコマンド

詳細設計: [slash-commands-design.md](../05_Features/slash-commands-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| SlashCommandsExtension | 行頭 `/` でコマンドメニュー表示 | 行頭で `/` を入力 | ✅ |
| コマンドフィルタリング | 入力文字でコマンド候補を絞り込み | `/heading` 等を入力 | ✅ |
| コマンド定義 18 種 | テキスト・見出し・テーブル・コード・AI テンプレート等 | `/` メニューから選択 | ✅ |
| カテゴリ別グループ表示 | コマンドをカテゴリ分類して表示 | `/` メニュー内で自動分類 | ✅ |
| キーボード操作 | ↑↓ 移動、Enter/Tab 実行、Esc 閉じる | `/` メニュー表示中にキーボード操作 | ✅ |
| AI テンプレート統合 | `/ブログ` 等でテンプレート直接挿入 | `/ブログ` 等を入力 | ✅ |
| 設定制御 | `slashCommands.enabled` / `showAiTemplates` | 設定ダイアログ | ✅ |

### ペイン分割エディタ

詳細設計: [split-editor-design.md](../03_UI_UX/split-editor-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| SplitEditorLayout | 左右/上下の 2 分割対応 | メニュー → 表示 → 分割 | ✅ |
| スプリッタドラッグリサイズ | PointerEvents ベースのリサイズ | 分割線をドラッグ | ✅ |
| ペイン独立タブバー | 各ペインに独立したタブバー | 分割後に各ペインでタブ操作 | ✅ |
| paneStore | ペイン状態・アクティブペイン管理 | `src/store/paneStore.ts` | ✅ |
| ペイン間フォーカス移動 | ショートカットでフォーカス切替 | `Ctrl+Alt+←/→` | ✅ |
| タブのペイン間移動 | タブを D&D でペイン間移動 | タブをドラッグして他ペインにドロップ | ✅ |
| ペインセッション保存 | ペイン状態の永続化 | 自動（終了時保存・起動時復元） | ✅ |
| スクロール同期 | 同一ファイル分割時のスクロール同期 | 設定でオプション切替 | ✅ |

### Zen モード（集中モード）

詳細設計: [zen-mode-design.md](../03_UI_UX/zen-mode-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| フルスクリーン | Tauri `Window.setFullscreen()` | `F11` | ✅ |
| UI 完全非表示 | CSS `.zen-mode` クラスで UI を隠す | Zen モード有効時に自動適用 | ✅ |
| Zen 専用設定 | コンテンツ幅・行間・フォントサイズ | 設定 → 執筆タブ | ✅ |
| フォーカス/タイプライター統合 | フォーカスモード・タイプライターモードとの連携 | Zen モード有効時に自動連携 | ✅ |
| ホバーツールバー | ホバー時にツールバー一時表示 | マウスを画面上部に移動 | ✅ |
| 環境音（アンビエント） | ホワイトノイズ・ブラウンノイズ・雨音・カフェの 4 種 | ツールバードロップダウン or 設定タブ | ✅ |
| タイプライター打鍵音 | mechanical / soft / typewriter の 3 スタイル | 設定 → 執筆タブ | ✅ |

### 執筆体験強化

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| ポモドーロタイマー | 25 分集中→5 分休憩のカウントダウン | ステータスバーのタイマーアイコン | ✅ |
| ワードスプリント | 時間制限付き目標文字数達成モード | ステータスバーから開始 | ✅ |
| 文章可読性スコア | 漢字率・平均文長・読みやすさ指標の表示 | 文書統計ダイアログ + ステータスバー | ✅ |
| スニペット登録・挿入 | よく使うフレーズの登録とスラッシュコマンド挿入 | 設定 → スニペットタブで登録。エディタで `/` 入力して挿入 | ✅ |

### 知識管理強化

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| タグビュー | YAML FM tags の横断収集・フィルタ | サイドバーの「Tags」タブ / `Ctrl+Shift+5` | ✅ |
| グラフビュー簡易版 | Wikiリンク関係の Canvas/SVG 可視化 | サイドバーの「Graph」タブ / `Ctrl+Shift+6` | ✅ |
| フローティング TOC パネル | 右サイドに固定表示する目次 | `Ctrl+Shift+T` でトグル | ✅ |
| テンプレートからページ作成 | 週次レビュー等の追加テンプレート | 設定 → テンプレートタブで管理。メニュー → ファイル → テンプレートから新規作成 | ✅ |

### AI アシスト機能強化

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| テキスト選択 AI アシスト | 選択→改善/翻訳/要約を Claude API で実行 | テキスト選択時にフローティングパネルから操作 | ✅ |
| プロンプト構造診断パネル | RTICCO 結果をサイドバーに常時表示 | サイドバーのプロンプト診断パネル | ✅ |
| AI コピー差分プレビュー | 最適化前後の diff 表示モーダル | AI コピーボタン → 差分プレビュー | ✅ |

### テクニカルライター/開発者向け

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| Mermaid インライン編集 | 図表ダブルクリックでソース編集ポップアップ | Mermaid 図表をダブルクリック | ✅ |
| 数式インライン編集 | 数式ダブルクリックで LaTeX ソース編集 | 数式をダブルクリック | ✅ |
| Markdown lint チェック | 見出しレベル飛び・リンク切れ等の検査 | サイドバーの Markdown Lint パネル | ✅ |
| コードブロック実行環境情報 | 言語バッジとランナー環境メモ表示 | コードブロック上部に自動表示 | ✅ |

---

## Phase 7.5: PKM・ナレッジベース機能

### メタデータクエリエンジン

詳細設計: [metadata-query-design.md](../05_Features/metadata-query-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| SQLite スキーマ | files / frontmatter / tags / tasks / links | — | ✅ |
| MetadataIndexer | ワークスペース全スキャン + 差分更新 | — | ✅ |
| TypeScript クエリパーサー | `parseQuery` / `astToSql` | — | ❌ |
| execute_metadata_query | Tauri コマンド | — | ❌ |
| QueryBlockView | ` ```query ``` ` ブロックのインライン表示 | — | ❌ |
| テーブルビュー・リストビュー | クエリ結果の表示 | — | ❌ |
| カレンダービュー | Phase 8 スコープ | — | ❌ |

### グラフビュー（リンクグラフ可視化）

詳細設計: [wikilinks-backlinks-design.md](../05_Features/wikilinks-backlinks-design.md) §11

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| get_graph_data コマンド | GraphNode / GraphEdge 生成 | — | ❌ |
| D3.js Force グラフ | ノード・エッジ・ラベル描画 | — | ❌ |
| ホバーカード | ホバーでファイル情報表示・クリックでオープン | — | ❌ |
| ズーム/パン | d3-zoom による操作 | — | ❌ |
| タグフィルタ UI | フィルタ・孤立ノード非表示オプション | — | ❌ |
| サイドバータブ統合 | グラフビューをサイドバータブに配置 | — | ❌ |

### 双方向リンク（Wikiリンク）とバックリンク

詳細設計: [wikilinks-backlinks-design.md](../05_Features/wikilinks-backlinks-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| WikilinkExtension | `[[ファイル名]]` 記法のパース・NodeView | `[[` を入力 | ✅ |
| 表示テキスト対応 | `[[ファイル名\|表示テキスト]]` | `[[file\|label]]` 記法 | ✅ |
| 解決済み/未解決の表示 | 青色（解決済み）/ 赤・波線（未解決） | 自動（ワークスペースファイルツリーで判定） | ✅ |
| オートコンプリート | `[[` 入力でファイル候補ポップアップ | `[[` + 文字入力 | ✅ |
| LRU ソート | 最近開いたファイル順に候補表示 | 自動 | ✅ |
| Wikiリンクインデックス | バックエンドでの全スキャン + 差分更新 | — | ❌ |
| バックリンクパネル | リンク元ファイル一覧とコンテキスト引用 | サイドバーの「バックリンク」タブ | ✅ |
| バックリンク自動更新 | ファイル保存時の自動更新 | — | ❌ |
| リネーム時 Wikiリンク更新 | 確認 UI + 一括更新 + Undo 対応 | — | ❌ |
| エクスポート時リンク変換 | `[[target\|label]]` → `[label](target.md)` | エクスポート実行時に自動変換 | ✅ |

### Git / バージョン管理簡易統合

詳細設計: [git-integration-design.md](../05_Features/git-integration-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| git_status / git_diff コマンド | Rust git2 クレートによる状態取得 | — | ❌ |
| git_stage / git_unstage / git_commit | ステージング・コミット操作 | — | ❌ |
| git_log コマンド | コミット履歴取得 | — | ❌ |
| ファイルツリー Git バッジ | M/U/A/D/C 状態バッジ | — | ❌ |
| エディタガター差分インジケーター | 追加（緑）・変更（橙）・削除（赤） | — | ❌ |
| Git パネル | ステージング・コミット UI | — | ❌ |
| ステータスバーブランチ表示 | ブランチ名・変更件数 | — | ❌ |

### 画像アノテーション

詳細設計: [image-design.md](../05_Features/Image/image-design.md) §9

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| アノテーションモード | 画像ダブルクリックで開始 | — | ❌ |
| 描画ツール | 矩形・楕円・矢印・フリーハンド・テキスト・モザイク・ステップ番号 | — | ❌ |
| アノテーションツールバー | ツール選択・線幅・カラーピッカー | — | ❌ |
| Undo 機能 | ImageData スナップショット（最大 20 ステップ） | — | ❌ |
| アノテーション画像保存 | 元画像バックアップ付き | — | ❌ |

---

## Phase 8: AI 連携機能

詳細設計: [ai-design.md](../05_Features/AI/ai-design.md)

### AI コピーボタン

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| ai-optimizer.ts | 7 種の変換パイプライン | ツールバーの [AI コピー] ボタン | ✅ |
| normalizeHeadings() | 見出し階層の修正 | AI コピー実行時に自動適用 | ✅ |
| annotateCodeBlocks() | コードブロックへの言語タグ付与 | AI コピー実行時に自動適用 | ✅ |
| normalizeListMarkers() | リスト記号の統一 | AI コピー実行時に自動適用 | ✅ |
| trimExcessiveWhitespace() | 過剰空白行の削除 | AI コピー実行時に自動適用 | ✅ |
| annotateLinks() | リンクへの URL 注記 | AI コピー実行時に自動適用 | ✅ |
| normalizeCodeFences() | コードフェンスの統一 | AI コピー実行時に自動適用 | ✅ |
| analyzePromptStructure() | RTICCO 構造の検出・診断 | AI コピー実行時に自動適用 | ✅ |
| optimizeAndCopy() | クリップボードへのコピー | シングルクリック | ✅ |
| buildReport() | 変更点レポート生成 | ドロップダウン → プレビュー | ✅ |
| 最適化レポート UI | ポップオーバーで変更点表示 | [AI コピー] ボタンのドロップダウン | ✅ |
| 変換オン/オフ設定 | 各変換の個別制御 | オプションメニュー | ✅ |

### AI テンプレートシステム

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| テンプレートレジストリ | registerTemplate / listTemplates / searchTemplates / fillTemplate | `src/ai/templates/template-registry.ts` | ✅ |
| 組み込みテンプレート 6 種 | ブログ・コード解説・コードレビュー・要約・CoT・会議メモ | テンプレートパネルから選択 | ✅ |
| テンプレートパネル UI | カテゴリフィルタ・キーワード検索・プレビュー | サイドバーの「テンプレート」タブ | ✅ |
| プレースホルダー入力 | テンプレートの変数を入力ダイアログで置換 | テンプレート選択時に自動表示 | ✅ |
| カスタムテンプレート保存 | ユーザー定義テンプレートの永続化 | — | ❌ |

---

## 技術的負債・改善

| 機能名 | 概要 | 設計書 | 実装 |
|--------|------|--------|------|
| 仮想スクロール | 大きなファイルのパフォーマンス対応 | [performance-design.md §3](../01_Architecture/performance-design.md) | ✅ |
| インクリメンタルシリアライズ | 差分のみの変換処理 | [performance-design.md §4](../01_Architecture/performance-design.md) | ❌ |
| アクセシビリティ（a11y） | ARIA ロール・キーボード操作・コントラスト | [accessibility-design.md](../03_UI_UX/accessibility-design.md) | ❌ |
| 国際化（i18n） | 多言語対応（英語辞書の本格作成） | [i18n-design.md](../07_Platform_Settings/i18n-design.md) | 🔶 |
| パフォーマンスプロファイリング | 計測方法・ベンチマーク | [performance-design.md §8](../01_Architecture/performance-design.md) | ❌ |
| HTML 編集セキュリティ審査 | XSS 対策の審査 | — | ❌ |
| AI コピー言語推定精度向上 | linguist-languages 連携 | [ai-design.md §9](../05_Features/AI/ai-design.md) | ❌ |
| クラッシュリカバリ | 異常終了からの復旧 | [window-tab-session-design.md §10](../04_File_Workspace/window-tab-session-design.md) | ❌ |

## 配布・アップデート

詳細設計: [distribution-design.md](../07_Platform_Settings/distribution-design.md)

| 機能名 | 概要 | 使い方 | 実装 |
|--------|------|--------|------|
| GitHub Actions リリース | `.github/workflows/release.yml` | CI/CD | ❌ |
| 更新署名鍵 | `tauri signer generate` | ビルド時 | ❌ |
| tauri-plugin-updater | アプリ内自動アップデート | 起動時にバックグラウンドチェック | ❌ |
| トースト→ダウンロード→再起動 | アップデート UX フロー | ユーザーに通知表示 | ❌ |
| GitHub Releases 自動アップロード | リリースアセットの自動公開 | CI/CD | ❌ |
| バージョン一括更新スクリプト | `scripts/bump-version.mjs` | `node scripts/bump-version.mjs` | ❌ |
| コード署名 | macOS Notarization・Windows Authenticode | 公開前に実施 | ❌ |

---

## 設計網羅度一覧

> 以下は各設計トピックの検討状態を示す。詳細は各設計ドキュメントを参照。

### 1. アーキテクチャ・コア設計

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 全体アーキテクチャ（ContentEditable + AST） | ✅ | [system-design.md](../01_Architecture/system-design.md) §1 |
| コアアーキテクチャ原則（ロスレス変換・ローカルファースト・責務分離・マルチエンジン） | ✅ | [system-design.md](../01_Architecture/system-design.md) §1.1 |
| データ処理基盤（SQLite メタデータインデックス・ファイルロック） | ✅ | [system-design.md](../01_Architecture/system-design.md) §1.1.1、[metadata-query-design.md](../05_Features/metadata-query-design.md) |
| Rust バックエンド構成（src-tauri/ ディレクトリ設計・責務分担） | ✅ | [system-design.md](../01_Architecture/system-design.md) §3.2 |
| ファイルサイズ閾値・モード自動切替 | ✅ | [system-design.md](../01_Architecture/system-design.md) §2.2、[performance-design.md](../01_Architecture/performance-design.md) §2 |
| Typora式カーソル位置計算 | ✅ | [system-design.md](../01_Architecture/system-design.md) §3 |
| Markdown ↔ TipTap JSON 変換設計 | ✅ | [markdown-tiptap-conversion.md](../02_Core_Editor/markdown-tiptap-conversion.md) |
| サポートする Markdown 要素マトリクス | ✅ | [markdown-tiptap-conversion.md](../02_Core_Editor/markdown-tiptap-conversion.md) §2 |
| ラウンドトリップテスト戦略 | ✅ | [tiptap-roundtrip-test-strategy.md](../02_Core_Editor/tiptap-roundtrip-test-strategy.md) |
| HTML ↔ Markdown 変換（turndown）・変換マトリクス | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §10、[smart-paste-design.md](../06_Export_Interop/smart-paste-design.md) §3 |
| 技術選定・不採用理由の記録 | ✅ | [decision-log.md](./decision-log.md) |

### 2. エディタ UX

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Typora 式インラインレンダリング（フォーカス時ソース） | ✅ | [typora-analysis.md](./typora-analysis.md) §2、[system-design.md](../01_Architecture/system-design.md) §5 |
| ソースモード切替（Ctrl+/） | ✅ | [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md)、[system-design.md](../01_Architecture/system-design.md) |
| オートフォーマット（`# ` → 見出し等） | 🔶 | [system-design.md](../01_Architecture/system-design.md) |
| フォーカスモード・タイプライターモード | 🔶 | [typora-analysis.md](./typora-analysis.md) §2.3 |
| スマートペースト（HTML → MD 自動変換） | ✅ | [smart-paste-design.md](../06_Export_Interop/smart-paste-design.md) |
| 矩形選択（Alt+ドラッグ） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §11 |
| テキスト整形コマンド（ソート・重複削除・空白除去・全角/半角） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §12 |
| 行ブックマークと F2 ジャンプ | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §13 |
| 単語の自動補完（Ctrl+Space） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §14 |
| ブロック境界カーソル脱出設計（Ctrl+Enter で次段落移動） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §15 |
| エンコーディング明示的 Reload / Convert UI | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §10.3 |
| 改行コード明示的 Convert and Save UI | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §11.3 |
| YAML Front Matter 編集 UI（専用パネル / インライン折りたたみ） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §1 |
| フローティング数式プレビュー | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §2 |
| アウトラインパネル設計 | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §3 |
| クイックオープン（Ctrl+P） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §4 |
| コードブロック補助 UI（コピーボタン・行番号・言語セレクター） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §5 |
| 画像のインラインリサイズ UI | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §6 |
| リンクのクリック動作設計（Ctrl+クリック） | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §7 |
| ファイルツリーからの D&D リンク挿入 | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §8 |
| スプリットビュースクロール同期アルゴリズム | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §9 |
| 空ドキュメントのプレースホルダー表示 UX | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §10 |
| スマートクォーテーション・オートコレクト | ✅ | [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) §16 |

### 3. テーブル編集

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| テーブル WYSIWYG 操作（Tab 移動・行/列 CRUD） | ✅ | [system-design.md](../01_Architecture/system-design.md) §6 |
| テーブルの制限事項（セル結合不可等） | ✅ | [typora-analysis.md](./typora-analysis.md) §4.4 |

### 4. Undo / Redo

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| TipTap 履歴プラグイン設計 | ✅ | [undo-redo-design.md](../02_Core_Editor/undo-redo-design.md) |
| モード切替をまたいだ履歴管理 | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §9.3 |
| Undo 粒度設計 | ✅ | [undo-redo-design.md](../02_Core_Editor/undo-redo-design.md) §2 |

### 5. キーボードショートカット

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ショートカット全一覧（インライン・ブロック・テーブル・アプリ） | ✅ | [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md) §1 |
| OS 間競合の分析と対処 | ✅ | [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md) §2 |
| ショートカットカスタマイズ詳細 UX・永続化設計 | ✅ | [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md) §6 |
| IME 変換中のショートカット制御方針（`isComposing` ガード） | ✅ | [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md) §2-4 |

### 6. ファイル I/O・セッション管理

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| タブ vs 複数ウィンドウ設計 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §1 |
| セッション保存・復元 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §2 |
| 未保存変更の管理 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §3 |
| 最近使ったファイル履歴 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §4 |
| ファイル関連付け・シングルインスタンス制御 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §5 |
| 自動保存（Debounce 設計） | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §9、[performance-design.md](../01_Architecture/performance-design.md) §5 |
| クラッシュリカバリ | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §10 |
| フォルダ/ワークスペース管理 | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §1〜§8 |
| 新規ファイル作成フロー | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §9 |
| ファイルエンコーディング対応（UTF-8 / UTF-8 BOM / Shift-JIS） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §10 |
| 改行コード対応（CRLF / LF） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §11 |
| ファイル削除・ゴミ箱移動の UX | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §12 |
| バックアップ設計（定期バックアップ・世代数） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §13 |
| 印刷機能（ネイティブ印刷ダイアログ・印刷用 CSS） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §14 |
| ドラッグ&ドロップによるファイルオープン | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §15 |
| 外部クラウドストレージ同期競合対応 | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §16 |
| 外部変更時の競合解決 UX | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §4.2.1 |
| セッション復元と LRU タブ上限の整合性 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §2.5 |
| 3MB 超ファイルのクラッシュリカバリ制約 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §10.7 |
| 巨大ファイル差分チェックポイント設計 | ✅ | [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) §13 |

### 7. 画像管理

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 画像保存先モード（4 種） | ✅ | [image-design.md](../05_Features/Image/image-design.md) §1 |
| ファイル命名戦略 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §1.2 |
| ハッシュによる重複排除 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §2 |
| 外部 URL 画像のキャッシュ | ✅ | [image-design.md](../05_Features/Image/image-design.md) §4 |
| モバイル（Android/iOS）対応 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §5 |
| クリップボード画像貼り付けフロー | ✅ | [image-design.md](../05_Features/Image/image-design.md) §6 |
| 画像最適化・圧縮（リサイズ・品質調整・WebP） | ✅ | [image-design.md](../05_Features/Image/image-design.md) §7 |
| alt テキスト（画像キャプション）編集 UX | ✅ | [image-design.md](../05_Features/Image/image-design.md) §8 |

### 8. パフォーマンス

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| パフォーマンスバジェット・計測指標 | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §1 |
| 仮想スクロール設計 | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §3 |
| インクリメンタルパース設計 | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §4 |
| バックグラウンド保存・非同期 I/O | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §5 |
| フォルダ内全文検索のパフォーマンス | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §6 |
| メモリ管理設計 | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §7 |
| バックグラウンド非同期処理アーキテクチャ（tokio::spawn + Tauri emit） | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §9 |

### 9. セキュリティ

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| XSS 対策（DOMPurify 統合） | ✅ | [security-design.md](../01_Architecture/security-design.md) §2 |
| Tauri CSP 設定 | ✅ | [security-design.md](../01_Architecture/security-design.md) §3 |
| `plugin-fs` スコープ制限 | ✅ | [security-design.md](../01_Architecture/security-design.md) §4 |
| スクリプトタグ分離 | ✅ | [security-design.md](../01_Architecture/security-design.md) §5 |
| iframe / 埋め込みコンテンツのサンドボックス | ✅ | [security-design.md](../01_Architecture/security-design.md) §1.2、[html-editing-design.md](../05_Features/HTML/html-editing-design.md) §11 |
| アップデートパッケージの整合性検証（署名確認） | ✅ | [security-design.md](../01_Architecture/security-design.md) §4.7 |
| プラグインセキュリティ（コードレビュー・公開ポリシー） | ✅ | [security-design.md](../01_Architecture/security-design.md) §4.8 |
| DOMPurify ホワイトリスト拡張（KaTeX/Mermaid/WikiLink） | ✅ | [security-design.md](../01_Architecture/security-design.md) §1.3 |

### 10. HTML 編集

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| HTML 3 モード UX（WYSIWYG / ソース / スプリット） | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §3 |
| HTML 専用ツールバー | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §7.3 |
| メタデータ編集パネル | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §4.3 |
| `<style>` 内 CSS 編集の範囲設計 | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §8 |
| HTML 編集時の相対パス解決設計 | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §9 |
| HTML → MD 変換ロスの許容範囲定義 | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §10 |
| JavaScript / iframe 埋め込みコンテンツの表示設計 | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §11 |

### 11. エクスポート

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| MD → HTML エクスポート（パイプライン） | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §2 |
| HTML テーマ CSS | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §5、[theme-design.md](../03_UI_UX/theme-design.md) |
| PDF エクスポート | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §3 |
| エクスポートオプション UI（ダイアログ設計） | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §4 |
| Pandoc 連携（Word/LaTeX/epub） | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §7〜§9 |

### 12. AI 連携

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| AI コピーボタン（最適化パイプライン） | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §2.1、§3 |
| AI テンプレートシステム | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §2.2 |
| RTICCO 構造解析 | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §3.3 |
| AI コピー言語推定精度向上設計 | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §9 |
| カスタムテンプレート永続化・管理 UI 設計 | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §10 |

### 13. テーマシステム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| CSS Custom Properties 変数体系 | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §2 |
| テーマの 3 層構造（UI / プレビュー / エクスポート） | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §3 |
| ライト/ダークモード・システムテーマ追従 | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §4 |
| ユーザー定義テーマ（JSON カスタムテーマ） | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §5 |
| コードハイライトテーマの自動切り替え | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §4.3 |
| プラットフォーム別フォントスタック | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §2.5 |
| OS ローカルフォント列挙・適用設計 | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §9 |
| リガチャ有効/無効切り替え設計 | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §9.5 |
| PDF/印刷エクスポートへのカスタムフォント反映 | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §9.6 |
| ビジュアルテーマカスタマイザー GUI | ✅ | [theme-design.md](../03_UI_UX/theme-design.md) §5.4〜§5.9 |

### 14. 検索・置換

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 単一ファイル内検索・置換 UX | ✅ | [search-design.md](../05_Features/search-design.md) §2 |
| ワークスペース横断全文検索 UX | ✅ | [search-design.md](../05_Features/search-design.md) §3 |
| 検索オプション（正規表現・大文字小文字・単語単位） | ✅ | [search-design.md](../05_Features/search-design.md) §5 |
| 全文検索のパフォーマンス（Rust walkdir + regex） | ✅ | [performance-design.md](../01_Architecture/performance-design.md) §6.2、[search-design.md](../05_Features/search-design.md) §3.2 |

### 15. プラグインシステム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| プラグイン API 型定義（拡張ポイント・権限モデル） | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §2・§3 |
| サンドボックス設計（iframe + postMessage） | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §4 |
| ビルトインプラグイン（Mermaid・KaTeX・画像） | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §5 |
| プラグインライフサイクル・クリーンアップ | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §6 |
| プラグイン配布・インストール | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §7 |
| プラグイン更新フロー（バージョン比較・ロールバック） | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §7.4 |
| プラグイン設定 GUI・ストア UX | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §9 |
| セーフモード設計（クラッシュループ回復） | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §9.5 |
| パフォーマンス監視・自動無効化 | ✅ | [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §10 |

### 16. アクセシビリティ（a11y）

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| エディタ本体の ARIA ロール設計 | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §2 |
| カスタム NodeView の ARIA | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §3 |
| キーボードのみの操作フロー・roving tabindex | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §4 |
| フォーカス管理（フォーカストラップ・スキップナビゲーション） | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §5 |
| ライブリージョン（状態変化のアナウンス） | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §6 |
| カラーコントラスト設計（WCAG 2.1 AA） | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §7 |
| a11y テスト戦略（axe-core・NVDA・VoiceOver） | ✅ | [accessibility-design.md](../03_UI_UX/accessibility-design.md) §8 |

### 17. Markdown 拡張記法

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 脚注（Footnotes）WYSIWYG 表示・編集 UX | ✅ | [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) §1 |
| ハイライト（`==text==`）・上付き/下付き | ✅ | [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) §2 |
| カスタムコンテナ / Callout ブロック（`:::warning` 等） | ✅ | [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) §3 |
| TOC インライン自動生成（`[toc]` プレースホルダー） | ✅ | [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) §4 |
| PlantUML / js-sequence-diagrams 対応方針 | ✅ | [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) §5 |
| 定義リスト（Definition Lists） | ✅ | [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) §6 |

### 18. アプリケーションシェル UI

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ツールバー UI 設計（ボタン配置・ツールチップ・モード別変化） | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §1 |
| メニューバー設計（Tauri ネイティブメニュー・各 OS 差異） | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §2 |
| エディタ領域コンテキストメニュー | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §3 |
| ステータスバー設計 | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §4 |
| コマンドパレット（Ctrl+Shift+P 風） | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §5 |
| フルスクリーンモード設計（F11） | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §6 |
| サイドバーレイアウト・リサイズ | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §7 |
| 初回起動・オンボーディング設計 | ✅ | [app-shell-design.md](../03_UI_UX/app-shell-design.md) §8 |

### 19. テキスト処理・文書統計

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 文字数・単語数・行数カウント | ✅ | [text-statistics-design.md](../02_Core_Editor/text-statistics-design.md) §1 |
| 読了時間推定 | ✅ | [text-statistics-design.md](../02_Core_Editor/text-statistics-design.md) §2 |
| スペルチェック統合設計（OS ネイティブ / hunspell） | ✅ | [text-statistics-design.md](../02_Core_Editor/text-statistics-design.md) §3 |
| IME・CJK 入力最適化設計 | ✅ | [text-statistics-design.md](../02_Core_Editor/text-statistics-design.md) §4 |

### 20. テスト戦略

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| UI コンポーネントテスト設計 | ✅ | [testing-strategy-design.md](../08_Testing_Quality/testing-strategy-design.md) §2 |
| E2E テストシナリオ設計（Playwright + tauri-driver） | ✅ | [testing-strategy-design.md](../08_Testing_Quality/testing-strategy-design.md) §3 |
| パフォーマンス計測・リグレッションテスト | ✅ | [testing-strategy-design.md](../08_Testing_Quality/testing-strategy-design.md) §4 |
| セキュリティテスト計画 | ✅ | [testing-strategy-design.md](../08_Testing_Quality/testing-strategy-design.md) §5 |

### 21. 国際化（i18n）

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| i18n 基盤導入方針・フェーズ分け | ✅ | [i18n-design.md](../07_Platform_Settings/i18n-design.md) §1 |
| 技術選定（i18next + react-i18next） | ✅ | [i18n-design.md](../07_Platform_Settings/i18n-design.md) §2 |
| 辞書ファイル名前空間構造 | ✅ | [i18n-design.md](../07_Platform_Settings/i18n-design.md) §3 |
| Tauri ネイティブメニューの i18n | ✅ | [i18n-design.md](../07_Platform_Settings/i18n-design.md) §6 |
| Phase 1 コーディングルール（ハードコード禁止等） | ✅ | [i18n-design.md](../07_Platform_Settings/i18n-design.md) §7 |

### 22. クロスプラットフォーム・配布・コミュニティ

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Windows / macOS / Linux 対応方針 | ✅ | [cross-platform-design.md](../07_Platform_Settings/cross-platform-design.md) §1〜5 |
| Android / iOS 対応方針 | ✅ | [cross-platform-design.md](../07_Platform_Settings/cross-platform-design.md) §6〜7 |
| ソフトキーボード・モバイル UX 設計 | ✅ | [mobile-advanced-design.md](../07_Platform_Settings/mobile-advanced-design.md) §1 |
| Android SAF / iCloud Drive 連携 | ✅ | [mobile-advanced-design.md](../07_Platform_Settings/mobile-advanced-design.md) §2〜3 |
| モバイル向けスラッシュコマンド代替 UI | ✅ | [mobile-advanced-design.md](../07_Platform_Settings/mobile-advanced-design.md) §5.6 |
| 配布・自動アップデート | ✅ | [distribution-design.md](../07_Platform_Settings/distribution-design.md) |
| ライセンス方針・プライバシー・テレメトリー | ✅ | [community-design.md](../07_Platform_Settings/community-design.md) §1〜2 |
| クラッシュレポート・フィードバック UI | ✅ | [community-design.md](../07_Platform_Settings/community-design.md) §3〜4 |

### 23. 長期検討項目

| 項目 | 優先度 | 備考 |
|------|--------|------|
| RTL（右から左）言語対応 | 低 | CSS `direction: rtl` + BiDi テキスト処理 |
| マルチウィンドウ独立動作設計 | 低 | タブ→ウィンドウ切り出し後の状態同期 |

---

## 設計書 ↔ 実装ステータス対応表

> 各設計書の主要機能と実装状態の対応。

| 設計書 | 主要機能（要約） | ロードマップ紐づけ | 実装ステータス |
|---|---|---|---|
| `01_Architecture/system-design.md` | 全体アーキテクチャ、編集モード、責務分離 | Phase 1〜8（全体） | 🔶 |
| `01_Architecture/tauri-ipc-interface.md` | Tauri IPC コマンド契約（SoT） | 全 Phase（横断） | 🔶 |
| `01_Architecture/security-design.md` | XSS/CSP/fs-scope/更新署名の安全設計 | Phase 1（CSP）、技術的負債 | 🔶 |
| `01_Architecture/performance-design.md` | 仮想スクロール、インクリメンタル処理、計測 | 技術的負債 | 🔶 |
| `01_Architecture/plugin-api-design.md` | プラグイン API とサンドボックス | Phase 7 | ✅ |
| `02_Core_Editor/markdown-tiptap-conversion.md` | Markdown ↔ TipTap 変換仕様 | Phase 1 | ✅ |
| `02_Core_Editor/tiptap-roundtrip-test-strategy.md` | 変換ラウンドトリップ品質担保 | 品質管理（継続テスト） | 🔶 |
| `02_Core_Editor/undo-redo-design.md` | Undo/Redo 粒度と履歴分離 | Phase 1 | ✅ |
| `02_Core_Editor/markdown-extensions-design.md` | 脚注・カスタムコンテナ等の拡張記法 | 将来フェーズ | ❌ |
| `02_Core_Editor/text-statistics-design.md` | 文字数/単語数/読了時間統計 | Phase 3 | ✅ |
| `03_UI_UX/app-shell-design.md` | シェル UI、メニュー、ステータスバー | Phase 1/3/7 | ✅ |
| `03_UI_UX/editor-ux-design.md` | エディタ操作 UX（ジャンプ・補完・整形等） | Phase 3 | ✅ |
| `03_UI_UX/keyboard-shortcuts.md` | ショートカット体系 | Phase 1/3/7 | ✅ |
| `03_UI_UX/theme-design.md` | テーマシステム・見た目カスタマイズ | Phase 7 | ✅ |
| `03_UI_UX/zen-mode-design.md` | Zen/集中モード強化 | Phase 7 | ✅ |
| `03_UI_UX/split-editor-design.md` | ペイン分割編集 | Phase 7 | ✅ |
| `03_UI_UX/accessibility-design.md` | a11y 対応方針 | 技術的負債 | ❌ |
| `04_File_Workspace/file-workspace-design.md` | ファイル/フォルダ/ワークスペース管理 | Phase 1/3/7 | ✅ |
| `04_File_Workspace/window-tab-session-design.md` | タブ、セッション、クラッシュリカバリ | Phase 1、技術的負債 | 🔶 |
| `05_Features/search-design.md` | 検索・置換機能 | Phase 3 | ✅ |
| `05_Features/slash-commands-design.md` | スラッシュコマンド挿入 | Phase 7 | ✅ |
| `05_Features/wikilinks-backlinks-design.md` | WikiLink/Backlink/グラフ表示 | Phase 7.5 | 🔶 |
| `05_Features/git-integration-design.md` | Git 状態表示・履歴・競合支援 | Phase 7.5 | ❌ |
| `05_Features/metadata-query-design.md` | メタデータ索引とクエリ | Phase 7.5 | ❌ |
| `05_Features/HTML/html-editing-design.md` | HTML WYSIWYG/ソース/スプリット編集 | Phase 5/6 | ✅ |
| `05_Features/Image/image-design.md` | 画像挿入・管理・最適化 | Phase 3/4 | ✅ |
| `05_Features/AI/ai-design.md` | AIコピー・テンプレート | Phase 8 | ✅ |
| `06_Export_Interop/export-interop-design.md` | HTML/PDF/Pandoc エクスポート | Phase 4/7 | ✅ |
| `06_Export_Interop/smart-paste-design.md` | スマートペースト変換 | Phase 1/3 | ✅ |
| `07_Platform_Settings/user-settings-design.md` | 設定管理・マイグレーション | Phase 1 | ✅ |
| `07_Platform_Settings/i18n-design.md` | 多言語化 | 技術的負債 | 🔶 |
| `07_Platform_Settings/cross-platform-design.md` | OS 差分対応方針 | Phase 7 | 🔶 |
| `07_Platform_Settings/mobile-advanced-design.md` | モバイル高度機能（SAF/iCloud） | 将来フェーズ | ❌ |
| `07_Platform_Settings/distribution-design.md` | 配布・自動更新 | 配布・アップデート章 | ❌ |
| `07_Platform_Settings/community-design.md` | コミュニティ・テレメトリー | 将来フェーズ | ❌ |
| `08_Testing_Quality/testing-strategy-design.md` | テスト戦略・品質ゲート | 全 Phase（品質管理） | 🔶 |
| `08_Testing_Quality/error-handling-design.md` | ログ・通知・例外設計 | Phase 1 | ✅ |

### 未紐づけ機能の管理

以下は「設計書には存在するがロードマップに独立項目がない」ため、本セクションで明示管理する。

| 設計書 | 機能 | 状態 |
|--------|------|------|
| `mobile-advanced-design.md` | モバイル高度機能（SAF/iCloud/ソフトキーボード） | 将来フェーズで実装予定 |
| `community-design.md` | コミュニティ/テレメトリー/フィードバック | 将来フェーズで実装予定 |
| `testing-strategy-design.md` | 品質戦略の運用項目（E2E カバレッジ拡充等） | 継続的に実施 |
| `tiptap-roundtrip-test-strategy.md` | 変換品質の継続検証 | 継続的に実施 |
| `markdown-extensions-design.md` | 脚注・ハイライト・カスタムコンテナ・定義リスト等 | 将来フェーズで実装予定 |

---

## 実装進捗サマリー

| Phase | 合計タスク | 実装済み | 未実装 | 完了率 |
|-------|-----------|---------|--------|--------|
| Phase 1: MVP | 40 | 40 | 0 | 100% |
| Phase 2: テーブル編集 | 10 | 10 | 0 | 100% |
| Phase 3: リッチ機能 | 25 | 25 | 0 | 100% |
| Phase 4: HTML エクスポート | 12 | 12 | 0 | 100% |
| Phase 5: HTML WYSIWYG | 20 | 20 | 0 | 100% |
| Phase 6: HTML ↔ MD 変換 | 5 | 5 | 0 | 100% |
| Phase 7: 高度な機能 | 46 | 46 | 0 | 100% |
| Phase 7.5: PKM | 30 | 7 | 23 | 23% |
| Phase 8: AI 連携 | 14 | 13 | 1 | 93% |
| 技術的負債 | 8 | 0 | 8 | 0% |
| 配布・アップデート | 7 | 0 | 7 | 0% |
| **合計** | **217** | **167** | **50** | **77%** |

---

## 実装ログ

### 2026-02-26 セッション #1（設計フェーズ）
- `docs/` 以下に全設計ドキュメントを作成（Phase 1〜8 全体設計）
- `roadmap.md` に全実装タスクをチェックボックス形式で記載

### 2026-02-26 セッション #2（実装フェーズ開始）
- ブランチ: `claude/implementation-workflow-process-3l7de`
- Phase 1 セットアップ完了（Vite+React+TS+Tauri 2.0）
- TipTap エディタ基盤・MD 変換ライブラリ・App Shell・TabBar・Zustand ストア・Rust ファイル I/O 実装

### 2026-02-26〜2026-03-08（複数セッション）
- Phase 1〜6 全完了
- Phase 7 大部分完了（スラッシュコマンド・ペイン分割・Zen モード・ポモドーロ等）
- Phase 7.5 Wikiリンク関連の一部実装
- Phase 8 AI コピー・テンプレート実装完了

---

## 設計ドキュメント一覧

| ドキュメント | 内容 |
|------------|------|
| [design-index.md](./design-index.md) | 設計ファイル索引・記述ルール |
| [decision-log.md](./decision-log.md) | 技術選定・アーキテクチャ決定の理由記録 |
| [system-design.md](../01_Architecture/system-design.md) | システム全体設計・技術スタック |
| [tauri-ipc-interface.md](../01_Architecture/tauri-ipc-interface.md) | Tauri コマンドのインターフェース定義書 |
| [markdown-tiptap-conversion.md](../02_Core_Editor/markdown-tiptap-conversion.md) | Markdown ↔ TipTap 変換設計 |
| [tiptap-roundtrip-test-strategy.md](../02_Core_Editor/tiptap-roundtrip-test-strategy.md) | ラウンドトリップテスト戦略 |
| [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) | タブ・セッション・自動保存・クラッシュリカバリ |
| [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md) | キーボードショートカット設計 |
| [image-design.md](../05_Features/Image/image-design.md) | 画像管理・操作・アノテーション設計 |
| [security-design.md](../01_Architecture/security-design.md) | セキュリティ設計 |
| [undo-redo-design.md](../02_Core_Editor/undo-redo-design.md) | Undo/Redo 粒度設計 |
| [cross-platform-design.md](../07_Platform_Settings/cross-platform-design.md) | クロスプラットフォーム設計 |
| [performance-design.md](../01_Architecture/performance-design.md) | パフォーマンス設計 |
| [ai-design.md](../05_Features/AI/ai-design.md) | AI 機能設計 |
| [user-settings-design.md](../07_Platform_Settings/user-settings-design.md) | ユーザー設定設計 |
| [i18n-design.md](../07_Platform_Settings/i18n-design.md) | 国際化（i18n）設計 |
| [smart-paste-design.md](../06_Export_Interop/smart-paste-design.md) | スマートペースト設計 |
| [distribution-design.md](../07_Platform_Settings/distribution-design.md) | 配布・自動アップデート設計 |
| [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) | ワークスペース管理設計 |
| [error-handling-design.md](../08_Testing_Quality/error-handling-design.md) | エラーハンドリング設計 |
| [export-interop-design.md](../06_Export_Interop/export-interop-design.md) | エクスポート・Pandoc 連携設計 |
| [theme-design.md](../03_UI_UX/theme-design.md) | テーマシステム設計 |
| [search-design.md](../05_Features/search-design.md) | 検索・置換設計 |
| [plugin-api-design.md](../01_Architecture/plugin-api-design.md) | プラグイン API 設計 |
| [accessibility-design.md](../03_UI_UX/accessibility-design.md) | アクセシビリティ設計 |
| [slash-commands-design.md](../05_Features/slash-commands-design.md) | スラッシュコマンド設計 |
| [wikilinks-backlinks-design.md](../05_Features/wikilinks-backlinks-design.md) | 双方向リンク・バックリンク・グラフビュー設計 |
| [metadata-query-design.md](../05_Features/metadata-query-design.md) | メタデータクエリエンジン設計 |
| [split-editor-design.md](../03_UI_UX/split-editor-design.md) | ペイン分割エディタ設計 |
| [git-integration-design.md](../05_Features/git-integration-design.md) | Git 統合設計 |
| [html-editing-design.md](../05_Features/HTML/html-editing-design.md) | HTML WYSIWYG 編集設計 |
| [zen-mode-design.md](../03_UI_UX/zen-mode-design.md) | 集中モード設計 |
| [app-shell-design.md](../03_UI_UX/app-shell-design.md) | アプリケーションシェル UI 設計 |
| [editor-ux-design.md](../03_UI_UX/editor-ux-design.md) | エディタ UX 設計 |
| [text-statistics-design.md](../02_Core_Editor/text-statistics-design.md) | テキスト処理・文書統計設計 |
| [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) | Markdown 拡張記法設計 |
| [testing-strategy-design.md](../08_Testing_Quality/testing-strategy-design.md) | テスト戦略設計 |
| [community-design.md](../07_Platform_Settings/community-design.md) | コミュニティ・テレメトリー設計 |
| [mobile-advanced-design.md](../07_Platform_Settings/mobile-advanced-design.md) | モバイル高度機能設計 |
