# MarkWeave

> **Write. Polish. Publish.**
> Markdown で技術記事を書いて、Zenn / Qiita / dev.to にそのまま公開できる
> ローカルファースト WYSIWYG エディタ。

Windows / Linux 対応 · ローカルファースト · 買い切り予定

---

## デモ

### Markdown 記法がリアルタイムで整形される

`# ` を入力すれば見出しに、`- ` を入力すればリストに。Typora のような書き心地。

![WYSIWYG formatting demo](doc-public/demo-gifs/wysiwyg-formatting.gif)

---

### コードブロックをそのまま HTML に書き出せる

シンタックスハイライト付きのコードブロックを含む記事を、スタンドアロン HTML としてエクスポート。

![Code block to HTML export demo](doc-public/demo-gifs/code-block-export.gif)

---

### AI コピーボタンでワンクリック最適化

ツールバーの **[AI コピー]** を押すと、見出し階層・コードブロックの言語タグ・空白行を自動整形してクリップボードへコピー。そのまま Claude / ChatGPT に貼れる。

![AI copy demo](doc-public/demo-gifs/ai-copy.gif)

---

### フォーカスモード・タイプライターモード

書くことだけに集中できる執筆環境。サイドバーを隠すフォーカスモードと、現在行を画面中央に固定するタイプライターモードを搭載。

![Focus mode demo](doc-public/demo-gifs/focus-mode.gif)

---

## インストール（開発版）

### 必要な環境

| ツール | バージョン |
|--------|-----------|
| [Node.js](https://nodejs.org/) | 20 以上 |
| [pnpm](https://pnpm.io/) | 9 以上 |
| [Rust](https://rustup.rs/) | 1.77.2 以上 |
| [Tauri 前提条件](https://v2.tauri.app/start/prerequisites/) | OS ごとの依存ライブラリ |

> **Linux:** `webkit2gtk`・`libayatana-appindicator3` 等が必要です。[Tauri 公式ドキュメント](https://v2.tauri.app/start/prerequisites/#linux) を参照してください。

### セットアップ

```bash
git clone <repository-url>
cd markweave
pnpm install
```

### 起動

```bash
# ブラウザで UI だけ確認（Tauri API は動作しない）
pnpm dev

# デスクトップアプリとして起動（推奨）
pnpm tauri dev
```

### ビルド

```bash
pnpm tauri build
# → src-tauri/target/release/bundle/ にインストーラーが生成されます
```

---

## 主な機能

| 機能 | 説明 |
|------|------|
| WYSIWYG 編集 | `# ` → 見出し、`- ` → リストなど Markdown 記法を入力と同時に変換 |
| ソース / WYSIWYG 切り替え | `Ctrl+/` で随時切り替え可能 |
| HTML エクスポート | テーマ選択付きのスタンドアロン HTML を出力 |
| PDF / Word / EPUB エクスポート | Pandoc 連携 |
| AI コピー | 見出し階層・コードブロック言語タグ・空白行を自動整形してコピー |
| AI テンプレート | ブログ構成・コードレビュー依頼などのプロンプトをサイドバーから挿入 |
| フォーカスモード | サイドバー非表示・余白拡大の執筆専用レイアウト |
| タイプライターモード | 現在行を画面中央に固定 |
| 検索・置換 | `Ctrl+F` / `Ctrl+H` |
| タブ管理 | 複数ファイルをタブで同時に開く |
| ファイルツリー | ワークスペースフォルダをサイドバーで管理 |

---

## テスト

```bash
# ユニット・統合テスト（Vitest）
pnpm test

# E2E テスト（Playwright）
pnpm dlx playwright install chromium   # 初回のみ
pnpm test:e2e

# Markdown ↔ TipTap JSON ラウンドトリップテスト
npm run test:roundtrip
```

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップ基盤 | Tauri 2.0（Rust） |
| フロントエンド | React + TypeScript + Vite |
| エディタエンジン | TipTap（ProseMirror）+ CodeMirror 6 |
| 状態管理 | Zustand |
| スタイル | Tailwind CSS |
| テスト | Vitest + Playwright |

---

## 設計ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [design-index.md](./docs/00_Meta/design-index.md) | 設計ファイル索引 |
| [feature-list.md](./docs/00_Meta/feature-list.md) | 機能一覧・ロードマップ |
| [system-design.md](./docs/01_Architecture/system-design.md) | システム全体設計 |
| [markdown-tiptap-conversion.md](./docs/02_Core_Editor/markdown-tiptap-conversion.md) | Markdown ↔ TipTap 変換設計 |

---

## ライセンス

TBD
