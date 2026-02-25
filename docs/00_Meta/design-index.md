# 設計ドキュメント索引

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> 更新日: 2026-02-25
>
> **用途**: 設計情報を追加・変更する際に「どのファイルに何を書くか」を判断するための索引。
> 新規ドキュメント作成前に必ず参照すること。

---

## ディレクトリ構成の全体像

```
docs/
├── 00_Meta/           プロジェクト管理・索引（実装コードに対応しない）
├── 01_Architecture/   システム全体を横断するアーキテクチャ・基盤設計
├── 02_Core_Editor/    エディタエンジンの中核（AST変換・テキスト処理）
├── 03_UI_UX/          UI コンポーネント・UX 設計・テーマ・アクセシビリティ
├── 04_File_Workspace/ ファイル I/O・ワークスペース・セッション管理
├── 05_Features/       各機能領域の設計（サブディレクトリあり）
│   ├── AI/            AI コピー・テンプレートシステム
│   ├── HTML/          HTML WYSIWYG 編集
│   └── Image/         画像管理・操作・アノテーション
├── 06_Export_Interop/ エクスポート・外部ツール連携・インポート
├── 07_Platform_Settings/ プラットフォーム対応・ユーザー設定・配布
└── 08_Testing_Quality/   テスト戦略・品質・エラーハンドリング
```

---

## 00_Meta — プロジェクト管理

**目的**: 設計ドキュメント群そのものを管理するメタ情報。実装には直接対応しない。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `design-index.md` | **このファイル**。全ファイルの索引と記述ルール | ファイル追加時に索引を更新する |
| `design-coverage.md` | 設計トピック網羅状況（✅/🔶/❌）の索引 | 新トピックの設計完了・着手時に状態を更新する |
| `roadmap.md` | フェーズ別実装タスクリストと設計ドキュメント一覧 | フェーズタスクの追加・完了、新ドキュメント登録 |
| `typora-analysis.md` | Typora の機能・UX 分析（参照専用） | Typora の新機能調査・比較結果 |

---

## 01_Architecture — アーキテクチャ・基盤

**目的**: アプリ全体に影響するシステム設計。特定機能ではなく横断的な関心事。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `system-design.md` | 全体アーキテクチャ・技術スタック・フェーズ概要・モード切替 | ContentEditable 構造、AST フロー、Tauri コマンド一覧、Phase 定義 |
| `security-design.md` | XSS 対策・CSP・`plugin-fs` スコープ・スクリプト分離・署名 | 新規 Tauri Capability 追加時、CSP ルール変更、新セキュリティリスク発生時 |
| `performance-design.md` | パフォーマンスバジェット・仮想スクロール・インクリメンタルパース・メモリ管理 | 新たなパフォーマンス問題の分析結果、ベンチマーク基準変更 |
| `plugin-api-design.md` | プラグイン API 型定義・サンドボックス設計・ライフサイクル・配布 | 新拡張ポイント追加、API バージョン変更、プラグイン権限追加 |

> **ここに書くべき判断基準**: 「1 つの機能だけでなく複数機能に影響する仕組みか？」→ YES なら 01_Architecture。

---

## 02_Core_Editor — エディタエンジン中核

**目的**: TipTap/ProseMirror の AST 変換、テキスト処理アルゴリズム。エディタの「頭脳」部分。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `markdown-tiptap-conversion.md` | Markdown ↔ TipTap JSON 変換設計・サポート要素マトリクス | 新 Markdown 要素（ノードタイプ）のパース/シリアライズ仕様 |
| `tiptap-roundtrip-test-strategy.md` | ラウンドトリップテスト（MD→TipTap→MD が等価か）の詳細戦略 | テストケース追加・変換バグの再現手順 |
| `undo-redo-design.md` | TipTap 履歴プラグイン設計・Undo 粒度・モード間履歴 | Undo 粒度変更、特殊操作（画像貼り付け等）の Undo 設計 |
| `markdown-extensions-design.md` | Markdown 拡張記法（脚注・ハイライト・カスタムコンテナ等）の WYSIWYG 設計 | 新拡張記法サポート時の NodeView・変換仕様 |
| `text-statistics-design.md` | 文字数/単語数カウント・読了時間・スペルチェック・CJK 入力最適化 | 新言語対応、カウントアルゴリズム変更 |

> **ここに書くべき判断基準**: 「ProseMirror/TipTap の Node/Mark/Plugin に関わるか？ テキスト変換アルゴリズムか？」→ YES なら 02_Core_Editor。

---

## 03_UI_UX — UI コンポーネント・UX 設計

**目的**: 見た目・操作性に関わる設計。ユーザーが直接触れる部分。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `app-shell-design.md` | ツールバー・メニューバー・コンテキストメニュー・ステータスバー・コマンドパレット・サイドバー・初回起動 | 新 UI 領域の追加（ボタン・メニュー項目）、初回起動フロー変更 |
| `editor-ux-design.md` | YAML Front Matter 編集・数式プレビュー・アウトライン・クイックオープン・コードブロック補助 UI・画像リサイズ・リンク操作・ドラッグ&ドロップ・スプリットビュースクロール | エディタ内の細かい UX 改善設計 |
| `keyboard-shortcuts.md` | 全ショートカット一覧・OS 間競合・カスタマイズ設計・IME ガード | 新ショートカット追加、OS 間競合解消、ユーザーカスタマイズ仕様 |
| `theme-design.md` | CSS Custom Properties 体系・3 層テーマ・ライト/ダーク・カスタムテーマ・フォントスタック | 新テーマ変数追加、プラットフォーム別フォント変更 |
| `accessibility-design.md` | ARIA ロール・カスタム NodeView の a11y・roving tabindex・フォーカス管理・ライブリージョン・WCAG コントラスト・a11y テスト | ARIA 設計変更、スクリーンリーダー対応追加 |
| `split-editor-design.md` | ペイン分割レイアウト・スプリッタリサイズ・ペイン間フォーカス・タブ操作・セッション保存 | 分割モード数の拡張（3 分割等）、同期スクロール仕様変更 |
| `zen-mode-design.md` | Zen モード（フルスクリーン+UI 非表示）・環境音・打鍵音・タイプライターモード・フォーカスモード | Zen モード設定項目追加、新サウンド追加 |

> **ここに書くべき判断基準**: 「React コンポーネントとして実装され、ユーザーが目で見て操作するものか？」→ YES なら 03_UI_UX。ただし特定機能専用 UI（HTML ツールバー等）は機能側（05_Features）に書く。

---

## 04_File_Workspace — ファイル I/O・ワークスペース

**目的**: ファイルシステムとのやり取り全般。開く・保存・ワークスペース・セッション管理。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `file-workspace-design.md` | ワークスペース（フォルダ開く・ファイルツリー・外部変更検知・クロスファイルリンク）と ファイル操作（新規作成・エンコーディング・改行コード・削除・バックアップ・印刷・ドロップオープン）を統合した設計 | ワークスペース機能拡張、新ファイル操作追加、エンコーディング対応言語追加 |
| `window-tab-session-design.md` | タブ管理・セッション保存/復元・自動保存・未保存マーカー・ファイル関連付け・クラッシュリカバリ | タブ操作 UX 変更、セッション復元仕様変更、クラッシュリカバリ強化 |

> **ここに書くべき判断基準**: 「`@tauri-apps/plugin-fs`・`watch` API・Rust の `fs`/`trash` クレートに関わるか？ ファイルやセッションの永続化か？」→ YES なら 04_File_Workspace。

---

## 05_Features — 機能別設計

**目的**: 個別機能ドメインの設計。サブディレクトリで機能グループを分ける。

### ルート直下のファイル

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `slash-commands-design.md` | `/` による要素挿入コマンド（ポップアップ・ファジーフィルタ・コマンド定義） | 新コマンド追加、コマンドカテゴリ変更 |
| `wikilinks-backlinks-design.md` | `[[...]]` 記法・オートコンプリート・インデックス・バックリンクパネル・リネーム時自動更新・グラフビュー可視化 | Wikiリンク記法拡張（エイリアス等）、インデックス戦略変更、グラフレイアウト変更 |
| `git-integration-design.md` | Git 状態バッジ・エディタガター差分・Git パネル・コミット UI・コミット履歴・Rust `git2` バックエンド | Git 操作機能追加（push/pull UI 等）、差分表示の変更 |
| `search-design.md` | ファイル内検索・置換・ワークスペース横断全文検索・検索オプション・パフォーマンス | 検索 UI 変更、新オプション追加（インデックス導入等） |
| `metadata-query-design.md` | SQLite メタデータインデックス（frontmatter/tags/tasks/links）・クエリ構文・SQLite 変換・テーブル/リスト/カレンダービュー | クエリ構文拡張、新ビュー追加、スキーマ変更 |

### AI/ サブディレクトリ

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `ai-design.md` | AI コピーボタン（最適化パイプライン・RTICCO 構造解析・言語推定）とテンプレートシステム（登録・検索・永続化・管理 UI）を統合した設計 | 新最適化ステップ追加、テンプレート種別追加、AI プロバイダー連携 |

### HTML/ サブディレクトリ

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `html-editing-design.md` | HTML WYSIWYG 編集（3 モード・対応要素・双方向変換・内部 AST）と詳細設計（CSS 編集・パス解決・変換ロス許容範囲・JS/iframe セキュリティ）を統合した設計 | HTML 対応要素の追加・変更、セキュリティポリシー変更、変換ロス許容範囲の改定 |

### Image/ サブディレクトリ

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `image-design.md` | 画像保存先モード・命名・重複排除・外部 URL キャッシュ・クリップボード貼り付け・最適化・alt テキストと アノテーション（Canvas ツール・Undo・保存）を統合した設計 | 新保存モード追加、画像フォーマット対応追加、新アノテーションツール追加 |

> **05_Features にファイルを追加するタイミング**: 新機能がサブドメインとして独立（例: 新たに「グラフ描画機能」を追加）した場合、`05_Features/Graph/graph-design.md` のように新サブディレクトリを作る。単一機能の小規模拡張は既存ファイルへの追記で対応する。

---

## 06_Export_Interop — エクスポート・外部連携

**目的**: エディタから外部への出力・外部からの入力。ファイル変換・外部ツール連携。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `export-interop-design.md` | HTML エクスポート（パイプライン・テーマ CSS・PDF・オプション UI）と Pandoc 連携（Word/LaTeX/epub・パス検出・バージョン互換）を統合した設計 | 新エクスポート形式追加（例: Markdown→DOCX 直接変換）、Pandoc バージョン対応表更新 |
| `smart-paste-design.md` | クリップボードからの HTML ペースト時の自動 Markdown 変換（turndown・DOMPurify・確認バー） | ペースト変換ルール変更、新コンテンツタイプ対応 |

---

## 07_Platform_Settings — プラットフォーム・設定・配布

**目的**: OS ごとの差異吸収、ユーザー設定、アプリ配布。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `user-settings-design.md` | `AppSettings` 型定義・設定 UI・`settingsStore`・設定マイグレーション | 新設定項目追加、設定 UI 変更、マイグレーション関数追加 |
| `i18n-design.md` | 多言語対応（i18n）設計・i18next 初期化・名前空間構造・OS 言語検出・Tauri ネイティブメニュー対応・コーディングルール | 新言語追加、名前空間追加、OS 言語検出ロジック変更 |
| `cross-platform-design.md` | Windows/macOS/Linux/Android/iOS の対応方針・フォントフォールバック・CI 設定・エンコーディング検出制約 | 新 OS バージョン対応、プラットフォーム固有バグの対処方針 |
| `mobile-advanced-design.md` | ソフトキーボード対応・Android SAF 統合・iCloud Drive 連携 | モバイル固有の新機能設計 |
| `distribution-design.md` | GitHub Actions リリース・tauri-plugin-updater・コード署名・バージョン管理スクリプト | リリースフロー変更、署名方法変更 |
| `community-design.md` | ライセンス・プライバシー/テレメトリー・クラッシュレポート・フィードバック UI | プライバシーポリシー変更、フィードバック収集方法変更 |

---

## 08_Testing_Quality — テスト・品質・エラーハンドリング

**目的**: テスト戦略・品質保証・エラーハンドリング設計。

| ファイル | 役割 | 追記すべき情報 |
|---------|------|--------------|
| `testing-strategy-design.md` | UI コンポーネントテスト・E2E テスト（Playwright + tauri-driver）・パフォーマンス回帰テスト・セキュリティテスト | 新テストシナリオ追加、テストフレームワーク変更 |
| `error-handling-design.md` | `tauri-plugin-log` 設定・`logger` ユーティリティ・Error Boundary・トースト通知・Tauri コマンドエラー翻訳 | 新エラーケース追加、ログレベル変更 |

---

## 新規ドキュメントを追加してよい条件

以下の **すべて** を満たす場合のみ、新規ファイルを作成する。
それ以外は既存ファイルへの追記で対応する。

| 条件 | 説明 |
|------|------|
| **独立したドメイン** | 他のファイルに含まれる概念と明確に分離できる機能領域である |
| **十分なボリューム** | 設計内容が 5 セクション以上（または 200 行以上）になる見込みがある |
| **既存ファイルに収まらない** | 追記すると既存ファイルの主題が曖昧になる |

### 新規ファイル作成時の手順

1. このファイル（`design-index.md`）の該当ディレクトリ表に行を追加する
2. `design-coverage.md` に新トピックの行を追加する（状態: ✅）
3. `roadmap.md` の「設計ドキュメント一覧」テーブルに追加する
4. 適切なディレクトリに `<topic>-design.md` として配置する

---

## トピック → ファイル クイックガイド

よく迷うトピックの記述先を示す。

| トピック | 記述先 |
|---------|--------|
| 新しい Markdown 記法（NodeView・変換規則） | `02_Core_Editor/markdown-extensions-design.md` |
| 新しいキーボードショートカット | `03_UI_UX/keyboard-shortcuts.md` |
| 新しいツールバーボタン・メニュー項目 | `03_UI_UX/app-shell-design.md` |
| エディタ内の細かい UX 改善 | `03_UI_UX/editor-ux-design.md` |
| 矩形選択・テキスト整形・行ブックマーク・単語補完 | `03_UI_UX/editor-ux-design.md` §11〜§14 |
| エンコーディング Reload / Convert UI | `04_File_Workspace/file-workspace-design.md` §10.3 |
| 改行コード Convert and Save / Change Setting UI | `04_File_Workspace/file-workspace-design.md` §11.3 |
| 新しい Tauri Capability・CSP ルール | `01_Architecture/security-design.md` |
| 新しい Tauri Capability・ファイルアクセス | `04_File_Workspace/file-workspace-design.md` |
| 新しいユーザー設定項目（`AppSettings`） | `07_Platform_Settings/user-settings-design.md` |
| 多言語対応・i18n・言語切り替え設定 | `07_Platform_Settings/i18n-design.md` |
| 新しいエクスポート形式（Pandoc 以外） | `06_Export_Interop/export-interop-design.md` |
| 新しい画像処理・フォーマット | `05_Features/Image/image-design.md` |
| 新しい AI 最適化ステップ・テンプレート | `05_Features/AI/ai-design.md` |
| HTML 対応要素の追加 | `05_Features/HTML/html-editing-design.md` |
| パフォーマンス改善の設計 | `01_Architecture/performance-design.md` |
| 新プラグイン拡張ポイント・プラグイン設定 GUI | `01_Architecture/plugin-api-design.md` |
| メタデータクエリ・SQLite スキーマ変更 | `05_Features/metadata-query-design.md` |
| グラフビュー・リンクグラフ可視化 | `05_Features/wikilinks-backlinks-design.md` §11 |
| テーマカスタマイザー GUI・CSS 変数オーバーライド | `03_UI_UX/theme-design.md` §5.4〜§5.9 |
| 新 OS・モバイルプラットフォーム対応 | `07_Platform_Settings/cross-platform-design.md` |
| モバイル固有機能（SAF・iCloud等） | `07_Platform_Settings/mobile-advanced-design.md` |
| 新テストシナリオ・テスト方針変更 | `08_Testing_Quality/testing-strategy-design.md` |
| ラウンドトリップテストケース追加 | `02_Core_Editor/tiptap-roundtrip-test-strategy.md` |
| エラーハンドリング・ログ方針変更 | `08_Testing_Quality/error-handling-design.md` |
