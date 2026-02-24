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

## 関連ドキュメント

- [system-design.md](./system-design.md) — Typora 式カーソル位置計算・NodeView 設計
- [workspace-design.md](./workspace-design.md) — ファイルツリー・クロスファイルリンク解決
- [user-settings-design.md](./user-settings-design.md) — showLineNumbers・smartQuotes 等の設定
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — Ctrl+P・Ctrl+クリック等のショートカット
