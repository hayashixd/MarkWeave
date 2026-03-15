# MarkWeave

**Write. Polish. Publish.**
Webで文章を書いて公開する人のための、ローカルファーストWYSIWYGエディタ。

> **現在の開発フェーズ:** v1 beta（Windows / Linux 対応。macOS 版は後日対応予定）

---

## これは何か

MarkWeaveは、**Markdownで書いた文章をそのまま公開用に整えて出せる**デスクトップエディタです。

Typora のような書き心地で書き、Zenn・Qiita・dev.to・Ghost・note.mu など各プラットフォーム向けに整形されたHTMLやMarkdownを出力します。コピペで崩れない。公開先に合わせて出せる。それが MarkWeave の核心です。

---

## 誰のためのツールか

### v1 ターゲット（今すぐ使える）

**Markdownで技術記事・ブログ記事を書いて、Zenn / Qiita / dev.to / Hashnode に公開するエンジニア・テクニカルライター**

- Markdown を知っている
- WYSIWYG で書きたい（VS Code のソース編集には疲れた）
- コードブロック・図表・数式を扱う
- ローカルにファイルを持ちたい
- 良いツールには $20〜$30 を払える

### v1.5 以降のターゲット（Ghost 連携が整ったあと）

Ghost / Substack / note.mu で発信する人（HTML公開ワークフローが必要な層）

---

## 主な機能

### 書く

| 機能 | 説明 |
|------|------|
| WYSIWYG Markdown 編集 | Typora 式のリアルタイムレンダリング。記法を意識しない |
| コードブロック | シンタックスハイライト付き。言語バッジ・コピーボタン |
| Mermaid 図表 | フローチャート等をコードで書いてその場で表示 |
| KaTeX 数式 | `$...$` / `$$...$$` でインライン・ブロック数式 |
| テーブル編集 | Excel ライクな行・列の追加/削除/並び替え/リサイズ |
| YAML Front Matter | 投稿メタデータ（title / tags / date 等）を折りたたみパネルで管理 |
| スラッシュコマンド | `/` で見出し・コード・テーブル・テンプレートを素早く挿入 |

### 整える

| 機能 | 説明 |
|------|------|
| 検索・置換 | ファイル内検索、正規表現対応 |
| 文書統計 | 文字数・単語数・読了時間・可読性スコア（漢字率） |
| Markdown Lint | 見出しレベル飛び・リンク切れ等の検査 |
| AI 整形アシスト | 選択テキストの改善・翻訳・要約（要 Claude API キー） |
| テーマ | 8 種のテーマ（ライト/ダーク/GitHub 等）、カスタマイズ可能 |
| Zen モード | フルスクリーン + UI 非表示 + 環境音 + 打鍵音 |
| ポモドーロ / ワードスプリント | 執筆セッションの集中管理 |

### 公開する

| 機能 | 説明 |
|------|------|
| HTML エクスポート | プラットフォーム別テンプレート。コピペで崩れないクリーン HTML |
| PDF エクスポート | 印刷・配布用 |
| Word エクスポート | Pandoc 経由で .docx 生成 |
| EPUB エクスポート | 電子書籍形式 |
| Markdown 書き出し | Zenn / Qiita 向け整形済み Markdown |
| スマートペースト | Web からコピーした HTML を Markdown に自動変換 |

---

## やらないこと（Won't do）

明確に対象外とする機能を宣言します。これが長期の保守品質を保つための判断です。

| 機能 | 理由 |
|------|------|
| クラウド同期 | 運用コストが発生する。iCloud / Dropbox / OneDrive のフォルダをワークスペースとして使えば代替できる |
| リアルタイム共同編集 | サーバーインフラが必要 |
| 画像アノテーション機能の拡充 | 独立ツール級の実装量。本筋に無関係 |
| PKM グラフビューの改善 | コンテンツ公開ワークフローと無関係 |
| Git パネルの改善 | v1 ターゲットユーザーには不要 |
| AI サービスの自前提供 | API コストが発生する。ユーザーが自分のキーを持参（BYOK）する形で提供 |

---

## プラットフォーム対応

| OS | v1 | 予定 |
|----|-----|------|
| Windows | ✅ | — |
| Linux | ✅ | — |
| macOS | — | 後日対応（開発者の動作確認環境が現在ない） |

> **macOS をお使いの方へ:** macOS 版は開発予定ですが、動作確認環境の都合から v1 では提供できません。対応時期は未定です。
>
> **同期について:** MarkWeave はファイルをローカルに保存します。iCloud Drive / Dropbox / OneDrive のフォルダをワークスペースとして開けば、デバイス間の同期はOS側で自動的に行われます。

---

## 価格

| プラン | 価格 | 内容 |
|--------|------|------|
| **試用版** | 無料 | 全機能を一定期間試用可能 |
| **買い切りライセンス** | $24.99（予定） | 永続ライセンス、3デバイスまで |

サブスクリプションはありません。一度買えばずっと使えます。
クラウドサービスに依存しないため、サービス終了リスクがありません。

---

## セットアップと実行方法

### 必要な環境

| ツール | バージョン | 用途 |
|--------|-----------|------|
| [Node.js](https://nodejs.org/) | 20 以上 | フロントエンドビルド |
| [pnpm](https://pnpm.io/) | 9 以上 | パッケージ管理 |
| [Rust](https://rustup.rs/) | 1.77.2 以上 | Tauri バックエンド |
| [Tauri 前提条件](https://v2.tauri.app/start/prerequisites/) | — | OS ごとの依存ライブラリ |

> **Linux の場合:** `webkit2gtk`・`libayatana-appindicator3` 等が必要です。詳細は [Tauri 公式ドキュメント](https://v2.tauri.app/start/prerequisites/#linux) を参照してください。

### インストール

```bash
git clone <repository-url>
cd markweave
pnpm install
```

### 開発サーバーの起動

```bash
# フロントエンドのみ（ブラウザで確認）
pnpm dev

# Tauri デスクトップアプリとして起動（推奨）
pnpm tauri dev
```

> `pnpm dev` はブラウザで `http://localhost:1420` に表示されますが、Tauri API（ファイル読み書き等）はブラウザモードでは動作しません。

### ビルド（本番用）

```bash
pnpm tauri build
```

インストーラーが `src-tauri/target/release/bundle/` に生成されます。

---

## テスト

```bash
# ユニットテスト
npm run test

# Markdown ↔ TipTap ラウンドトリップテスト
npm run test:roundtrip

# Rust バックエンドテスト
cd src-tauri && cargo test

# E2E テスト
npm run test:e2e
```

---

## プロジェクト構成

### フロントエンド (src/)

```
src/
├── ai/                            # AI コピー・テンプレートシステム
├── components/
│   ├── editor/                    # TipTap エディタ・HTML エディタ
│   ├── Export/                    # エクスポート UI
│   ├── Outline/                   # アウトラインパネル
│   ├── sidebar/                   # サイドバー（ファイルツリー等）
│   ├── tabs/                      # タブバー
│   ├── preferences/               # 設定ダイアログ
│   └── layout/                    # AppShell
├── extensions/                    # TipTap カスタム拡張
├── store/                         # Zustand 状態管理
├── lib/                           # Markdown ↔ TipTap 変換
├── themes/                        # テーマ CSS
├── i18n/                          # 国際化（i18next）
└── hooks/                         # React カスタムフック
```

### バックエンド (src-tauri/)

```
src-tauri/src/
├── commands/                      # IPC エンドポイント
│   ├── fs_commands.rs             # ファイル読み書き
│   ├── db_commands.rs             # SQLite メタデータ
│   └── window_commands.rs         # ウィンドウ管理
├── db/                            # SQLite 連携
├── fs/                            # ファイル変更監視
├── menu/                          # OS ネイティブメニュー
└── models/                        # データ構造体
```

---

## 設計ドキュメント

```
docs/
├── 00_Meta/              # プロジェクト管理・ロードマップ
├── 01_Architecture/      # システム設計・パフォーマンス・セキュリティ
├── 02_Core_Editor/       # エディタエンジン（AST 変換）
├── 03_UI_UX/             # UI・操作性・テーマ・アクセシビリティ
├── 04_File_Workspace/    # ファイル I/O・タブ・セッション
├── 05_Features/          # 機能別設計（AI / HTML / Image）
├── 06_Export_Interop/    # エクスポート・外部連携
├── 07_Platform_Settings/ # 配布・設定・i18n
└── 08_Testing_Quality/   # テスト戦略
```

主要ドキュメント:

| ドキュメント | 内容 |
|------------|------|
| [feature-list.md](./docs/00_Meta/feature-list.md) | 総合機能一覧・ロードマップ（SoT） |
| [design-index.md](./docs/00_Meta/design-index.md) | 設計ファイル索引 |
| [system-design.md](./docs/01_Architecture/system-design.md) | システム全体設計 |
| [performance-design.md](./docs/01_Architecture/performance-design.md) | パフォーマンス設計 |
| [security-design.md](./docs/01_Architecture/security-design.md) | セキュリティ設計 |

---

## ライセンス

TBD
