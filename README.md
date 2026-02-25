# Markdown / HTML Editor - AI時代のWYSIWYGエディタ

## プロジェクトの目的

このプロジェクトは、マークダウンファイルおよびHTMLファイルを **直感的に編集・変換できる WYSIWYG エディタ** の開発を目指しています。

操作感の目標として [Typora](https://typora.io/) を参考にしており、マークダウンの記法を意識させることなく、書いた内容がリアルタイムにレンダリングされ、視覚的に確認しながら編集できる体験を提供します。

さらに、生成AIの普及を踏まえ、**Markdownを「AIへのインプット」として最大限活用する機能**を標準搭載します。
「書く」「変換する」「AIに渡す」を一つのエディタで完結させます。

### 解決したい課題

- 従来のマークダウンエディタは「ソースコードを書く感覚」が強く、非エンジニアには敷居が高い
- プレビュー/編集の二画面分割は画面スペースを消費し、直感的でない
- テーブル編集がコードベースで煩雑（ExcelのようなUI操作ができない）
- Markdown から HTML へのエクスポートが別ツール頼みになりがち
- HTMLファイルを直接編集する場合、専用の重量級ツールが必要
- ChatGPT / Claude に渡すMarkdownの構造が不明瞭でAIの精度が落ちる
- プロンプト作成のベストプラクティスを知らないと効果的に使えない

### 目指す価値

| 価値 | 説明 |
|------|------|
| **シームレス編集** | マークダウン記法とレンダリングを意識させないリアルタイムWYSIWYG |
| **直感的テーブル操作** | Excelライクな行・列追加/削除/並び替え |
| **MD ↔ HTML 変換** | マークダウンとHTMLをワンクリックで相互変換 |
| **HTML WYSIWYG** | HTMLファイルもMarkdownと同じ感覚で直感的に編集 |
| **AIコピー** | 文章をAIが最も理解しやすい構造に自動調整してクリップボードへ |
| **AIテンプレート** | ブログ構成・コード解説・要約など即使えるプロンプトを標準搭載 |
| **低学習コスト** | マークダウンやプロンプト記法を知らなくても使える |
| **ポータブル** | 出力はピュアなMarkdown / HTML（ベンダーロックインなし） |
| **高速動作** | 大きなファイルでも軽快に動作 |

---

## アーキテクチャ概要

### コア原則

| 原則 | 説明 |
|------|------|
| **完全な双方向変換（ロスレス）** | Markdown ↔ TipTap JSON 間でロスレスなラウンドトリップ変換を実現 |
| **ローカル・オフラインファースト** | 外部サーバーに依存せず、全データをローカルで処理・完結 |
| **フロントエンド/バックエンドの責務分離** | UI（React + TipTap）とシステム操作（Rust: ファイル I/O、SQLite、外部 API）を Tauri IPC で分離 |
| **適材適所のマルチエンジン構成** | WYSIWYG には TipTap、ソースモードには CodeMirror 6 |

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップ基盤 | **Tauri 2.0**（Rust） — Windows / macOS / Linux / Android / iOS |
| フロントエンド | **React + TypeScript + Vite** |
| エディタエンジン | **TipTap**（ProseMirror）+ **CodeMirror 6** |
| 状態管理 | **Zustand** |
| メタデータ DB | **SQLite**（Rust 側 rusqlite） |
| スタイル | **Tailwind CSS** |
| テスト | **Vitest + Playwright** |

---

## 主要機能

### AI連携機能

#### AIコピーボタン
ツールバーの **[AIコピー]** をクリックすると、以下を自動実行してクリップボードへコピーします。

| 変換処理 | 内容 |
|---------|------|
| 見出し階層修正 | H1→H4の飛びを補正し、LLMが構造を読みやすくする |
| コード言語タグ付与 | 無タグのコードブロックに言語を推定して付与 |
| リスト記号統一 | `*` `+` を `-` に統一 |
| 空白行削減 | 連続空行を最大1行に削減（トークン節約） |
| プロンプト構造診断 | 役割・タスク・制約・出力形式の不足を警告 |

#### AIテンプレート（標準搭載）

サイドバーの **[AI テンプレート]** から選択して即使えるプロンプト集です。

| カテゴリ | テンプレート | 概要 |
|---------|------------|------|
| ブログ | ブログ構成案 | 記事タイトル・章立て・キーポイントを生成 |
| コード | Pythonコード解説 | コードの動作・意図・改善点を説明させる |
| コード | コードレビュー依頼 | バグ・品質・セキュリティをレビューさせる |
| 要約 | 要約用プロンプト | 長文を指定フォーマットで要約させる |
| 推論 | 思考の連鎖（CoT） | ステップバイステップで問題を解かせる |
| 議事録 | 会議メモ整形 | 箇条書きメモを構造化された議事録に変換 |

### Markdown 編集（WYSIWYG）

- フォーカス時にソース記法を表示、非フォーカス時にレンダリング表示（Typora式）
- 見出し・段落・リスト・引用・テーブル・コードブロック・数式・図表
- 入力ルール（`# ` を入力すると自動的に見出しへ変換）
- Excelライクなテーブル編集（行・列のDnD、リサイズ、セル配置）
- 4モード切り替え: Typora式 / 常にWYSIWYG / ソース表示 / サイドバイサイド
- 3MB以上 / 3,000ノード以上のファイルはソースモードに自動フォールバック

### HTML 編集（WYSIWYG）

- HTMLファイルを同じ直感的なインターフェースで編集
- WYSIWYGモード / ソースコードモード / スプリットモード
- 文字色・背景色・フォントサイズ等のリッチなスタイル編集
- divブロックによるレイアウト構成
- `<head>` メタデータの GUI 編集

### 変換・エクスポート

| 変換方向 | 内容 |
|---------|------|
| Markdown → HTML エクスポート | スタイル付きスタンドアロンHTMLファイルを生成 |
| Markdown → HTML（編集用） | HTMLエディタモードで続けて編集可能 |
| HTML → Markdown 変換 | HTMLコンテンツをMarkdownに変換（ロス警告つき） |
| → PDF エクスポート | 印刷品質のPDF出力 |
| → Word / LaTeX / epub | Pandoc 連携によるエクスポート |

---

## プロジェクト構成

### プロジェクトルート

```
/
├── README.md                      # このファイル
├── CLAUDE.md                      # AI エージェント向け作業ガイド
├── package.json                   # Node パッケージ管理
├── tsconfig.json                  # TypeScript 設定
├── vite.config.ts                 # Vite ビルド設定
├── docs/                          # 設計ドキュメント
├── src/                           # フロントエンド（React / TypeScript）
├── src-tauri/                     # バックエンド（Rust / Tauri）
└── public/                        # 静的アセット
```

### フロントエンド (src/)

```
src/
├── core/                          # エディタコアロジック
│   ├── document/                  # AST 型定義・ドキュメント操作
│   ├── parser/                    # Markdown / HTML パーサ
│   ├── converter/                 # mdast ↔ TipTap JSON 変換
│   ├── commands/                  # テキスト・ブロック・テーブル操作コマンド
│   ├── history/                   # Undo/Redo
│   └── editor.ts                  # エントリポイント
│
├── renderer/                      # レンダリングエンジン
│   ├── wysiwyg/                   # TipTap / ProseMirror セットアップ
│   │   ├── node-views/            # 各ブロックの WYSIWYG ビュー
│   │   └── plugins/               # 入力ルール・キーバインディング
│   ├── html/                      # HTML 編集モード
│   └── source/                    # ソースモード（CodeMirror 6）
│
├── components/                    # UI コンポーネント（React）
│   ├── Editor/                    # エディタ・ツールバー・ステータスバー
│   ├── Sidebar/                   # サイドバー・ファイルツリー・アウトライン
│   ├── Table/                     # テーブル編集 UI
│   └── common/                    # モーダル・コンテキストメニュー等
│
├── plugins/                       # プラグインシステム
│   ├── plugin-api.ts              # プラグイン API 定義
│   ├── plugin-manager.ts          # プラグイン管理
│   └── built-in/                  # ビルトインプラグイン（Mermaid・KaTeX・画像）
│
├── store/                         # Zustand グローバル状態管理
│   ├── settingsStore.ts           # ユーザー設定
│   └── tabStore.ts                # タブ・セッション管理
│
├── file/                          # ファイル管理・エクスポート
├── hooks/                         # React カスタムフック
├── menu/                          # Tauri ネイティブメニュー
├── themes/                        # テーマ CSS
├── i18n/                          # 国際化（i18next）
├── types/                         # TypeScript 型定義
├── utils/                         # ユーティリティ
└── app.tsx                        # アプリケーションエントリポイント
```

### バックエンド (src-tauri/)

```
src-tauri/
├── Cargo.toml                    # Rust パッケージ設定
├── tauri.conf.json               # Tauri システム設定（CSP 等）
├── capabilities/
│   └── default.json              # Tauri Capabilities（FS スコープ・権限）
│
└── src/
    ├── main.rs                   # Tauri アプリケーションセットアップ
    ├── commands/                 # IPC エンドポイント（invoke() で呼ばれる）
    │   ├── fs_commands.rs        # ファイル読み書き・排他制御
    │   ├── db_commands.rs        # SQLite メタデータクエリ
    │   ├── ai_commands.rs        # 外部 AI API プロキシ（APIキー隠蔽）
    │   └── window_commands.rs    # ウィンドウ管理
    ├── db/                       # SQLite 連携（rusqlite）
    ├── fs/                       # ファイル変更監視・Front Matter 解析
    ├── menu/                     # OS ネイティブメニュー
    └── models/                   # データ構造体（serde）
```

### 静的アセット (public/)

```
public/
├── icons/                        # アプリアイコン群
├── mermaid-sandbox.html          # Mermaid レンダリング用サンドボックス
└── plugin-runtime.html           # サードパーティプラグイン隔離用（Phase 7）
```

---

## 設計ドキュメント

設計ドキュメントは `docs/` 以下に体系的に整理されています。

```
docs/
├── 00_Meta/              # プロジェクト管理・索引
├── 01_Architecture/      # 横断的アーキテクチャ設計
├── 02_Core_Editor/       # エディタエンジン（AST 変換・テキスト処理）
├── 03_UI_UX/             # UI コンポーネント・操作性・テーマ
├── 04_File_Workspace/    # ファイル I/O・ワークスペース・セッション
├── 05_Features/          # 機能別設計（AI / HTML / Image）
├── 06_Export_Interop/    # エクスポート・外部ツール連携
├── 07_Platform_Settings/ # プラットフォーム・設定・配布
└── 08_Testing_Quality/   # テスト戦略・エラーハンドリング
```

### 主要ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [design-index.md](./docs/00_Meta/design-index.md) | 設計ファイル索引（どのファイルに何を書くか） |
| [design-coverage.md](./docs/00_Meta/design-coverage.md) | 設計検討済み項目一覧（✅/🔶/❌） |
| [roadmap.md](./docs/00_Meta/roadmap.md) | 開発ロードマップ（Phase 1〜8） |
| [system-design.md](./docs/01_Architecture/system-design.md) | システム全体設計・コア原則・技術スタック・ディレクトリ構成 |
| [security-design.md](./docs/01_Architecture/security-design.md) | セキュリティ設計（XSS・CSP・fsスコープ・AI API通信） |
| [performance-design.md](./docs/01_Architecture/performance-design.md) | パフォーマンス設計（仮想スクロール・非同期パース） |
| [plugin-api-design.md](./docs/01_Architecture/plugin-api-design.md) | プラグインAPI・サンドボックス設計 |
| [markdown-tiptap-conversion.md](./docs/02_Core_Editor/markdown-tiptap-conversion.md) | Markdown ↔ TipTap 双方向変換設計 |

---

## ライセンス

TBD
