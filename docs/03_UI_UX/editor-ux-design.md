# エディタ UX 詳細設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [YAML Front Matter 編集 UI](#1-yaml-front-matter-編集-ui)
2. [フローティング数式プレビュー](#2-フローティング数式プレビュー)
3. [アウトラインパネル設計](#3-アウトラインパネル設計)
4. [クイックオープン（Ctrl+P）](#4-クイックオープンctrlp)
5. [コードブロック補助 UI](#5-コードブロック補助-ui)
6. [画像のインラインリサイズ UI](#6-画像のインラインリサイズ-ui)
7. [リンクのクリック動作設計](#7-リンクのクリック動作設計)
8. [ファイルツリーからの Markdown リンク挿入](#8-ファイルツリーからの-markdown-リンク挿入)
9. [スプリットビューのスクロール同期](#9-スプリットビューのスクロール同期)
10. [空ドキュメントのプレースホルダー表示](#10-空ドキュメントのプレースホルダー表示)
11. [矩形選択（Alt+ドラッグ）](#11-矩形選択altドラッグ)
12. [テキスト整形コマンド](#12-テキスト整形コマンド)
13. [行ブックマークと F2 ジャンプ](#13-行ブックマークと-f2-ジャンプ)
14. [単語の自動補完（Ctrl+Space）](#14-単語の自動補完ctrlspace)

---

## 1. YAML Front Matter 編集 UI

### 1.1 表示方針

YAML Front Matter（ファイル先頭の `---` ブロック）は **折りたたみ可能なインラインブロック** として表示する。
Typora 同様、フォーカス時にソース YAML を表示し、フォーカス外はサマリーラベルを表示する。

```
フォーカス外（折りたたみ状態）:
┌──────────────────────────────────────┐
│ 📄 Front Matter  title: My Post ∨   │
└──────────────────────────────────────┘

フォーカス時（展開状態）:
┌──────────────────────────────────────┐
│ ---                                  │
│ title: My Post                       │
│ date: 2026-02-24                     │
│ tags: [markdown, editor]             │
│ ---                                  │
└──────────────────────────────────────┘
```

### 1.2 実装方針

- `frontmatter` カスタム TipTap NodeView として実装
- NodeView 内部は **CodeMirror 6（YAML モード）** を使用してシンタックスハイライトと補完を提供
- フォーカス外サマリーは `title`・`date`・`tags` の主要フィールドを抽出して1行表示
- `enableFrontMatter` 設定が `false` の場合は rawHtmlBlock と同様に不透明ノードとして保持

### 1.3 YAML 検証とエラー表示

```
無効な YAML の場合:
┌──────────────────────────────────────┐
│ ---                                  │
│ title: My Post                       │
│ tags: [unclosed                     │  ← 赤下線
│ ⚠ YAML parse error: unexpected EOF  │
│ ---                                  │
└──────────────────────────────────────┘
```

- YAML パースエラー時は NodeView 内にインラインエラー表示
- エラーがあっても保存は可能（生テキストをそのまま保持）

---

## 2. フローティング数式プレビュー

### 2.1 UX フロー

Typora §11.7 で紹介されている「Esc プレビュー」機能を採用する。

```
1. ユーザーが $ を入力してカーソルが数式ブロック内にある状態
2. Esc キーを押す
3. 数式ブロックの直下にフローティングプレビューが表示される
4. プレビューは KaTeX でレンダリング
5. もう一度 Esc またはブロック外クリックでプレビューを閉じる

┌─────────────────────────────────────────┐
│ $$                                      │
│ \sum_{i=0}^n x_i^2                     │  ← ソース編集中
│ $$                                      │
└─────────────────────────────────────────┘
        ▼ Esc 押下
┌─────────────────────────────────────────┐
│ $$                                      │
│ \sum_{i=0}^n x_i^2                     │
│ $$                                      │
│ ╔═══════════════════════════════════╗   │
│ ║   Σ x²ᵢ  (KaTeX レンダリング)    ║   │  ← フローティングプレビュー
│ ╚═══════════════════════════════════╝   │
└─────────────────────────────────────────┘
```

### 2.2 実装方針

- TipTap `mathBlock` / `mathInline` NodeView の `selectNode()` 内で Esc キーをリッスン
- プレビューは React ポータルで DOM ルートに mount し、z-index で前面表示
- KaTeX レンダリングエラー（`\invalidsyntax` 等）はエラーメッセージをプレビュー内に表示
- インライン数式（`$...$`）にも同様のプレビューを適用

---

## 3. アウトラインパネル設計

### 3.1 パネル構成

サイドバーの「アウトライン」タブに表示する。

```
┌────────────────────────────────────┐
│ アウトライン               [≡ 折] │
├────────────────────────────────────┤
│ 🔍 フィルタ...                    │
├────────────────────────────────────┤
│ ● H1: はじめに                    │  ← 現在位置（ハイライト）
│   ○ H2: 背景                      │
│   ○ H2: 目的                      │
│     · H3: 詳細                    │
│ ○ H1: 実装方針                    │
│   ○ H2: アーキテクチャ            │
└────────────────────────────────────┘
```

### 3.2 機能一覧

| 機能 | 詳細 |
|------|------|
| リアルタイム更新 | TipTap の `onUpdate` フックで見出しノードを抽出し再レンダリング |
| クリックジャンプ | クリックで対応するブロックへスクロール + フォーカス |
| 現在位置ハイライト | ProseMirror セレクション変化を追跡し、含む見出し節をハイライト |
| フィルタ | 入力でリアルタイムに見出しテキストを絞り込み |
| 折りたたみ | 下位見出しをトグルで折りたたみ可能 |

### 3.3 実装方針

```typescript
// src/components/Sidebar/Outline.tsx

interface HeadingItem {
  id: string;        // 見出しテキストから生成したスラッグ
  level: number;     // 1〜6
  text: string;
  pos: number;       // ProseMirror ドキュメント内の位置
}

function extractHeadings(editor: Editor): HeadingItem[] {
  const headings: HeadingItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        id: slugify(node.textContent),
        level: node.attrs.level,
        text: node.textContent,
        pos,
      });
    }
  });
  return headings;
}

// クリックジャンプ
function scrollToHeading(editor: Editor, pos: number) {
  editor.chain().focus().setTextSelection(pos + 1).run();
  editor.view.dom.querySelector(`[data-pos="${pos}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

---

## 4. クイックオープン（Ctrl+P）

### 4.1 UI 設計

```
Ctrl+P で表示されるモーダル:

┌───────────────────────────────────────────────────┐
│ 🔍 ファイルを開く...                              │
├───────────────────────────────────────────────────┤
│  📄 README.md                          /          │
│  📄 2026-02-tauri.md         /blog/2026-02-tauri  │
│▶ 📄 system-design.md              /docs/ ← 選択中 │
│  📄 roadmap.md                        /docs/      │
│  📄 workspace-design.md              /docs/       │
└───────────────────────────────────────────────────┘
        ↑↓ で移動  Enter で開く  Esc で閉じる
```

### 4.2 ファジーマッチ設計

- ワークスペースがある場合: ワークスペース内の全 `.md`・`.html` ファイルを対象
- ワークスペースがない場合: 最近使ったファイル履歴を対象
- **マッチアルゴリズム**: fuse.js を使用したファジーマッチ（部分一致・スコアリング）
- 入力なし: 最近使ったファイルを降順で表示

### 4.3 キー操作

| キー | 動作 |
|------|------|
| `↑` / `↓` | 候補選択 |
| `Enter` | 選択ファイルを新規タブで開く（既存タブがあればフォーカス） |
| `Ctrl+Enter` | 強制的に新規タブで開く |
| `Esc` | パレットを閉じる |

---

## 5. コードブロック補助 UI

### 5.1 コピーボタン

レンダリング状態のコードブロック右上に **コピーボタン** をオーバーレイ表示する。

```
┌──────────────────────────────────────┐ [📋 コピー]
│ function hello() {                   │
│   console.log("Hello, World!");      │
│ }                                    │
└──────────────────────────────────────┘
```

- ホバー時のみ表示（CSS `:hover` で `opacity: 0 → 1`）
- クリックで `navigator.clipboard.writeText(codeContent)` を呼び出し
- コピー後 2 秒間「✓ コピー済み」に変化

### 5.2 行番号表示

`showLineNumbers` 設定（[user-settings-design.md](./user-settings-design.md) §2.2）が `true` の場合、ソースモードのコードブロックに行番号を表示する。

- CodeMirror 6 の `lineNumbers()` 拡張で実装
- WYSIWYG レンダリング時は行番号を非表示（Typora 互換）

### 5.3 言語セレクター

コードブロックフォーカス時にブロック上部に言語バッジを表示する。

```
[ javascript ▼ ]  ← クリックで言語選択ドロップダウン
┌──────────────────────────────────────┐
│ const x = 1;                        │
└──────────────────────────────────────┘
```

- ドロップダウンは highlight.js がサポートする主要言語一覧を表示
- 入力欄で言語名をフィルタリング可能
- 言語なし (`plaintext`) も選択可能

---

## 6. 画像のインラインリサイズ UI

### 6.1 リサイズハンドル

画像選択時に 4 隅と 4 辺中央に **リサイズハンドル** を表示する。

```
┌──────────────────────────┐
│ ◆──────────────────────◆ │  ◆ = リサイズハンドル
│ │                        │ │
│ │    [Image]             │ │
│ │                        │ │
│ ◆──────────────────────◆ │
└──────────────────────────┘
```

### 6.2 リサイズ動作

- **アスペクト比ロック**: デフォルトで縦横比を維持（Shift キーで解除）
- リサイズ結果は Markdown の属性として保存: `![alt](path){ width=400 }`
  - remark-attr / remark-image-size プラグイン対応
- サイズは px または % で指定可能（ツールチップに現在サイズを表示）

### 6.3 実装方針

```typescript
// src/renderer/wysiwyg/node-views/image-view.tsx
// ResizeObserver + pointerdown/pointermove/pointerup で実装

function ImageNodeView({ node, updateAttributes }: NodeViewProps) {
  const [isResizing, setIsResizing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleResizeStart = (e: PointerEvent, corner: Corner) => {
    e.preventDefault();
    setIsResizing(true);
    // pointermove で差分を計算して updateAttributes({ width, height })
  };

  return (
    <NodeViewWrapper>
      <img ref={imgRef} src={node.attrs.src} alt={node.attrs.alt}
           style={{ width: node.attrs.width, height: node.attrs.height }} />
      {isSelected && <ResizeHandles onResizeStart={handleResizeStart} />}
    </NodeViewWrapper>
  );
}
```

---

## 7. リンクのクリック動作設計

### 7.1 Typora 式モードでのリンク動作

| 操作 | 動作 |
|------|------|
| リンクをシングルクリック | フォーカスが含む段落ブロックに移動（編集状態） |
| リンクを **Ctrl+クリック** | リンク先を開く（後述） |
| リンクにカーソルがある状態で Enter | リンク先を開く |

### 7.2 リンク先の開き方

```
リンク URL の種類  → 動作
────────────────────────────────────────────
http:// / https://  → Tauri の open() でデフォルトブラウザで開く
./relative/path.md  → ワークスペース内ファイルとして新規タブで開く
./relative/path.html→ HTML 編集モードで新規タブで開く
#heading-id        → 同ファイル内の見出しへスクロール
mailto:            → デフォルトメールクライアントで開く
```

```typescript
// src/core/link-handler.ts
import { open } from '@tauri-apps/plugin-shell';

export async function openLink(href: string, currentFilePath: string, workspaceRoot: string | null) {
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    await open(href);
    return;
  }
  if (href.startsWith('#')) {
    scrollToAnchor(href.slice(1));
    return;
  }
  // ローカルファイル
  const resolved = resolveLocalPath(href, currentFilePath, workspaceRoot);
  if (resolved) {
    useTabStore.getState().openFile(resolved);
  }
}
```

### 7.3 リンクホバープレビュー

リンクにホバーすると URL または内部ファイルパスをツールチップで表示する。

---

## 8. ファイルツリーからの Markdown リンク挿入

### 8.1 D&D フロー

```
ファイルツリーの 📄 other-file.md をエディタへドラッグ
  │
  ├─ ドラッグ中: エディタに挿入ポイントインジケーターを表示
  │
  └─ ドロップ:
       現在ファイルからの相対パスを計算
       → [other-file](./path/to/other-file.md) を挿入
```

### 8.2 相対パス計算

```typescript
// src/core/link-inserter.ts
import { relative, dirname } from '@tauri-apps/api/path';

export async function buildRelativeLink(
  fromFilePath: string,
  toFilePath: string,
): Promise<string> {
  const fromDir = await dirname(fromFilePath);
  const relPath = await relative(fromDir, toFilePath);
  const fileName = toFilePath.split('/').pop()!.replace(/\.md$/, '');
  return `[${fileName}](./${relPath})`;
}
```

### 8.3 画像ファイルのドロップ

`.png`・`.jpg`・`.gif`・`.webp`・`.svg` のドロップは [image-storage-design.md](./image-storage-design.md) の画像保存フローに委譲し、
`![alt](./path/image.png)` 形式で挿入する。

---

## 9. スプリットビューのスクロール同期

### 9.1 同期アルゴリズム

スプリットビュー（左: ソース CodeMirror / 右: プレビュー）のスクロール同期は
**行番号ベースのプロポーショナル同期** を採用する。

```
手順:
1. 左ペイン（CodeMirror）のスクロール位置からビューポート内の先頭行番号を取得
2. その行番号に対応するプレビュー側の要素（見出し・段落）を検索
3. プレビューをその要素の位置へスムーズスクロール
```

### 9.2 実装方針

```typescript
// src/renderer/html/split-view.ts

let syncingFromSource = false;
let syncingFromPreview = false;

function onSourceScroll(cmView: EditorView) {
  if (syncingFromPreview) return;
  syncingFromSource = true;

  const { from } = cmView.viewport;
  const firstLine = cmView.state.doc.lineAt(from).number;

  // ソース全体の行数に対するスクロール率を計算
  const ratio = firstLine / cmView.state.doc.lines;

  // プレビューを対応する位置にスクロール
  const previewEl = document.getElementById('split-preview')!;
  previewEl.scrollTop = ratio * (previewEl.scrollHeight - previewEl.clientHeight);

  requestAnimationFrame(() => { syncingFromSource = false; });
}
```

### 9.3 同期の方向制御

- **相互同期ループ防止**: `syncingFromSource` / `syncingFromPreview` フラグで防止
- スクロールはユーザーが操作した側を優先（片方向のみ発火）
- 設定: 同期の有効/無効を切り替え可能（`splitSyncScroll: boolean`）

---

## 10. 空ドキュメントのプレースホルダー表示

### 10.1 プレースホルダー仕様

新規ドキュメントまたは空のドキュメントを開いたとき、エディタに **グレーテキストのプレースホルダー** を表示する。

```
（エディタ領域）

  Markdown を入力してください...

  ヒント: # で見出し、** で太字、``` でコードブロックを作成できます
```

### 10.2 実装方針

TipTap の `Placeholder` 拡張を使用する。

```typescript
// src/renderer/wysiwyg/plugins/placeholder.ts
import Placeholder from '@tiptap/extension-placeholder';

Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === 'heading') {
      return `見出し ${node.attrs.level}`;
    }
    // ドキュメントの最初の段落のみプレースホルダーを表示
    return 'Markdown を入力してください...';
  },
  showOnlyWhenEditable: true,
  showOnlyCurrent: false,  // 全空段落に表示
})
```

### 10.3 ウェルカムヒント

ドキュメントが完全に空（ノード数 = 1 かつ空の paragraph のみ）の場合に限り、
エディタ下部に折りたたみ可能なヒントパネルを表示する。

| ショートカット | 説明 |
|---|---|
| `# ` + テキスト | 見出し H1 |
| `**太字**` | 太字テキスト |
| ` ``` ` + Enter | コードブロック |
| `Ctrl+P` | ファイルを開く |

---

## 11. 矩形選択（Alt+ドラッグ）

### 11.1 モード別の可否

| エディタモード | 矩形選択 | 理由 |
|-------------|---------|------|
| WYSIWYG（TipTap/ContentEditable） | **無効**（通常の行選択にフォールバック） | ContentEditable は矩形選択の概念を持たず、ブラウザ API でも実現不可 |
| ソースモード（CodeMirror 6） | **有効** | `@codemirror/rectangular-selection` で完全サポート |

### 11.2 ソースモードでの矩形選択

CodeMirror 6 の公式拡張 `rectangularSelection()` を使用する。

```typescript
// src/renderer/source/source-editor.ts
import { rectangularSelection, crosshairCursor } from '@codemirror/rectangular-selection';

const extensions = [
  // ...既存の拡張
  rectangularSelection(),   // Alt+ドラッグで矩形選択を有効化
  crosshairCursor(),        // Alt キー押下中にカーソルをクロスヘア表示
];
```

**操作方法（ソースモード限定）:**

| 操作 | 動作 |
|------|------|
| `Alt+ドラッグ` | 矩形範囲をマウスで選択 |
| `Alt+Shift+↑↓←→` | キーボードで矩形選択を拡張 |
| `Ctrl+Alt+↑` / `Ctrl+Alt+↓` | カーソルを上/下行に複製（マルチカーソル）|

### 11.3 WYSIWYG モードでの代替 UI

WYSIWYG モードで `Alt+ドラッグ` を行った場合は、ブラウザデフォルトの行選択を維持し、
ステータスバーに「矩形選択はソースモードでのみ利用可能です」とツールチップ表示する。

---

## 12. テキスト整形コマンド

### 12.1 機能概要

選択範囲のテキストに対して一括変換処理を行うコマンド群。コマンドパレット（`Ctrl+Shift+P`）または右クリックメニューの「テキスト整形 ▶」サブメニューから呼び出す。

**選択範囲がない場合**: ドキュメント全体を対象として処理する。

### 12.2 コマンド一覧

| コマンド ID | 表示名 | 処理内容 |
|-----------|--------|---------|
| `text.sortAsc` | 行を昇順ソート | 選択行を辞書順昇順に並び替え |
| `text.sortDesc` | 行を降順ソート | 選択行を辞書順降順に並び替え |
| `text.removeDuplicates` | 重複行を削除 | 連続・非連続の重複行を除去（初回出現を残す）|
| `text.trimLeading` | 行頭の空白・タブを削除 | 各行の先頭にある半角スペース・タブを除去 |
| `text.trimTrailing` | 行末の空白・タブを削除 | 各行の末尾にある半角スペース・タブを除去 |
| `text.toUpperCase` | 大文字に変換 | ASCII 英字を大文字化（日本語は不変）|
| `text.toLowerCase` | 小文字に変換 | ASCII 英字を小文字化（日本語は不変）|
| `text.toFullWidth` | 半角→全角変換 | ASCII 半角英数字・記号を全角に変換 |
| `text.toHalfWidth` | 全角→半角変換 | 全角英数字・記号を半角に変換 |

### 12.3 実装方針

```typescript
// src/core/text-transform.ts

export function sortLines(text: string, order: 'asc' | 'desc'): string {
  const lines = text.split('\n');
  lines.sort((a, b) => order === 'asc' ? a.localeCompare(b, 'ja') : b.localeCompare(a, 'ja'));
  return lines.join('\n');
}

export function removeDuplicateLines(text: string): string {
  const seen = new Set<string>();
  return text.split('\n').filter(line => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  }).join('\n');
}

export function toFullWidth(text: string): string {
  // ASCII 0x21〜0x7E → 全角 0xFF01〜0xFF5E
  return text.replace(/[\x21-\x7E]/g, c =>
    String.fromCharCode(c.charCodeAt(0) + 0xFEE0)
  );
}
```

処理はすべて **Undo 可能**な TipTap コマンドとして実装し、`editor.commands.insertContent()` でテキストを置換する。

### 12.4 コンテキストメニューへの統合

テキスト選択時の右クリックメニューに「テキスト整形 ▶」サブメニューを追加する（[app-shell-design.md](./app-shell-design.md) §3.1 参照）。

---

## 13. 行ブックマークと F2 ジャンプ

### 13.1 UX 概要

長大な文書内の特定行をマークし、`F2` / `Shift+F2` で次/前のブックマークへ素早くジャンプする機能。

```
行番号ガター（左端）のレイアウト:

  3 │   ## はじめに
🔖 4 │   この文書は...           ← ブックマーク行（青い旗アイコン）
  5 │
  6 │   詳細については...
🔖 7 │   参照先: §3.2             ← ブックマーク行
  8 │
```

### 13.2 トグル操作

| 操作 | 動作 |
|------|------|
| 行番号ガターのクリック | その行のブックマークをトグル（追加/削除） |
| `Ctrl+F2` | カーソル行のブックマークをトグル |
| `F2` | 次のブックマークへジャンプ（末尾に達したら先頭に戻る）|
| `Shift+F2` | 前のブックマークへジャンプ |

### 13.3 実装方針（WYSIWYG モード）

TipTap の **Decoration API** を使用してハイライト表示する。

```typescript
// src/renderer/wysiwyg/plugins/bookmark.ts
import { Plugin, PluginKey, Decoration, DecorationSet } from '@tiptap/pm/state';

const bookmarkKey = new PluginKey('bookmark');

export const BookmarkPlugin = new Plugin({
  key: bookmarkKey,
  state: {
    init: () => ({ bookmarks: new Set<number>() }),  // Set of ProseMirror doc positions
    apply(tr, prev) {
      // ブックマーク位置をドキュメント変更に追従して更新
      const mapped = new Set([...prev.bookmarks].map(pos => tr.mapping.map(pos)));
      return { bookmarks: mapped };
    },
  },
  props: {
    decorations(state) {
      const { bookmarks } = bookmarkKey.getState(state)!;
      const decorations: Decoration[] = [];
      bookmarks.forEach(pos => {
        decorations.push(Decoration.node(pos, pos + 1, { class: 'bookmark-line' }));
      });
      return DecorationSet.create(state.doc, decorations);
    },
  },
});
```

```css
/* src/themes/editor.css */
.bookmark-line {
  background-color: rgba(59, 130, 246, 0.08);  /* 薄いブルー */
  border-left: 3px solid #3b82f6;
}
```

### 13.4 ソースモードでの対応

CodeMirror 6 では `@codemirror/gutter` と `@codemirror/state` の `StateField` を使用してガターマーカーとハイライトを実装する。

### 13.5 永続化

ブックマーク情報はファイルパスをキーとして `@tauri-apps/plugin-store` に保存し、セッション間で維持する。ファイル行番号で記録するため、ファイル編集によるズレは許容する（完全な位置追跡は将来課題）。

---

## 14. 単語の自動補完（Ctrl+Space）

### 14.1 機能概要

現在のドキュメント内に存在する単語を抽出し、入力中の文字列に対してサジェストを表示する機能。外部 AI や辞書サーバーは使用せず、すべてクライアントサイドで完結する。

```
ユーザーが「アーキ」と入力した場合のサジェスト:

  アーキ|          ← カーソル位置
  ┌─────────────────────────┐
  │ アーキテクチャ  (×3)    │  ← 文書内出現回数
  │ アーキビスト    (×1)    │
  └─────────────────────────┘
  Tab/Enter で確定  Esc で閉じる
```

### 14.2 単語リスト構築

```typescript
// src/core/word-completer.ts

export function buildWordList(text: string): Map<string, number> {
  const wordMap = new Map<string, number>();
  // Unicode 対応の単語境界で分割（日本語は文字単位、英語はスペース区切り）
  const words = text.match(/[\p{L}\p{N}ー々〆〇]+/gu) ?? [];
  for (const word of words) {
    if (word.length < 2) continue;  // 1 文字は除外
    wordMap.set(word, (wordMap.get(word) ?? 0) + 1);
  }
  return wordMap;
}
```

更新タイミング: 入力変化から **500ms デバウンス** でバックグラウンド更新（メインスレッドをブロックしない）。

### 14.3 サジェスト UI

| 項目 | 仕様 |
|------|------|
| トリガー | `Ctrl+Space`（手動）、または 2 文字以上入力で自動表示（設定でオフ可）|
| 候補数 | 最大 10 件 |
| ソート | 出現頻度降順 → アルファベット順 |
| 確定 | `Tab` または `Enter` |
| キャンセル | `Esc` または他のキー入力 |
| 位置 | カーソルの直下にフローティング表示（ビューポート端では上方向に反転）|

### 14.4 設定項目

| 設定キー | 型 | デフォルト | 説明 |
|---------|-----|-----------|------|
| `wordComplete.enabled` | `boolean` | `true` | 補完機能の有効/無効 |
| `wordComplete.autoTrigger` | `boolean` | `true` | 2 文字以上で自動表示 |
| `wordComplete.minWordLength` | `number` | `2` | 補完候補に含む最小文字数 |

---

## 15. ブロック境界カーソル脱出設計（カーソルトラップ回避）

### 15.1 問題：TipTap/ProseMirror 特有のカーソルトラップ現象

TipTap（ProseMirror）では、**アイランド型ノード**（コードブロック・テーブル・数式ブロック等）
の末尾でカーソルが「閉じ込められる」現象が発生する。矢印キー（↓ / →）だけでは
ブロックの外の新しい段落に抜け出せず、キーボードのみの操作が困難になる。

**影響を受けるノードタイプ**:

| ノードタイプ | カーソルトラップが発生しやすい箇所 |
|------------|--------------------------------|
| コードブロック（`codeBlock`） | 最終行の末尾 |
| テーブル（`table`）| 最終セル（右下）の末尾 |
| 数式ブロック（`mathBlock`） | ブロック全体（カーソルがブロック内に固定される） |
| カスタムコンテナ / Callout | コンテナ内の最終段落末尾 |
| 引用ブロック（`blockquote`） | ネストが深い引用の末尾（比較的軽微） |

### 15.2 脱出キーボードショートカットの設計

**メインの脱出手段: `Ctrl+Enter`（全プラットフォーム共通）**

| 操作 | 動作 |
|------|------|
| `Ctrl+Enter`（ブロック内にフォーカスがある場合） | ブロックの **直後** に新しい空段落を挿入し、カーソルを移動 |
| `Ctrl+Enter`（テーブル最終セルにフォーカスがある場合） | テーブルの **直後** に新しい空段落を挿入 |
| `Alt+↓`（ブロック末尾） | 補助手段: ブロック直後に移動（段落挿入なし） |

> **Typora との互換性**: Typora では `Ctrl+Enter` がコードブロック脱出に使われており、
> 既存ユーザーの習慣とも一致する。

### 15.3 TipTap プラグインによる実装

```typescript
// src/plugins/block-escape.ts

import { Extension } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';

/**
 * ブロックノードからカーソルを脱出させるキーボードショートカットプラグイン。
 *
 * Ctrl+Enter: ブロック直後に新しい段落を挿入してカーソルを移動する。
 */
export const BlockEscapeExtension = Extension.create({
  name: 'blockEscape',

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': ({ editor }) => {
        const { state, view } = editor;
        const { $from } = state.selection;

        // カーソルのブロック祖先ノードを探す
        const blockNodeTypes = [
          'codeBlock', 'table', 'mathBlock', 'blockquote',
          'bulletList', 'orderedList',
        ];

        // depth 0（doc）まで遡って最も外側のブロックを探す
        let targetDepth = -1;
        for (let depth = $from.depth; depth >= 1; depth--) {
          const node = $from.node(depth);
          if (blockNodeTypes.includes(node.type.name)) {
            targetDepth = depth;
            break;
          }
        }

        if (targetDepth < 0) {
          // ブロック内でない場合はデフォルト動作（段落内改行）
          return false;
        }

        // ブロックの終端位置を取得
        const blockEnd = $from.after(targetDepth);

        // ブロック直後に段落を挿入してカーソルを移動
        const { tr } = state;
        const paragraphNode = state.schema.nodes.paragraph.create();

        tr.insert(blockEnd, paragraphNode);
        tr.setSelection(TextSelection.create(tr.doc, blockEnd + 1));
        view.dispatch(tr);

        return true; // イベントを消費（デフォルト動作をキャンセル）
      },
    };
  },
});
```

### 15.4 テーブル固有の脱出処理

テーブルは `table > tableRow > tableCell > paragraph` という深いネスト構造を持つため、
最終セルの判定が必要:

```typescript
// blockEscapeExtension 内の追加ハンドラ

'Tab': ({ editor }) => {
  const { state } = editor;
  const { $from } = state.selection;

  // テーブル最終セルかどうかを判定
  if ($from.node(-1)?.type.name === 'tableCell') {
    const tableNode = findParentNodeOfType(state.schema.nodes.table)(state.selection);
    if (!tableNode) return false;

    const lastCell = getLastCellPos(tableNode, state.doc);
    if ($from.pos >= lastCell) {
      // 最終セルで Tab → テーブル直後に新しい行を追加
      // （通常 Tab は次セルに移動するが、最終セルでは動作が必要）
      return editor.commands.addRowAfter(); // テーブル最終行を追加
    }
  }

  return false; // テーブル外では通常の Tab 動作
},
```

### 15.5 UI による視覚的ヒント

カーソルがトラップ発生しやすいブロックにある場合、ヒントを表示する:

```
コードブロック内でカーソルが最終行末尾にある時:

┌─────────────────────────────────────────────────────────┐
│ ```rust                                                 │
│ fn main() {                                             │
│     println!("Hello");                                  │
│ }█  ← カーソルがここにある時                            │
└─────────────────────────────────────────────────────────┘
                                     [Ctrl+Enter で脱出]  ← ツールチップ
```

```typescript
// src/components/editor/BlockEscapeHint.tsx

import { useEditorContext } from '../../hooks/useEditorContext';

export function BlockEscapeHint() {
  const editor = useEditorContext();
  const [visible, setVisible] = useState(false);
  const [hintPos, setHintPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const checkCursorPosition = () => {
      const { $from } = editor.state.selection;
      const isInBlock = ['codeBlock', 'table', 'mathBlock']
        .some(t => editor.isActive(t));
      setVisible(isInBlock);
    };

    editor.on('selectionUpdate', checkCursorPosition);
    return () => editor.off('selectionUpdate', checkCursorPosition);
  }, [editor]);

  if (!visible) return null;

  return (
    <div className="block-escape-hint" aria-label="ブロック脱出ヒント">
      <kbd>Ctrl+Enter</kbd> で脱出
    </div>
  );
}
```

### 15.6 キーボードショートカット一覧への追記

`keyboard-shortcuts.md §1` のアプリ全体ショートカット表に以下を追加すること:

| ショートカット | 動作 | 対象 |
|-------------|------|------|
| `Ctrl+Enter` | ブロック直後に新しい段落を挿入してカーソルを移動 | コードブロック・テーブル・数式ブロック・カスタムコンテナ内 |

---

## 関連ドキュメント

- [system-design.md](../01_Architecture/system-design.md) — Typora 式カーソル位置計算・NodeView 設計
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — Ctrl+Enter 等のショートカット定義
- [user-settings-design.md](../07_Platform_Settings/user-settings-design.md) — showLineNumbers・smartQuotes 等の設定
- [accessibility-design.md](./accessibility-design.md) — キーボードのみの操作フロー（roving tabindex）
