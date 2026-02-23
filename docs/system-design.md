# システム設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 0.4 (WYSIWYGモード設計確定)
> 更新日: 2026-02-23

---

## 1. システム概要

### 1.1 アーキテクチャ方針

本エディタは **ContentEditable + AST（抽象構文木）ベース** のアーキテクチャを採用する。
Markdown と HTML の両ファイル形式を統一的な内部 AST（hast 互換）で扱い、
シームレスな変換・編集を実現する。

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
│  │  MD Parser  │    │  内部 AST   │    │   State     │ │
│  │ HTML Parser │◄──►│ (hast互換)  │◄──►│  Manager    │ │
│  └─────────────┘    └──────┬──────┘    └─────────────┘ │
│                            │                            │
│              ┌─────────────┼─────────────┐              │
│              │             │             │              │
│       ┌──────▼──────┐ ┌───▼────┐  ┌─────▼──────┐      │
│       │MD Serializer│ │Converter│  │HTML        │      │
│       │(AST→.md)   │ │MD↔HTML │  │Serializer  │      │
│       └─────────────┘ └────────┘  │(AST→.html) │      │
│                                   └────────────┘       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer                              │
│                                                         │
│  ┌────────────────────────────────────────────────────┐   │
│  │              表示モード（切替可能）                 │   │
│  │                                                    │   │
│  │  [Typora式]    フォーカスブロック: ソース           │   │
│  │                非フォーカスブロック: レンダリング   │   │
│  │                                                    │   │
│  │  [常にWYSIWYG] 全ブロック: レンダリング            │   │
│  │                                                    │   │
│  │  [ソース表示]  全ブロック: CodeMirror 6            │   │
│  │                                                    │   │
│  │  [Split]       左: CodeMirror / 右: HTMLプレビュー │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  File System Layer                       │
│  Tauri plugin-fs（.md / .html 両対応）                   │
│  ※ブラウザFile System Access APIは不使用                 │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────┬──────────────┬──────────────────────────┐
│  Windows     │  Android     │  iOS / macOS / Linux     │
│  （第1目標） │  （第2フェーズ）│  （第2フェーズ）         │
└──────────────┴──────────────┴──────────────────────────┘
```

### 1.2 技術スタック（確定）

#### プラットフォーム

| 用途 | 採用技術 | 備考 |
|------|---------|------|
| デスクトップフレームワーク | **Tauri 2.0**（Rust） | Windows / macOS / Linux 対応 |
| モバイル（将来） | **Tauri 2.0**（同一コード） | Android / iOS は第2フェーズ |
| WebView（Windows） | **WebView2**（Microsoft製） | Windows 10/11 に標準搭載 |
| WebView（Android） | Chrome WebView | OS標準 |
| WebView（iOS） | WKWebView（Safari相当） | OS標準 |

> **Electronを採用しない理由**: モバイル（Android/iOS）への展開が不可能なため。
> Tauri 2.0 は 2024年10月にモバイル正式対応済み。

#### フロントエンド

| 用途 | 採用技術 | 採用しなかった候補 |
|------|---------|----------------|
| UIフレームワーク | **React + TypeScript** | Vue.js、Svelte |
| エディタエンジン | **TipTap** | ~~ProseMirror直接~~（※後述） |
| Markdownパーサ | **remark / unified** | marked、markdown-it |
| HTMLパーサ | **rehype-parse** | parse5 |
| MD→HTML変換 | **remark-rehype** | — |
| HTML→MD変換 | **turndown** | — |
| HTML AST操作 | **hast-util-\*** | — |
| CSSインライン化 | **juice** | — |
| 数式 | **KaTeX** | MathJax |
| 図表 | **Mermaid.js** | — |
| コード言語推定 | ヒューリスティック | linguist-languages |
| スタイル | **Tailwind CSS** | CSS Modules |
| ビルド | **Vite + Tauri CLI** | webpack |
| テスト | **Vitest + Playwright** | Jest |

> **エディタエンジンを TipTap に変更した理由**:
> ProseMirrorを直接使う場合、テーブル・数式・コードブロック等を全て自前実装する必要があり
> 個人開発では工数が過大になる。TipTap は ProseMirror の完全なラッパーであり、
> 公式拡張（テーブル・数式・コードブロック・画像等）を活用することで開発速度を維持しつつ
> Typora を超える品質を現実的に達成できる。内部は ProseMirror であるため、
> カスタム拡張の余地も十分ある。

#### ファイルシステム

| 用途 | 採用技術 | 備考 |
|------|---------|------|
| ファイル読み書き | **@tauri-apps/plugin-fs** | ブラウザFile System Access APIは不使用 |
| ファイルダイアログ | **@tauri-apps/plugin-dialog** | ネイティブのファイル選択ダイアログ |
| ファイル関連付け | Tauri のファイル関連付け設定 | .mdをダブルクリックで開く |
| ファイル変更監視 | **@tauri-apps/plugin-fs**（watch） | 外部エディタとの競合検知 |

#### 確定した全体構成

```
Tauri 2.0（Rust）
  ├─ ファイルシステム操作
  ├─ ネイティブメニュー・ウィンドウ管理
  ├─ ファイル関連付け（.md / .html）
  └─ WebView（OS標準）
       └─ React + TypeScript（フロントエンド）
            └─ TipTap（ProseMirrorラッパー）
                 ├─ remark / unified（Markdownパーサ）
                 ├─ rehype（HTMLパーサ・変換）
                 ├─ KaTeX（数式）
                 └─ Mermaid.js（図表）
```

---

## 2. コアアーキテクチャ設計

### 2.1 ドキュメントモデル（AST）

Markdown・HTML 両ファイルを内部では **hast（Hypertext AST）互換のAST** として保持する。
これにより、MD/HTML どちらの形式でも同じエディタコアで操作できる。

```typescript
// 統合ドキュメントの内部表現（hast互換）
interface Document {
  type: 'root';
  children: Node[];
  // どのファイル形式から読み込んだかのメタ情報
  meta: {
    sourceFormat: 'markdown' | 'html';
    filePath: string;
    encoding: string;
  };
}

// HTML要素ノード（hast準拠）
interface Element {
  type: 'element';
  tagName: string;              // 'h1', 'p', 'table', 'div', etc.
  properties: Record<string, unknown>; // class, style, href, etc.
  children: Node[];
}

// テキストノード
interface Text {
  type: 'text';
  value: string;
}

// Markdown固有の拡張ノード（hast拡張）
interface MathBlock {
  type: 'element';
  tagName: 'math-block';
  properties: { formula: string };
  children: [];
}

// ------- 後方互換: Markdownのみの場合は mdast も参照 -------
// Markdownパース時: mdast → hast変換（remark-rehype）
// HTML パース時: HTML → hast 直接パース（rehype-parse）
```

### 2.2 WYSIWYG レンダリングモデル

#### 4つの表示モード（確定）

エディタは以下の4モードを切り替え可能とする。デフォルトは **Typora式**。

| モード | ID | 説明 | デフォルト |
|--------|-----|------|-----------|
| **Typora式** | `typora` | フォーカスしたブロックのみソース表示、他はレンダリング | ✅ |
| **常にWYSIWYG** | `wysiwyg` | 全ブロックを常にレンダリング済みで表示。ソース不可視 | |
| **常にソース表示** | `source` | 全ブロックを常にMarkdownソースとして表示 | |
| **サイドバイサイド** | `split` | 左ペイン: ソース編集、右ペイン: プレビュー | |

#### モード切り替えUI

```
ツールバー右端:
  ┌───────────────────────────────┐
  │ [Typora式] [WYSIWYG] [ソース] [Split] │
  └───────────────────────────────┘
  または
  キーボードショートカット:
    Ctrl+Alt+1 → Typora式
    Ctrl+Alt+2 → 常にWYSIWYG
    Ctrl+Alt+3 → 常にソース表示
    Ctrl+Alt+4 → サイドバイサイド
```

モードは `localStorage`（またはTauriのstore plugin）にユーザー設定として永続化する。

#### Typora式の状態遷移（メインモード）

```
[レンダリング状態（非フォーカスブロック）]
   │
   │ クリック / キーボードフォーカス移動
   ▼
[ソース編集状態（フォーカスブロック）] ─── 別ブロッククリック / Escキー ──► [レンダリング状態]
   │
   │ 入力変更
   ▼
[AST更新] ──► [シリアライズ] ──► [ファイル同期（デバウンス）]
```

#### 各モードの TipTap 実装方針

```
┌─────────────────────────────────────────────────────────────┐
│  共通: TipTap Editor インスタンス（ProseMirror内部）         │
│        内部ドキュメントモデルは常に同一                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ editorMode: 'typora' | 'wysiwyg' | 'source' | 'split'
          ┌────────┴────────────────────────────────────┐
          │                                             │
          ▼                                             ▼
   source / split モード                    typora / wysiwyg モード
   ─────────────────────                    ────────────────────────
   TipTap の NodeView を無効化              カスタム NodeView を有効化
   CodeMirror 6 を代わりに使用             ブロック単位でレンダリング制御
   （シンタックスハイライト付き）           フォーカス状態をProseMirrorの
                                            Decoration で管理

   split モードのみ:
   左ペイン = source ビュー
   右ペイン = rehype でリアルタイムレンダリング
```

#### NodeView の責務（Typora式 / 常にWYSIWYGモード）

```typescript
// 各ブロックノード（見出し・段落・テーブル等）がこのインターフェースを実装
interface BlockNodeView {
  // フォーカス時: ソース編集用DOMを表示
  selectNode(): void;
  // デフォーカス時: レンダリング済みDOMを表示
  deselectNode(): void;
  // 常にWYSIWYGモード時: deselectNodeを常時適用（selectNodeは無効化）
}
```

#### TipTap を採用する理由

- 内部は ProseMirror であり、低レベルのカスタマイズが必要な場合も対応可能
- テーブル・数式・コードブロック・画像等の公式拡張が揃っており個人開発の工数を大幅削減
- カーソル/セレクション管理・Undo/Redo は ProseMirror の機構をそのまま継承
- カスタムNodeViewによる任意レンダリングも可能（Typora式WYSIWYG実装に必要）
- TypeScript ネイティブでReactとの統合が良好

### 2.3 AI最適化モジュール

AIコピー機能は、エディタコアとUIの間に位置する独立したモジュールとして実装する。

```
エディタ（ProseMirror）
  │  getMarkdown()
  ▼
┌──────────────────────────────────────────────────┐
│              AI Optimizer                        │
│                                                  │
│  normalizeCodeFences()                           │
│  normalizeHeadings()       変換パイプライン       │
│  annotateCodeBlocks()   ──────────────────►      │
│  normalizeListMarkers()    最適化済みMarkdown     │
│  trimExcessiveWhitespace()                       │
│  annotateLinks()                                 │
│                                                  │
│  analyzePromptStructure() → PromptAnalysis       │
│  buildReport()            → 変更点レポート        │
└──────────────────────────────────────────────────┘
  │  optimizedText
  ▼
navigator.clipboard.writeText()
  │
  ▼
[AIコピー完了 → ユーザーがChatGPT/Claude等にペースト]
```

### 2.4 テーブル編集モジュール

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
│   │   ├── ast.ts                 # 統合ASTの型定義（hast互換）
│   │   ├── document-model.ts      # ドキュメントの操作API
│   │   └── cursor.ts              # カーソル・セレクション管理
│   ├── parser/
│   │   ├── markdown-parser.ts     # Markdown → 内部AST
│   │   ├── html-parser.ts         # HTML → 内部AST          ★新規
│   │   ├── serializer.ts          # 内部AST → Markdown
│   │   └── html-serializer.ts     # 内部AST → HTML          ★新規
│   ├── converter/
│   │   ├── md-to-html.ts          # MD変換パイプライン       ★新規
│   │   └── html-to-md.ts          # HTML→MD変換パイプライン  ★新規
│   ├── commands/
│   │   ├── text-commands.ts       # 太字、斜体等のコマンド
│   │   ├── block-commands.ts      # 見出し、リスト等のコマンド
│   │   ├── table-commands.ts      # テーブル操作コマンド
│   │   └── html-commands.ts       # HTML固有コマンド         ★新規
│   ├── history/
│   │   └── history-manager.ts     # Undo/Redo
│   └── editor.ts                  # エディタのエントリポイント
│
├── renderer/                      # レンダリングエンジン
│   ├── wysiwyg/
│   │   ├── prosemirror-setup.ts   # ProseMirrorの設定
│   │   ├── schema.ts              # ProseMirrorスキーマ（MD用）
│   │   ├── html-schema.ts         # ProseMirrorスキーマ（HTML用）★新規
│   │   ├── node-views/
│   │   │   ├── heading-view.ts    # 見出しのWYSIWYGビュー
│   │   │   ├── table-view.ts      # テーブルのWYSIWYGビュー
│   │   │   ├── code-block-view.ts # コードブロックビュー
│   │   │   ├── math-view.ts       # 数式ビュー（KaTeX）
│   │   │   ├── image-view.ts      # 画像ビュー
│   │   │   └── div-view.ts        # divブロックビュー        ★新規
│   │   └── plugins/
│   │       ├── input-rules.ts     # 入力ルール（`# `→H1等）
│   │       ├── key-bindings.ts    # キーバインディング
│   │       └── placeholder.ts     # プレースホルダー
│   ├── html/                                                  ★新規
│   │   ├── html-editor-setup.ts   # HTML編集モードのセットアップ
│   │   ├── split-view.ts          # スプリット表示（ソース/プレビュー）
│   │   └── live-preview.ts        # HTMLリアルタイムプレビュー
│   └── source/
│       └── source-view.ts         # ソースモードのビュー
│
├── components/                    # UIコンポーネント（React）
│   ├── Editor/
│   │   ├── Editor.tsx             # メインエディタコンポーネント
│   │   ├── HtmlEditor.tsx         # HTML編集UIコンポーネント   ★新規
│   │   ├── Toolbar.tsx            # Markdownツールバー
│   │   ├── HtmlToolbar.tsx        # HTML編集ツールバー         ★新規
│   │   └── StatusBar.tsx          # ステータスバー
│   ├── HtmlMeta/                                               ★新規
│   │   └── MetadataPanel.tsx      # <head>メタデータ編集パネル
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
│       ├── ColorPicker.tsx        # カラーピッカー             ★新規
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
│   ├── file-manager.ts            # ファイルの読み書き（.md/.html両対応）
│   ├── watcher.ts                 # ファイル変更監視
│   └── export/
│       ├── html-exporter.ts       # HTMLエクスポート（スタイル付き）
│       └── pdf-exporter.ts        # PDFエクスポート
│
├── themes/                        # テーマシステム
│   ├── theme-manager.ts           # テーマ管理
│   └── default/
│       ├── editor.css             # エディタスタイル
│       ├── preview.css            # レンダリングスタイル
│       └── html-export.css        # HTMLエクスポート用テーマ CSS ★新規
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

### 4.1 WYSIWYG モード実装

#### モード管理

```typescript
type EditorMode = 'typora' | 'wysiwyg' | 'source' | 'split';

// Reactのコンテキストでグローバル管理
const EditorModeContext = createContext<{
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
}>();

// TipTap の拡張として実装
// モード変更時に全 NodeView に再レンダリングを通知
const EditorModeExtension = Extension.create({
  name: 'editorMode',
  addStorage() {
    return { mode: 'typora' as EditorMode };
  },
  // setMode() 時に editor.view.dispatch() でトランザクションを発行し
  // NodeView 全体を再描画させる
});
```

#### Typora式: NodeView の動作

```
ユーザーがブロックをクリック
  → NodeView の selectNode() 呼び出し
  → ソース編集用 <textarea> or <div contenteditable> を表示
  → ContentEditable でユーザー編集
  → 別ブロッククリック or Esc
  → deselectNode() 呼び出し
  → Markdownソースをパースしてレンダリング済み DOM に置換

常にWYSIWYGモード:
  → 全 NodeView が常に deselectNode() 状態を維持
  → selectNode() を呼んでもソース表示に切り替わらない
  → インラインのフォーマット操作（太字等）はツールバーまたはショートカットで実施

常にソース表示モード:
  → NodeView を完全無効化
  → TipTap Editor を非表示にし CodeMirror 6 ビューを代わりに表示
  → MarkdownソースをCodeMirrorで直接編集
  → 変更はリアルタイムで TipTap の内部ドキュメントに反映

サイドバイサイドモード:
  → 左ペイン: CodeMirror 6 で Markdownソース編集
  → 右ペイン: rehype を使ったリアルタイム HTML プレビュー（読み取り専用）
  → 左右のスクロール位置を同期（行番号ベース）
```

#### ブロック別の NodeView 対応表

| ブロック種別 | Typora式 | 常にWYSIWYG | ソース | Split左ペイン |
|------------|---------|------------|--------|--------------|
| 見出し（H1〜H6） | ✅ カスタムNodeView | ✅ | CodeMirror | CodeMirror |
| 段落 | ✅ | ✅ | CodeMirror | CodeMirror |
| コードブロック | ✅ CodeMirror内包 | ✅ | CodeMirror | CodeMirror |
| テーブル | ✅ テーブルコンポーネント | ✅ | CodeMirror | CodeMirror |
| 数式（KaTeX） | ✅ KaTeXレンダリング | ✅ | CodeMirror | CodeMirror |
| Mermaid図表 | ✅ SVGレンダリング | ✅ | CodeMirror | CodeMirror |
| 画像 | ✅ img要素 | ✅ | CodeMirror | CodeMirror |
| 引用ブロック | ✅ | ✅ | CodeMirror | CodeMirror |

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

### 5.1 保存フロー（Markdown）

```
ユーザー入力
  → ProseMirrorトランザクション
  → 内部AST更新
  → デバウンス（500ms）
  → 内部ASTをMarkdownにシリアライズ
  → .md ファイルに書き込み
```

### 5.2 保存フロー（HTML）

```
ユーザー入力
  → ProseMirrorトランザクション（HTMLスキーマ）
  → 内部AST更新
  → デバウンス（500ms）
  → 内部ASTをHTMLにシリアライズ
  → .html ファイルに書き込み
```

### 5.3 読み込みフロー

```
ファイルオープン
  → 拡張子判定（.md / .html）
  │
  ├─ .md の場合
  │    → remarkでmdastにパース
  │    → remark-rehypeでhastに変換
  │    → 内部ASTに格納
  │    → Markdownエディタモードを起動
  │
  └─ .html の場合
       → rehype-parseでhastにパース
       → 内部ASTに格納
       → HTMLエディタモードを起動
```

### 5.4 変換フロー（MD → HTML エクスポート）

```
現在のMarkdownドキュメント
  → 内部AST（hast）
  → rehype-highlightでコードをハイライト
  → rehype-katexで数式をレンダリング
  → rehype-stringifyでHTML文字列生成
  → HTMLテンプレートに注入
  → juiceでCSSをインライン化
  → スタンドアロン .html ファイルとして書き出し
```

### 5.5 変換フロー（HTML → MD 変換）

```
現在のHTMLドキュメント
  → turndownでMarkdown文字列へ変換
  → 変換不可能要素の警告リスト生成
  → ユーザーに警告を表示（確認ダイアログ）
  → 承認後: .md ファイルとして保存 / 新規タブで開く
```

---

## 6. 開発フェーズ

### Phase 0: 環境構築（最優先）

目標: 開発環境を整え、画面が表示されること

- [ ] Rust / Tauri CLI のインストール
- [ ] `pnpm create tauri-app` でプロジェクト初期化（React + TypeScript + Vite）
- [ ] TipTap のインストール・動作確認
- [ ] Tauri plugin-fs のセットアップ
- [ ] Windows向けビルド確認（`.exe` が生成されること）
- [ ] 開発用ホットリロード確認

### Phase 1: MVP（最小実用製品）

目標: Markdownファイルを開いてWYSIWYG編集・保存できること

- [ ] TipTap 基本セットアップ（StarterKit）
- [ ] remark 統合（.md ファイル → TipTap ドキュメント変換）
- [ ] TipTap ドキュメント → .md シリアライズ
- [ ] Tauri plugin-fs でファイルの読み書き
- [ ] ネイティブファイルダイアログ（開く・保存）
- [ ] インライン要素 WYSIWYG（太字・斜体・コード・リンク）
- [ ] ブロック要素 WYSIWYG（見出し・段落・引用・リスト）
- [ ] コードブロック（シンタックスハイライト）
- [ ] 入力ルール（`# ` → H1等のオートフォーマット）
- [ ] 基本キーボードショートカット（Ctrl+B、Ctrl+I等）
- [ ] **4モード切り替えUI**（ツールバーボタン + Ctrl+Alt+1〜4）
  - [ ] Typora式（デフォルト）
  - [ ] 常にWYSIWYG
  - [ ] 常にソース表示（CodeMirror 6統合）
  - [ ] サイドバイサイド
- [ ] モード設定の永続化（Tauriストア）
- [ ] 自動保存（デバウンス500ms）
- [ ] .md ファイル関連付け（ダブルクリックで開く）

### Phase 2: テーブル

目標: Excelライクなテーブル編集

- [ ] TipTap Table 拡張の統合
- [ ] Tab / Shift+Tab でセル移動
- [ ] 行・列の追加・削除
- [ ] 行・列のドラッグ&ドロップ並び替え
- [ ] 列幅リサイズ
- [ ] 右クリックコンテキストメニュー
- [ ] 列の配置（左/中/右）

### Phase 3: リッチ機能

- [ ] 数式（KaTeX / TipTap Mathematics 拡張）
- [ ] Mermaid 図表
- [ ] 画像のドラッグ&ドロップ（Tauri でローカルパスに保存）
- [ ] アウトラインパネル
- [ ] 検索・置換
- [ ] テーマシステム（ライト/ダーク）
- [ ] MD → HTML エクスポート

### Phase 4: 高度な機能（Windows版完成）

- [ ] ファイルツリー（フォルダを開く）
- [ ] フォルダ内全文検索
- [ ] PDF エクスポート
- [ ] フォーカスモード・タイプライターモード
- [ ] プラグインシステム
- [ ] AI コピーボタン統合
- [ ] AI テンプレートパネル統合

### Phase 5: マルチプラットフォーム展開

- [ ] macOS / Linux 対応確認・調整
- [ ] Android 対応（Tauri 2.0 モバイルビルド）
  - [ ] タッチ操作対応 UI
  - [ ] ファイルアクセス（Androidドキュメントプロバイダ）
- [ ] iOS 対応（Tauri 2.0 モバイルビルド）
  - [ ] iCloud Drive 連携検討

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

#### 技術選定済み

- ✅ プラットフォーム: **Tauri 2.0**（Windows優先、将来Android/iOS）
- ✅ エディタエンジン: **TipTap**（ProseMirrorラッパー）
- ✅ ファイルシステム: **@tauri-apps/plugin-fs**
- ✅ フロントエンド: **React + TypeScript + Vite**

#### 未解決の設計課題

1. ✅ **WYSIWYGのモード**: Typora式をデフォルトとし、常にWYSIWYG・常にソース・サイドバイサイドの4モード切り替えに確定
2. **大きなファイルの仮想化**: 数万行のファイルでの仮想スクロール対応
3. **コンフリクト解決**: 外部エディタで変更されたファイルの扱い
4. **マルチファイル検索**: フォルダ内ファイル横断検索の実装方法
5. **画像ストレージ**: ローカルパス管理・コピー先フォルダの設計
6. **プラグインサンドボックス**: プラグインの安全な実行環境
7. **CSS編集の範囲**: HTMLファイル編集時の`<style>`タグ内CSSの扱い
8. **相対パス解決**: HTML編集時の画像・CSS・JSの相対パス解決
9. **HTML→MD変換ロス**: 変換時の情報ロス（スタイル・構造）をどこまで許容するか
10. **JavaScript の取り扱い**: `<script>` タグを含むHTMLの安全な扱い方
11. **AI言語推定の精度**: 無タグコードブロックの言語ヒューリスティックの品質
12. **カスタムテンプレート保存**: ユーザー定義テンプレートのローカル永続化設計
13. **AIプロバイダ連携（将来）**: OpenAI / Anthropic APIをエディタ内から直接呼び出す設計
14. **モバイルUI設計**: タッチ操作・画面サイズに対応したUI変更の範囲
15. **Windows WebView2の最低要件**: Windows 10の最低バージョン（WebView2対応版）の決定
16. **配布・アップデート方法**: インストーラ形式・自動アップデート（Tauri updater）の設計

---

*このドキュメントは設計の方向性を示すものであり、実装進行に伴い更新される。*
