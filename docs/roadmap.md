# 開発ロードマップ

> 詳細な実装計画と優先度の一覧。

## Phase 1: MVP（最小実用製品）

基本的なWYSIWYG編集が動作する状態を目指す。

### セットアップ

- [ ] Vite + React + TypeScript プロジェクト初期化
- [ ] ESLint / Prettier 設定
- [ ] Vitest テスト環境
- [ ] Playwright E2Eテスト環境

### コア機能

- [ ] ProseMirror 基本セットアップ
- [ ] マークダウンパーサ統合（remark）
- [ ] ASTシリアライザ（remark-stringify）
- [ ] ファイル読み書き（@tauri-apps/plugin-fs）

### ユーザー設定

詳細設計: [user-settings-design.md](./user-settings-design.md)

- [ ] `AppSettings` 型定義・`DEFAULT_SETTINGS`
- [ ] `settingsStore`（Zustand + plugin-store）
- [ ] プリファレンスダイアログ（外観・エディタ）
- [ ] 設定マイグレーション関数

### スマートペースト

詳細設計: [smart-paste-design.md](./smart-paste-design.md)

- [ ] `htmlToMarkdown()`（turndown + DOMPurify）
- [ ] `SmartPasteExtension`（TipTap プラグイン）
- [ ] `Ctrl+Shift+V` でプレーンテキスト貼り付け

### エラーハンドリング・診断ログ

詳細設計: [error-handling-design.md](./error-handling-design.md)

- [ ] `tauri-plugin-log` 設定
- [ ] `logger` ユーティリティ（フロントエンド）
- [ ] `AppErrorBoundary` / `EditorErrorBoundary`
- [ ] `toastStore`（トースト通知）
- [ ] Tauri コマンドエラー翻訳層
- [ ] パース失敗時のソースモードフォールバック

### タブ・セッション管理

詳細設計: [window-tab-session-design.md](./window-tab-session-design.md)

- [ ] タブバー UI（開く・閉じる・切り替え）
- [ ] Zustand タブストア（`addTab` / `removeTab` / `updateContent` / `markSaved`）
- [ ] タブタイトルへの未保存マーカー表示（`● filename.md`）
- [ ] タイトルバーへの未保存マーカー反映（Rustコマンド経由）
- [ ] タブ閉じる時の未保存確認ダイアログ
- [ ] `onCloseRequested` によるウィンドウクローズ時の未保存ガード
- [ ] セッション保存・復元（@tauri-apps/plugin-store）
- [ ] ファイル関連付け設定（tauri.conf.json の `fileAssociations`）
- [ ] シングルインスタンス制御（tauri-plugin-single-instance）
- [ ] 外部ファイルオープンイベント受信フック（`useFileOpenListener`）

### WYSIWYG要素

- [ ] 見出し（H1〜H6）
- [ ] 段落
- [ ] 太字・斜体・取り消し線
- [ ] インラインコード
- [ ] リンク
- [ ] 引用ブロック
- [ ] 順序なし・順序付きリスト
- [ ] タスクリスト
- [ ] コードブロック（シンタックスハイライト）
- [ ] 水平線
- [ ] ソースモード切替（Ctrl+/）

### オートフォーマット

- [ ] `# ` → 見出し変換
- [ ] `- ` → リスト変換
- [ ] `> ` → 引用変換
- [ ] ` ``` ` → コードブロック変換

### キーボードショートカット

- [ ] Ctrl+B（太字）
- [ ] Ctrl+I（斜体）
- [ ] Ctrl+K（リンク）
- [ ] Ctrl+Z / Ctrl+Shift+Z（Undo/Redo）
- [ ] Ctrl+S（保存）
- [ ] Ctrl+1〜6（見出しレベル）

---

## Phase 2: テーブル編集

Excelライクなテーブル操作を実現する。

- [ ] テーブルのレンダリング
- [ ] Tab / Shift+Tab でセル移動
- [ ] 末尾セルでTabを押すと新行追加
- [ ] 行の追加・削除（コンテキストメニュー）
- [ ] 列の追加・削除（コンテキストメニュー）
- [ ] 行のドラッグ&ドロップ並び替え
- [ ] 列のドラッグ&ドロップ並び替え
- [ ] 列幅のリサイズ（ドラッグ）
- [ ] 列の配置（左/中央/右）
- [ ] テーブルのGUI挿入（行数・列数指定）

---

## Phase 3: リッチ機能

- [ ] 数式（KaTeX）- インライン・ブロック
- [ ] Mermaid 図表
- [ ] 画像ドラッグ&ドロップ
- [ ] クリップボードからの画像貼り付け
- [ ] アウトラインパネル（見出しナビゲーション）
- [ ] 検索（Ctrl+F）
- [ ] 検索・置換（Ctrl+H）
- [ ] クイックオープン（Ctrl+P）

### ワークスペース管理

詳細設計: [workspace-design.md](./workspace-design.md)

- [ ] フォルダを開く（`Ctrl+Shift+O`）
- [ ] ファイルツリーサイドバー
- [ ] 外部ファイル変更の検知と通知
- [ ] クロスファイルリンクのクリックで開く
- [ ] ファイル作成・削除・リネーム（コンテキストメニュー）
- [ ] ワークスペースのセッション保存・復元

### スマートペースト拡張

詳細設計: [smart-paste-design.md](./smart-paste-design.md)

- [ ] `ask` モードの確認バー UI
- [ ] 画像 data-URI の保存連携
- [ ] 数式 LaTeX の Turndown カスタムルール

---

## Phase 4: MD → HTML エクスポート

MarkdownをスタイルつきHTMLファイルとして書き出す機能。

### 変換パイプライン

- [ ] remark-rehype 統合（MD AST → HTML AST）
- [ ] rehype-highlight 統合（コードのシンタックスハイライト）
- [ ] rehype-katex 統合（数式レンダリング）
- [ ] rehype-stringify 統合（HTML文字列生成）
- [ ] HTMLテンプレートエンジン実装
- [ ] juice によるCSS インライン化

### エクスポートオプションUI

- [ ] テーマ選択（GitHub / ドキュメント等）
- [ ] 目次（TOC）の自動生成トグル
- [ ] 数式・図表レンダリングのオン/オフ
- [ ] エクスポートダイアログ
- [ ] メニュー: ファイル → エクスポート → HTMLにエクスポート

### HTMLテーマCSS

- [ ] GitHub Markdownスタイル
- [ ] ドキュメントスタイル（書籍風）
- [ ] プレゼンテーションスタイル（将来）

---

## Phase 5: HTML WYSIWYG 編集

HTMLファイルをMarkdownと同様の直感的な操作で編集する機能。

### 基盤構築

- [ ] rehype-parse 統合（HTML → 内部AST）
- [ ] HTML用内部ASTシリアライザ（内部AST → HTML文字列）
- [ ] ProseMirrorのHTMLスキーマ定義（divブロック、セマンティック要素等）
- [ ] 拡張子による編集モード自動切替（.html → HTMLモード）

### WYSIWYG モード

- [ ] 基本ブロック要素の編集（h1〜h6, p, ul, ol, blockquote, pre, table）
- [ ] 基本インライン要素の編集（strong, em, a, img, code, s）
- [ ] HTML固有インライン要素（mark, span, sup, sub）
- [ ] divブロックの追加・削除・ネスト
- [ ] セマンティック要素（section, article, header, footer, nav）

### ソースコードモード

- [ ] CodeMirrorによるHTMLシンタックスハイライト
- [ ] HTMLオートコンプリート（タグ補完）
- [ ] エラー表示（未閉じタグ等）

### スプリットモード

- [ ] 左：ソースコード / 右：プレビュー の並列表示
- [ ] 同期スクロール
- [ ] モード切替ボタン（WYSIWYG / ソース / スプリット）

### HTML専用ツールバー

- [ ] テキスト色ピッカー（`color`）
- [ ] 背景色ピッカー（`background-color`）
- [ ] フォントサイズ選択
- [ ] テキスト配置（左/中央/右/均等）
- [ ] divブロック挿入

### メタデータ編集パネル

- [ ] `<title>` 編集
- [ ] `<meta name="description">` 編集
- [ ] CSS ファイルリンクの追加・削除
- [ ] JavaScript ファイルリンクの追加・削除

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
- [ ] フォーカスモード
- [ ] タイプライターモード
- [ ] YAML Front Matter 編集UI
- [ ] プラグインAPI
- [ ] ワークスペース高度な機能（詳細設計: [workspace-design.md](./workspace-design.md) §6 §9）
  - [ ] ファイルのドラッグ移動
  - [ ] リネーム・移動時の Markdown リンク自動更新
  - [ ] ワークスペース切り替え（最近使ったワークスペース）

### ウィンドウ管理の拡張

- [ ] 最近使ったファイル（Tauri ネイティブメニュー動的更新）
- [ ] Windows ジャンプリスト登録（`SHAddToRecentDocs`）
- [ ] タブをウィンドウに切り出す機能（WebviewWindow、デスクトップ専用）

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
- [ ] アクセシビリティ（a11y）対応
- [ ] 国際化（i18n）
- [ ] パフォーマンスプロファイリング（計測方法: [performance-design.md §8](./performance-design.md#8-パフォーマンス計測プロファイリング方法)）
- [ ] HTML編集のセキュリティ審査（XSS対策）
- [ ] AIコピーの言語推定精度向上（linguist-languages連携）
- [ ] AIプロバイダ直接連携（OpenAI / Anthropic API）—将来機能
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
| [design-coverage.md](./design-coverage.md) | 設計検討済み項目一覧（索引）|
| [system-design.md](./system-design.md) | システム全体設計・アーキテクチャ |
| [markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) | Markdown ↔ TipTap 変換設計・サポートマトリクス |
| [tiptap-roundtrip-test-strategy.md](./tiptap-roundtrip-test-strategy.md) | ラウンドトリップテスト詳細戦略 |
| [window-tab-session-design.md](./window-tab-session-design.md) | タブ・セッション・自動保存・クラッシュリカバリ |
| [keyboard-shortcuts.md](./keyboard-shortcuts.md) | キーボードショートカット設計 |
| [image-storage-design.md](./image-storage-design.md) | 画像管理・ファイルパス設計 |
| [security-design.md](./security-design.md) | セキュリティ設計 |
| [undo-redo-design.md](./undo-redo-design.md) | Undo/Redo 粒度設計 |
| [cross-platform-design.md](./cross-platform-design.md) | クロスプラットフォーム設計方針 |
| [performance-design.md](./performance-design.md) | パフォーマンス設計・仮想スクロール |
| [ai-features.md](./ai-features.md) | AI機能設計 |
| [user-settings-design.md](./user-settings-design.md) | ユーザー設定・プリファレンス設計 |
| [smart-paste-design.md](./smart-paste-design.md) | スマートペースト（HTML → MD 自動変換）設計 |
| [distribution-design.md](./distribution-design.md) | 配布・自動アップデート設計 |
| [workspace-design.md](./workspace-design.md) | フォルダ/ワークスペース管理設計 |
| [error-handling-design.md](./error-handling-design.md) | エラーハンドリング・診断ログ設計 |
