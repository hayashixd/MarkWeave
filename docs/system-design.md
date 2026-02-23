# システム設計ドキュメント

> プロジェクト: Markdown Editor - Typora ライク WYSIWYG エディタ
> バージョン: 0.1 (初期設計)
> 更新日: 2026-02-23

---

## 1. システム概要

### 1.1 アーキテクチャ方針

本エディタは **ContentEditable + AST（抽象構文木）ベース** のアーキテクチャを採用する。

```
┌─────────────────────────────────────────────────────────┐
│                    ユーザー入力                           │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Input Handler                           │
│  キーボード / マウス / ドラッグ&ドロップ / ペースト      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Editor Core                           │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Markdown   │◄──►│    AST      │◄──►│   State     │ │
│  │   Parser    │    │  (Document) │    │  Manager    │ │
│  └─────────────┘    └──────┬──────┘    └─────────────┘ │
│                            │                            │
│                     ┌──────▼──────┐                     │
│                     │  Serializer │                     │
│                     │(AST→Markdown│                     │
│                     └─────────────┘                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer                              │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              WYSIWYG View                         │   │
│  │  - フォーカス: ソースモード表示                    │   │
│  │  - 非フォーカス: レンダリング表示                  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  File System Layer                       │
│  ローカルファイル / クラウドストレージ（将来）           │
└─────────────────────────────────────────────────────────┘
```

### 1.2 技術スタック候補

#### フロントエンド（Webベース）

| 用途 | 候補1（推奨） | 候補2 | 候補3 |
|------|------------|-------|-------|
| フレームワーク | **React** | Vue.js | Svelte |
| エディタエンジン | **ProseMirror** | CodeMirror | TipTap |
| マークダウンパーサ | **remark/unified** | marked | markdown-it |
| 数式 | **KaTeX** | MathJax | — |
| 図表 | **Mermaid.js** | — | — |
| スタイル | **Tailwind CSS** | CSS Modules | styled-components |
| ビルド | **Vite** | webpack | esbuild |
| テスト | **Vitest** | Jest | — |

#### デスクトップラッパー（オプション）

| 用途 | 候補1（推奨） | 候補2 |
|------|------------|-------|
| ラッパー | **Tauri** (Rust) | Electron |
| 理由 | 軽量・高速・低メモリ | エコシステム豊富 |

> **推奨構成**: React + ProseMirror + remark で Webアプリとして開発し、後でTauriでデスクトップ化。

---

## 2. コアアーキテクチャ設計

### 2.1 ドキュメントモデル（AST）

マークダウンを内部では AST（mdast仕様）として保持する。

```typescript
// ドキュメントの内部表現
interface Document {
  type: 'root';
  children: BlockNode[];
}

type BlockNode =
  | Heading
  | Paragraph
  | Table
  | CodeBlock
  | BlockQuote
  | List
  | ThematicBreak
  | MathBlock;

type InlineNode =
  | Text
  | Strong
  | Emphasis
  | Code
  | Link
  | Image
  | MathInline;

interface Heading {
  type: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

interface Table {
  type: 'table';
  align: ('left' | 'right' | 'center' | null)[];
  children: TableRow[];
}
```

### 2.2 WYSIWYG レンダリングモデル

Typora の「フォーカス時ソース、非フォーカス時レンダリング」を実現する。

```
状態遷移:

[レンダリング状態]
   │
   │ ユーザーがクリック/フォーカス
   ▼
[ソース編集状態] ─── Escキー/他の場所クリック ──► [レンダリング状態]
   │
   │ 入力変更
   ▼
[AST更新] ──► [シリアライズ] ──► [ファイル同期]
```

#### ProseMirror を使う理由

- 構造化されたドキュメントモデル（Markdownと親和性高い）
- カーソル/セレクション管理が強力
- カスタムNodeViewによる任意のレンダリング（テーブル、数式等）
- トランザクションベースの状態管理（Undo/Redo）

### 2.3 テーブル編集モジュール

テーブルは特別なコンポーネントとして実装する。

```
テーブルコンポーネントの責務:
├── セルの編集（インラインWYSIWYG）
├── Tab/Shift+Tabでセル間移動
├── 行の追加・削除・並び替え（DnD）
├── 列の追加・削除・並び替え（DnD）
├── 列幅のリサイズ（ドラッグ）
├── セル配置（左/中/右）
└── コンテキストメニュー
```

---

## 3. モジュール設計

### 3.1 ディレクトリ構成（詳細）

```
src/
├── core/                          # エディタコアロジック
│   ├── document/
│   │   ├── ast.ts                 # ASTの型定義
│   │   ├── document-model.ts      # ドキュメントの操作API
│   │   └── cursor.ts              # カーソル・セレクション管理
│   ├── parser/
│   │   ├── markdown-parser.ts     # Markdown → AST
│   │   └── serializer.ts          # AST → Markdown
│   ├── commands/
│   │   ├── text-commands.ts       # 太字、斜体等のコマンド
│   │   ├── block-commands.ts      # 見出し、リスト等のコマンド
│   │   └── table-commands.ts      # テーブル操作コマンド
│   ├── history/
│   │   └── history-manager.ts     # Undo/Redo
│   └── editor.ts                  # エディタのエントリポイント
│
├── renderer/                      # レンダリングエンジン
│   ├── wysiwyg/
│   │   ├── prosemirror-setup.ts   # ProseMirrorの設定
│   │   ├── schema.ts              # ProseMirrorスキーマ定義
│   │   ├── node-views/
│   │   │   ├── heading-view.ts    # 見出しのWYSIWYGビュー
│   │   │   ├── table-view.ts      # テーブルのWYSIWYGビュー
│   │   │   ├── code-block-view.ts # コードブロックビュー
│   │   │   ├── math-view.ts       # 数式ビュー（KaTeX）
│   │   │   └── image-view.ts      # 画像ビュー
│   │   └── plugins/
│   │       ├── input-rules.ts     # 入力ルール（`# `→H1等）
│   │       ├── key-bindings.ts    # キーバインディング
│   │       └── placeholder.ts     # プレースホルダー
│   └── source/
│       └── source-view.ts         # ソースモードのビュー
│
├── components/                    # UIコンポーネント（React）
│   ├── Editor/
│   │   ├── Editor.tsx             # メインエディタコンポーネント
│   │   ├── Toolbar.tsx            # ツールバー
│   │   └── StatusBar.tsx          # ステータスバー
│   ├── Sidebar/
│   │   ├── Sidebar.tsx            # サイドバー
│   │   ├── FileTree.tsx           # ファイルツリー
│   │   └── Outline.tsx            # アウトラインパネル
│   ├── Table/
│   │   ├── TableEditor.tsx        # テーブル編集UI
│   │   ├── TableCell.tsx          # セルコンポーネント
│   │   └── TableContextMenu.tsx   # コンテキストメニュー
│   └── common/
│       ├── Modal.tsx              # モーダル
│       ├── ContextMenu.tsx        # 汎用コンテキストメニュー
│       └── ResizeHandle.tsx       # リサイズハンドル
│
├── plugins/                       # プラグインシステム
│   ├── plugin-api.ts              # プラグインAPI定義
│   ├── plugin-manager.ts          # プラグイン管理
│   └── built-in/
│       ├── mermaid-plugin.ts      # Mermaid図表
│       ├── math-plugin.ts         # 数式
│       └── image-plugin.ts        # 画像処理
│
├── file/                          # ファイル管理
│   ├── file-manager.ts            # ファイルの読み書き
│   ├── watcher.ts                 # ファイル変更監視
│   └── export/
│       ├── html-exporter.ts       # HTMLエクスポート
│       └── pdf-exporter.ts        # PDFエクスポート
│
├── themes/                        # テーマシステム
│   ├── theme-manager.ts           # テーマ管理
│   └── default/
│       ├── editor.css             # エディタスタイル
│       └── preview.css            # レンダリングスタイル
│
├── utils/                         # ユーティリティ
│   ├── debounce.ts
│   ├── clipboard.ts               # クリップボード操作
│   └── keyboard.ts                # キーボードユーティリティ
│
└── app.tsx                        # アプリケーションエントリポイント
```

---

## 4. 主要機能の実装設計

### 4.1 WYSIWYG 実装

```
実装方針:
1. ProseMirrorのNodeViewを使い、各Markdownノードにカスタムレンダリングを割り当て
2. フォーカス検出は ProseMirror の decorations を活用
3. フォーカス時: ContentEditableな生テキスト表示
4. 非フォーカス時: DOMノードをレンダリング済みHTMLに置換

具体的な流れ:
  ユーザークリック
    → NodeView の selectNode() コールバック
    → ソース入力用DOM要素を表示
    → ContentEditableでユーザー編集
    → deselectNode() コールバック
    → マークダウンをパース
    → レンダリングされたDOMに置換
```

### 4.2 テーブル実装

```
テーブルの内部表現:
  - ProseMirrorのtable拡張を参考に独自実装
  - または prosemirror-tables ライブラリの活用

テーブル操作のコマンド設計:
  TableCommands.addRow(pos: 'before' | 'after', rowIndex: number)
  TableCommands.removeRow(rowIndex: number)
  TableCommands.addColumn(pos: 'before' | 'after', colIndex: number)
  TableCommands.removeColumn(colIndex: number)
  TableCommands.moveRow(from: number, to: number)
  TableCommands.moveColumn(from: number, to: number)
  TableCommands.setAlignment(colIndex: number, align: 'left' | 'center' | 'right')
```

### 4.3 入力ルール（オートフォーマット）

```
トリガー → 変換:
  "# "     → Heading 1
  "## "    → Heading 2
  "### "   → Heading 3
  "- "     → Bullet List
  "* "     → Bullet List
  "1. "    → Ordered List
  "> "     → Blockquote
  "```"    → Code Block
  "---"    → Thematic Break
  "| "     → Table (次のEnterでテーブル生成)
  "$$"     → Math Block
  "- [ ] " → Task List Item
```

### 4.4 Undo/Redo

- ProseMirrorのトランザクション履歴を使用
- 全操作がトランザクションとして記録される
- `Ctrl+Z` / `Ctrl+Shift+Z` で操作

---

## 5. データフロー

### 5.1 保存フロー

```
ユーザー入力
  → ProseMirrorトランザクション
  → AST更新
  → デバウンス（500ms）
  → ASTをMarkdownにシリアライズ
  → ファイルに書き込み
```

### 5.2 読み込みフロー

```
ファイルオープン
  → Markdownテキスト読み込み
  → remarkでASTにパース
  → ASTをProseMirrorドキュメントに変換
  → エディタに設定
```

---

## 6. 開発フェーズ

### Phase 1: MVP（最小実用製品）

目標: 基本的なWYSIWYG編集ができること

- [ ] プロジェクトセットアップ（Vite + React + TypeScript）
- [ ] ProseMirrorの基本セットアップ
- [ ] マークダウンパーサ統合（remark）
- [ ] インライン要素のWYSIWYG（太字・斜体・コード・リンク）
- [ ] ブロック要素のWYSIWYG（見出し・段落・引用・リスト）
- [ ] コードブロック（シンタックスハイライト）
- [ ] 入力ルール（`# ` → H1等）
- [ ] 基本キーボードショートカット
- [ ] ファイルの読み書き

### Phase 2: テーブル

目標: Excelライクなテーブル編集

- [ ] テーブルレンダリング
- [ ] Tab/Shift+Tabでセル移動
- [ ] 行・列の追加・削除
- [ ] 行・列のドラッグ&ドロップ並び替え
- [ ] 列幅のリサイズ
- [ ] 右クリックコンテキストメニュー
- [ ] 列の配置（左/中/右）

### Phase 3: リッチ機能

- [ ] 数式（KaTeX）
- [ ] Mermaid図表
- [ ] 画像ドラッグ&ドロップ
- [ ] アウトラインパネル
- [ ] 検索・置換
- [ ] テーマシステム

### Phase 4: 高度な機能

- [ ] ファイルツリー
- [ ] エクスポート（HTML・PDF）
- [ ] フォーカスモード・タイプライターモード
- [ ] プラグインシステム
- [ ] Tauri統合（デスクトップアプリ化）

---

## 7. 品質方針

### テスト戦略

| テスト種別 | ツール | 対象 |
|---------|-------|------|
| ユニットテスト | Vitest | パーサ、シリアライザ、コマンド |
| コンポーネントテスト | Testing Library | Reactコンポーネント |
| E2Eテスト | Playwright | エディタの統合動作 |

### パフォーマンス目標

| 指標 | 目標値 |
|------|--------|
| 起動時間 | < 1秒 |
| 10,000行ファイルのロード | < 500ms |
| キー入力レイテンシ | < 16ms（60fps）|
| メモリ使用量 | < 200MB |

---

## 8. 未解決の設計課題

1. **大きなファイルの仮想化**: 数万行のファイルでの仮想スクロール対応
2. **コンフリクト解決**: 外部エディタで変更されたファイルの扱い
3. **マルチファイル検索**: フォルダ内ファイル横断検索の実装方法
4. **画像ストレージ**: クラウドアップロードの設計
5. **プラグインサンドボックス**: プラグインの安全な実行環境

---

*このドキュメントは設計の方向性を示すものであり、実装進行に伴い更新される。*
