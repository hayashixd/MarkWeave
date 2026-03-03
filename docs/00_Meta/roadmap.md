# 開発ロードマップ

> 詳細な実装計画と優先度の一覧。**正式な実装計画の SoT**。
> フェーズ番号体系は Phase 1〜8 で統一されている（`system-design.md §6` も本ドキュメントを参照）。

## Phase 1: MVP（最小実用製品）

基本的なWYSIWYG編集が動作する状態を目指す。

### セットアップ

- [x] Vite + React + TypeScript プロジェクト初期化
- [x] ESLint / Prettier 設定
- [x] Vitest テスト環境
- [x] Playwright E2Eテスト環境
- [x] Rust / Tauri CLI のインストール
- [x] Tauri 2.0 プロジェクト初期化（`src-tauri/` 構成: `commands/`, `db/`, `fs/`, `menu/`, `models/`）
- [x] Tauri Capabilities 初期設定（`capabilities/default.json`）
- [x] CSP 設定（`tauri.conf.json`: `script-src 'self'`, `connect-src 'none'`）

### コア機能

- [x] ProseMirror 基本セットアップ（TipTap v3 + @tiptap/starter-kit）
- [x] マークダウンパーサ統合（remark + remark-gfm → `src/lib/markdown-to-tiptap.ts`）
- [x] ASTシリアライザ（remark-stringify → `src/lib/tiptap-to-markdown.ts`）
- [x] ファイル読み書き（@tauri-apps/plugin-fs + `src-tauri/src/commands/fs_commands.rs`）
- [x] Zustand ストアセットアップ（`settingsStore`, `tabStore`）

### ファイル管理基本機能

詳細設計: [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §9, §15

- [x] ファイルを開くダイアログ（`Ctrl+O`）`src/hooks/useFileDialogs.ts`
- [x] 名前を付けて保存ダイアログ（`Ctrl+Shift+S` / 未保存ファイルの `Ctrl+S`）
- [x] ドラッグ&ドロップでファイルを開く `src/hooks/useDropListener.ts`

### ユーザー設定

詳細設計: [user-settings-design.md](./user-settings-design.md)

- [x] `AppSettings` 型定義・`DEFAULT_SETTINGS`
- [x] `settingsStore`（Zustand + plugin-store）
- [x] プリファレンスダイアログ（外観・エディタ）
- [x] 設定マイグレーション関数

### スマートペースト

詳細設計: [smart-paste-design.md](./smart-paste-design.md)

- [x] `htmlToMarkdown()`（turndown + DOMPurify）
- [x] `SmartPasteExtension`（TipTap プラグイン）
- [x] `Ctrl+Shift+V` でプレーンテキスト貼り付け

### エラーハンドリング・診断ログ

詳細設計: [error-handling-design.md](./error-handling-design.md)

- [x] `tauri-plugin-log` 設定
- [x] `logger` ユーティリティ（フロントエンド）
- [x] `AppErrorBoundary` / `EditorErrorBoundary`
- [x] `toastStore`（トースト通知）
- [x] Tauri コマンドエラー翻訳層
- [x] パース失敗時のソースモードフォールバック

### タブ・セッション管理

詳細設計: [window-tab-session-design.md](./window-tab-session-design.md)

- [x] タブバー UI（開く・閉じる・切り替え）`src/components/tabs/TabBar.tsx`
- [x] Zustand タブストア（`addTab` / `removeTab` / `updateContent` / `markSaved`）`src/store/tabStore.ts`
- [x] タブタイトルへの未保存マーカー表示（`● filename.md`）StatusBar実装済み
- [x] タイトルバーへの未保存マーカー反映（Rustコマンド経由）
- [x] タブ閉じる時の未保存確認ダイアログ（window.confirm。Phase 3でTauriダイアログに置換）
- [x] `onCloseRequested` によるウィンドウクローズ時の未保存ガード
- [x] セッション保存・復元（@tauri-apps/plugin-store）
- [x] ファイル関連付け設定（tauri.conf.json の `fileAssociations`）
- [x] シングルインスタンス制御（tauri-plugin-single-instance）
- [x] 外部ファイルオープンイベント受信フック（`useFileOpenListener`）

### WYSIWYG要素

- [x] 見出し（H1〜H6）StarterKit heading
- [x] 段落 StarterKit
- [x] 太字・斜体 StarterKit bold/italic
- [x] 取り消し線（@tiptap/extension-strike 要追加）
- [x] インラインコード StarterKit code
- [x] リンク @tiptap/extension-link
- [x] 引用ブロック StarterKit blockquote
- [x] 順序なし・順序付きリスト StarterKit
- [x] タスクリスト（@tiptap/extension-task-list 要追加）
- [x] コードブロック（シンタックスハイライト）※コードブロック自体はStarterKitで表示可。lowlight統合が未実装
- [x] 水平線 StarterKit
- [x] ソースモード切替（Ctrl+/）

### オートフォーマット

- [x] `# ` → 見出し変換（StarterKit InputRule）
- [x] `- ` → リスト変換（StarterKit InputRule）
- [x] `> ` → 引用変換（StarterKit InputRule）
- [x] ` ``` ` → コードブロック変換（StarterKit InputRule）

### キーボードショートカット

- [x] Ctrl+B（太字）StarterKit 組み込み
- [x] Ctrl+I（斜体）StarterKit 組み込み
- [x] Ctrl+K（リンク挿入ダイアログ）
- [x] Ctrl+Z / Ctrl+Shift+Z（Undo/Redo）StarterKit History
- [x] Ctrl+S（保存）AppShell.tsx
- [x] Ctrl+1〜6（見出しレベル）

---

## Phase 2: テーブル編集

Excelライクなテーブル操作を実現する。

- [x] テーブルのレンダリング
- [x] Tab / Shift+Tab でセル移動
- [x] 末尾セルでTabを押すと新行追加
- [x] 行の追加・削除（コンテキストメニュー）
- [x] 列の追加・削除（コンテキストメニュー）
- [x] 行のドラッグ&ドロップ並び替え
- [x] 列のドラッグ&ドロップ並び替え
- [x] 列幅のリサイズ（ドラッグ）
- [x] 列の配置（左/中央/右）
- [x] テーブルのGUI挿入（行数・列数指定）

---

## Phase 3: リッチ機能

- [x] 数式（KaTeX）- インライン・ブロック
- [x] Mermaid 図表
- [x] 画像ドラッグ&ドロップ
- [x] クリップボードからの画像貼り付け
- [x] アウトラインパネル（見出しナビゲーション）
- [x] 検索（Ctrl+F）
- [x] 検索・置換（Ctrl+H）
- [x] クイックオープン（Ctrl+P）

### Markdownエディタ基本機能強化（Typora / サクラエディタ基準）

詳細設計: [editor-ux-design.md](../03_UI_UX/editor-ux-design.md), [app-shell-design.md](../03_UI_UX/app-shell-design.md), [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md)

- [x] 行番号指定ジャンプ（`Ctrl+G`）
- [x] 行ブックマーク（`Ctrl+F2` / `F2` / `Shift+F2`）
- [x] 矩形選択（ソースモード限定 `Alt+ドラッグ`）
- [x] 単語補完（`Ctrl+Space`）
- [x] テキスト整形コマンド（前後空白除去・全角/半角変換・行ソート）
- [x] 文字コードの表示・再読み込み（UTF-8 / UTF-8 BOM / Shift-JIS）
- [x] 改行コード（LF / CRLF）の切り替え保存
- [x] インデント設定（タブ幅・タブ/スペース変換・自動インデント）
- [x] 文書統計ダイアログ（文字数・単語数・読了時間）

### ワークスペース管理

詳細設計: [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md)

- [x] フォルダを開く（`Ctrl+Shift+O`）
- [x] ファイルツリーサイドバー
- [x] 外部ファイル変更の検知と通知
- [x] クロスファイルリンクのクリックで開く
- [x] ファイル作成・削除・リネーム（コンテキストメニュー）
- [x] ワークスペースのセッション保存・復元

### スマートペースト拡張

詳細設計: [smart-paste-design.md](./smart-paste-design.md)

- [x] `ask` モードの確認バー UI
- [x] 画像 data-URI の保存連携
- [x] 数式 LaTeX の Turndown カスタムルール

---

## Phase 4: MD → HTML エクスポート

MarkdownをスタイルつきHTMLファイルとして書き出す機能。

### 変換パイプライン

- [x] remark-rehype 統合（MD AST → HTML AST）
- [x] rehype-highlight 統合（コードのシンタックスハイライト）
- [x] rehype-katex 統合（数式レンダリング）
- [x] rehype-stringify 統合（HTML文字列生成）
- [x] HTMLテンプレートエンジン実装
- [x] juice によるCSS インライン化

### エクスポートオプションUI

- [x] テーマ選択（GitHub / ドキュメント等）
- [x] 目次（TOC）の自動生成トグル
- [x] 数式・図表レンダリングのオン/オフ
- [x] エクスポートダイアログ
- [x] メニュー: ファイル → エクスポート → HTMLにエクスポート

### HTMLテーマCSS

- [x] GitHub Markdownスタイル
- [x] ドキュメントスタイル（書籍風）
- [x] プレゼンテーションスタイル（将来）

---

## Phase 5: HTML WYSIWYG 編集

HTMLファイルをMarkdownと同様の直感的な操作で編集する機能。

### 基盤構築

- [x] rehype-parse 統合（HTML → 内部AST）
- [x] HTML用内部ASTシリアライザ（内部AST → HTML文字列）
- [x] ProseMirrorのHTMLスキーマ定義（divブロック、セマンティック要素等）
- [x] 拡張子による編集モード自動切替（.html → HTMLモード）

### WYSIWYG モード

- [x] 基本ブロック要素の編集（h1〜h6, p, ul, ol, blockquote, pre, table）
- [x] 基本インライン要素の編集（strong, em, a, img, code, s）
- [x] HTML固有インライン要素（mark, span, sup, sub）
- [x] divブロックの追加・削除・ネスト
- [x] セマンティック要素（section, article, header, footer, nav）

### ソースコードモード

- [x] CodeMirrorによるHTMLシンタックスハイライト
- [x] HTMLオートコンプリート（タグ補完）
- [x] エラー表示（未閉じタグ等）

### スプリットモード

- [x] 左：ソースコード / 右：プレビュー の並列表示
- [x] 同期スクロール
- [x] モード切替ボタン（WYSIWYG / ソース / スプリット）

### HTML専用ツールバー

- [x] テキスト色ピッカー（`color`）
- [x] 背景色ピッカー（`background-color`）
- [x] フォントサイズ選択
- [x] テキスト配置（左/中央/右/均等）
- [x] divブロック挿入

### メタデータ編集パネル

- [x] `<title>` 編集
- [x] `<meta name="description">` 編集
- [x] CSS ファイルリンクの追加・削除
- [x] JavaScript ファイルリンクの追加・削除

---

## Phase 6: HTML ↔ MD 変換

双方向の変換を統合UIで提供する。

- [ ] HTML → Markdown 変換（turndown 統合）
- [ ] 変換ロス警告の表示UI（変換できない要素のリスト）
- [ ] メニュー: ファイル → 別名で保存 → Markdownとして保存
- [ ] メニュー: ファイル → 別名で保存 → HTMLとして保存
- [ ] 変換結果を新規タブで開くオプション

---

## Phase 7: 高度な機能

- [ ] テーマシステム（CSSベース）
- [ ] PDFエクスポート
- [ ] Pandoc 統合（詳細設計: [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §7〜§10）
  - [ ] Pandoc インストール確認（起動時 / エクスポート実行時）
  - [ ] Pandoc 未インストール時のエラー UX（インストール案内ダイアログ）
  - [ ] Word（.docx）エクスポート
  - [ ] LaTeX / epub エクスポート
- [ ] フォーカスモード
- [ ] タイプライターモード
- [ ] YAML Front Matter 編集UI
- [ ] プラグインAPI
- [ ] ワークスペース高度な機能（詳細設計: [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §6）
  - [ ] ファイルのドラッグ移動
  - [ ] リネーム・移動時の Markdown リンク自動更新
  - [ ] ワークスペース切り替え（最近使ったワークスペース）

### ウィンドウ管理の拡張

- [x] ウィンドウ状態の記憶・復元（位置・サイズ・最大化状態を次回起動時に復元）
- [x] タブバー空き領域のダブルクリックでウィンドウ最大化トグル + ドラッグ移動
- [ ] 最近使ったファイル（Tauri ネイティブメニュー動的更新）
- [ ] Windows ジャンプリスト登録（`SHAddToRecentDocs`）
- [ ] タブをウィンドウに切り出す機能（WebviewWindow、デスクトップ専用）

### スラッシュコマンド（/）による要素挿入

詳細設計: [slash-commands-design.md](./slash-commands-design.md)

- [ ] `SlashCommandsExtension`（TipTap プラグイン実装）
  - [ ] トリガー検出ロジック（行頭の `/` のみ）
  - [ ] `fuse.js` によるファジーフィルタリング
  - [ ] コマンド定義（テキスト・見出し・テーブル・コード・メディア系）
  - [ ] Markdown 拡張コマンド（カスタムコンテナ・脚注・TOC）
- [ ] スラッシュコマンドメニュー UI コンポーネント
  - [ ] カテゴリ別グループ表示
  - [ ] キーボード操作（↑↓ で移動、Enter / Tab で実行、Esc で閉じる）
  - [ ] ポップアップの位置計算（カーソル直下、ビューポート端での反転）
- [ ] AI テンプレートとの統合（`/ブログ` 等のテンプレート直接挿入）
- [ ] 設定: `slashCommands.enabled` / `slashCommands.showAiTemplates`

### ペイン分割エディタ（Split Editor）

詳細設計: [split-editor-design.md](./split-editor-design.md)

- [ ] `SplitEditorLayout` コンポーネント（左右/上下の 2 分割対応）
- [ ] スプリッタのドラッグリサイズ（PointerEvents ベース）
- [ ] 各ペイン独立タブバー
- [ ] `paneStore`（Zustand: ペイン状態・アクティブペイン管理）
- [ ] ペイン間フォーカス移動ショートカット（`Ctrl+Alt+←/→`）
- [ ] タブをドラッグでペイン間移動
- [ ] ペイン状態のセッション保存・復元（`window-tab-session-design.md` と連携）
- [ ] 同一ファイル分割時のスクロール同期オプション

### Zen モード（集中モード）強化

詳細設計: [zen-mode-design.md](./zen-mode-design.md)

- [ ] Tauri `Window.setFullscreen()` によるフルスクリーン実装
- [ ] Zen モード有効時の UI 完全非表示（CSS `.zen-mode` クラス）
- [ ] コンテンツ幅・行間・フォントサイズの Zen モード専用設定
- [ ] フォーカスモード・タイプライターモードとの統合
- [ ] ホバー時のツールバー一時表示（opacity アニメーション）
- [ ] 環境音（アンビエントサウンド）再生機能（Web Audio API）
  - [ ] ホワイトノイズ・雨音・カフェ・焚き火の 4 種
  - [ ] 音量コントロール UI
- [ ] タイプライター打鍵音フィードバック（オプション）
- [ ] Zen モード用キーボードショートカット（`F11` で統合、代替 `Ctrl+Shift+F11`。`Ctrl+Shift+Z` は Redo と競合するため使用禁止）

---

---

## Phase 7.5: PKM・ナレッジベース機能

ワークスペース機能を活用した知識管理（PKM）に特化した機能群。

### メタデータクエリエンジン

詳細設計: [metadata-query-design.md](../05_Features/metadata-query-design.md)

- [ ] SQLite スキーマ作成（files / frontmatter / tags / tasks / links）
- [ ] `rusqlite` 統合・`MetadataIndexer` 実装（ワークスペース全スキャン）
- [ ] ファイル保存時の差分インデックス更新
- [ ] TypeScript クエリパーサー（`parseQuery` / `astToSql`）
- [ ] `execute_metadata_query` Tauri コマンド
- [ ] `QueryBlockView` NodeView（`` ```query ``` `` ブロックのインライン表示）
- [ ] テーブルビュー・リストビュー（Phase 7.5 スコープ）
- [ ] カレンダービュー（Phase 8 スコープ）

### グラフビュー（リンクグラフ可視化）

詳細設計: [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) §11

- [ ] `get_graph_data` Tauri コマンド（GraphNode / GraphEdge 生成）
- [ ] D3.js Force グラフ基本実装（ノード・エッジ・ラベル描画）
- [ ] ホバーカード・クリックでファイルオープン
- [ ] ズーム/パン（d3-zoom）
- [ ] タグフィルタ UI・孤立ノード非表示オプション
- [ ] グラフビューをサイドバータブとして統合

### 双方向リンク（Wikiリンク）とバックリンク

詳細設計: [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md)

- [ ] `WikilinkExtension`（TipTap 拡張）
  - [ ] `[[ファイル名]]` 記法のパース・NodeView 実装
  - [ ] `[[ファイル名|表示テキスト]]` / `[[ファイル名#見出し]]` のサポート
  - [ ] 解決済み（青色）/ 未解決（赤・波線）の表示分岐
- [ ] Wikiリンク オートコンプリート
  - [ ] `[[` 入力でファイル候補ポップアップ表示
  - [ ] `fuse.js` によるファジーマッチ
  - [ ] LRU ソート（最近開いたファイル順）
- [ ] Wikiリンクインデックス（バックエンド）
  - [ ] Tauri コマンド: ワークスペース全スキャン + 差分更新
  - [ ] `wikilinkStore`（Zustand: インデックス管理・バックリンク提供）
- [ ] バックリンクパネル（サイドバータブ）
  - [ ] リンク元ファイル一覧とコンテキスト引用表示
  - [ ] リンク元クリックでジャンプ
  - [ ] ファイル保存時の自動更新
- [ ] ファイルリネーム時の Wikiリンク自動更新
  - [ ] リネーム後に「XX 件のリンクを更新しますか？」確認 UI
  - [ ] 一括更新 + Undo 対応
- [ ] エクスポート時の Wikiリンク → 通常リンク変換

### Git / バージョン管理簡易統合

詳細設計: [git-integration-design.md](./git-integration-design.md)

- [ ] Rust バックエンド（`git2` クレート）
  - [ ] `git_status` コマンド（ファイル状態一覧）
  - [ ] `git_diff` コマンド（ファイル差分 unified diff）
  - [ ] `git_stage` / `git_unstage` コマンド
  - [ ] `git_commit` コマンド
  - [ ] `git_log` コマンド（コミット履歴）
- [ ] ファイルツリーの Git バッジ表示（M/U/A/D/C）
  - [ ] フォルダの変更件数集計
  - [ ] 30 秒ごとの自動ポーリング更新
- [ ] エディタガターの差分インジケーター
  - [ ] 追加行（緑）・変更行（オレンジ）・削除境界（赤）
  - [ ] ガタークリックでインライン Diff ポップアップ
- [ ] Git パネル（サイドバータブ）
  - [ ] 変更ファイル一覧（ステージング済み / 未ステージ / 未追跡）
  - [ ] ステージング追加・解除ボタン
  - [ ] コミットメッセージ入力 + コミット実行
  - [ ] コミット履歴一覧（直近 50 件）
- [ ] ステータスバーへのブランチ名・変更件数表示
- [ ] 設定: `git.enabled` / `git.showFileTreeBadges` 等

### 画像アノテーション（簡易注釈）

詳細設計: [image-design.md](../05_Features/Image/image-design.md) §9

- [ ] 画像ダブルクリックでアノテーションモード開始
- [ ] アノテーションツール実装（Canvas API）
  - [ ] 矩形（赤枠）・楕円・矢印・フリーハンド線
  - [ ] テキストラベル
  - [ ] モザイク（ぼかし）ツール
  - [ ] ステップ番号（❶❷❸...）ツール
- [ ] アノテーションツールバー（ツール選択・線幅・カラーピッカー）
- [ ] Undo 機能（ImageData スナップショット方式、最大 20 ステップ）
- [ ] アノテーション済み画像の保存（元画像バックアップ付き）
- [ ] 設定: バックアップの有効/無効

---

## Phase 8: AI連携機能

生成AI時代のMarkdown活用を支援するAI連携機能。

### AIコピーボタン（AI Optimized Copy）

- [ ] `ai-optimizer.ts` 実装（変換パイプライン）
  - [ ] `normalizeHeadings()` — 見出し階層の修正
  - [ ] `annotateCodeBlocks()` — コードブロックへの言語タグ付与（言語推定）
  - [ ] `normalizeListMarkers()` — リスト記号の統一
  - [ ] `trimExcessiveWhitespace()` — 過剰空白行の削除
  - [ ] `annotateLinks()` — リンクへのURL注記
  - [ ] `normalizeCodeFences()` — コードフェンスの統一
  - [ ] `analyzePromptStructure()` — RTICCO構造の検出・診断
- [ ] `optimizeAndCopy()` — クリップボードへのコピー実装
- [ ] `buildReport()` — 変更点レポート生成
- [ ] ツールバーへの **[AIコピー]** ボタン配置
  - [ ] シングルクリック: 最適化してコピー
  - [ ] ドロップダウン: プレビュー表示 / オプション設定
- [ ] 最適化レポート ポップオーバーUI
- [ ] 各変換のオン/オフ設定（オプションメニュー）

### AIテンプレートシステム

- [ ] テンプレートレジストリ実装（`template-registry.ts`）
  - [ ] `registerTemplate()` — テンプレート登録
  - [ ] `listTemplates()` / `searchTemplates()` — 一覧・検索
  - [ ] `fillTemplate()` — プレースホルダー置換
- [ ] 組み込みテンプレート（6種）
  - [ ] ブログ構成案
  - [ ] コード解説（言語選択対応）
  - [ ] コードレビュー依頼
  - [ ] 要約用プロンプト
  - [ ] 思考の連鎖（Chain of Thought）
  - [ ] 会議メモ整形
- [ ] テンプレートパネルUI
  - [ ] カテゴリフィルタ（ブログ / コード / 要約 / 推論 / 議事録 / 全て）
  - [ ] キーワード検索
  - [ ] テンプレートプレビュー
  - [ ] プレースホルダー入力ダイアログ
  - [ ] カーソル挿入 / ドキュメント全体置換の選択
- [ ] カスタムテンプレートの保存・管理（将来）

---

## 技術的負債・改善

- [ ] 大きなファイルの仮想スクロール対応（詳細設計: [performance-design.md §3](./performance-design.md#3-仮想スクロール設計)）
- [ ] インクリメンタルシリアライズ（詳細設計: [performance-design.md §4](./performance-design.md#4-インクリメンタルパース設計)）
- [ ] アクセシビリティ（a11y）対応（詳細設計: [accessibility-design.md](./accessibility-design.md)。各フェーズの完了条件にARIAロール検証を含めること）
- [ ] 国際化（i18n）（仕組みは Phase 1 で導入済み。英語辞書の本格作成は Phase 5 以降。詳細設計: [i18n-design.md](./i18n-design.md)）
- [ ] パフォーマンスプロファイリング（計測方法: [performance-design.md §8](./performance-design.md#8-パフォーマンス計測プロファイリング方法)）
- [ ] HTML編集のセキュリティ審査（XSS対策）
- [ ] AIコピーの言語推定精度向上（linguist-languages連携）
- [ ] クラッシュリカバリの実装（詳細設計: [window-tab-session-design.md §10](./window-tab-session-design.md#10-クラッシュリカバリ設計)）

## 配布・アップデート

詳細設計: [distribution-design.md](./distribution-design.md)

- [ ] GitHub Actions リリースワークフロー（`.github/workflows/release.yml`）
- [ ] `tauri signer generate` で更新署名鍵ペア生成
- [ ] `tauri-plugin-updater` 統合
- [ ] 起動時アップデートチェック（バックグラウンド）
- [ ] トースト通知 → ダウンロード進捗 → 再起動フロー
- [ ] GitHub Releases への自動アップロード
- [ ] バージョン一括更新スクリプト（`scripts/bump-version.mjs`）
- [ ] コード署名（macOS Notarization・Windows Authenticode）—公開前に実施

## 設計ドキュメント一覧

| ドキュメント | 内容 |
|------------|------|
| [design-index.md](./design-index.md) | 設計ファイル索引・記述ルール（どのファイルに何を書くか）|
| [design-coverage.md](./design-coverage.md) | 設計検討済み項目一覧（✅/🔶/❌ 状態管理）|
| [feature-list.md](./feature-list.md) | 設計書に定義された機能一覧とロードマップ紐づけ（未フェーズ項目を含む）|
| [decision-log.md](./decision-log.md) | 技術選定・アーキテクチャ決定の理由記録（不採用理由・選定根拠）|
| [system-design.md](./system-design.md) | システム全体設計・コアアーキテクチャ原則・技術スタック・Rust バックエンド構成・フロントエンド/バックエンド責務分担 |
| [tauri-ipc-interface.md](../01_Architecture/tauri-ipc-interface.md) | Tauri `invoke()` コマンドのインターフェース定義書（引数・戻り値型の SoT。**新規コマンド追加前に先に記入**） |
| [markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) | Markdown ↔ TipTap 変換設計・サポートマトリクス |
| [tiptap-roundtrip-test-strategy.md](../02_Core_Editor/tiptap-roundtrip-test-strategy.md) | ラウンドトリップテスト詳細戦略 |
| [window-tab-session-design.md](./window-tab-session-design.md) | タブ・セッション・自動保存・クラッシュリカバリ |
| [keyboard-shortcuts.md](./keyboard-shortcuts.md) | キーボードショートカット設計 |
| [image-design.md](../05_Features/Image/image-design.md) | 画像管理・操作・アノテーション設計 |
| [security-design.md](./security-design.md) | セキュリティ設計 |
| [undo-redo-design.md](./undo-redo-design.md) | Undo/Redo 粒度設計 |
| [cross-platform-design.md](./cross-platform-design.md) | クロスプラットフォーム設計方針 |
| [performance-design.md](./performance-design.md) | パフォーマンス設計・仮想スクロール |
| [ai-design.md](../05_Features/AI/ai-design.md) | AI 機能・最適化・テンプレート設計 |
| [user-settings-design.md](./user-settings-design.md) | ユーザー設定・プリファレンス設計 |
| [i18n-design.md](./i18n-design.md) | 国際化（i18n）設計（i18next 基盤・名前空間・OS 言語検出・コーディングルール）|
| [smart-paste-design.md](./smart-paste-design.md) | スマートペースト（HTML → MD 自動変換）設計 |
| [distribution-design.md](./distribution-design.md) | 配布・自動アップデート設計 |
| [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) | フォルダ/ワークスペース管理・ファイル操作設計 |
| [error-handling-design.md](./error-handling-design.md) | エラーハンドリング・診断ログ設計 |
| [export-interop-design.md](../06_Export_Interop/export-interop-design.md) | HTML/PDF エクスポート・Pandoc 連携設計 |
| [theme-design.md](./theme-design.md) | テーマシステム設計（CSS変数・ライト/ダーク・カスタムテーマ）|
| [search-design.md](./search-design.md) | 検索・置換 UX 設計（ファイル内・ワークスペース横断）|
| [plugin-api-design.md](./plugin-api-design.md) | プラグイン API 設計（拡張ポイント・サンドボックス）|
| [accessibility-design.md](./accessibility-design.md) | アクセシビリティ（a11y）設計 |
| [slash-commands-design.md](./slash-commands-design.md) | スラッシュコマンド（`/` 要素挿入）設計 |
| [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) | 双方向リンク（Wikiリンク）・バックリンク・グラフビュー設計 |
| [metadata-query-design.md](../05_Features/metadata-query-design.md) | メタデータクエリエンジン（SQLite スキーマ・クエリ構文・ビュー UI）|
| [split-editor-design.md](./split-editor-design.md) | ペイン分割エディタ（Split Editor）設計 |
| [git-integration-design.md](./git-integration-design.md) | Git / バージョン管理簡易統合設計 |
| [html-editing-design.md](../05_Features/HTML/html-editing-design.md) | HTML WYSIWYG 編集・CSS/パス解決・変換ロス設計 |
| [zen-mode-design.md](./zen-mode-design.md) | 集中モード（Zen Mode）強化設計 |
