# 双方向リンク（Wikiリンク）・バックリンク設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [Wikiリンク記法の仕様](#2-wikiリンク記法の仕様)
3. [オートコンプリート設計](#3-オートコンプリート設計)
4. [バックリンクパネル設計](#4-バックリンクパネル設計)
5. [インデックス設計](#5-インデックス設計)
6. [リンク解決ロジック](#6-リンク解決ロジック)
7. [ファイルリネーム時の自動更新](#7-ファイルリネーム時の自動更新)
8. [WYSIWYG 表示設計](#8-wysiwyg-表示設計)
9. [実装方針](#9-実装方針)
10. [Markdown 出力形式](#10-markdown-出力形式)

---

## 1. 概要と目的

### 1.1 概要

`[[ファイル名]]` と入力するだけで同じワークスペース内の別ファイルへのリンクを作成し、リンク先のファイルには「このページへのリンク（バックリンク）」をサイドバーパネルに表示する機能。

### 1.2 目的・設計思想

- Obsidian・Roam Research 等で普及したナレッジネットワーク構築のUXを採用
- ワークスペース機能（フォルダ管理）と組み合わせることで、ファイル同士をグラフ状に繋いだ **パーソナルナレッジベース（PKM）** として機能する
- 既存の標準 Markdown リンク (`[text](path)`) と共存し、どちらも使用可能

---

## 2. Wikiリンク記法の仕様

### 2.1 基本記法

```markdown
[[ファイル名]]                    # ファイル名表示
[[ファイル名|表示テキスト]]        # 任意の表示テキストを指定
[[ディレクトリ/ファイル名]]        # パスを含む指定
[[ファイル名#見出し]]              # 見出しへのアンカー指定
[[ファイル名#見出し|表示テキスト]] # 全オプション組み合わせ
```

### 2.2 記法の詳細ルール

| 記法要素 | 仕様 |
|---------|------|
| ファイル名の大文字小文字 | 大文字小文字を区別しない（OS依存を避けるため） |
| 拡張子 | `.md` は省略可（`[[note]]` → `note.md` を解決）|
| 重複ファイル名 | ファイル名+パスの候補リストを表示して選択させる |
| 存在しないファイル | **未解決リンク**として表示（赤色・波線下線） |
| スペース | `[[my note]]`（スペースを含むファイル名をそのまま記述）|

---

## 3. オートコンプリート設計

### 3.1 UX フロー

```
1. ユーザーが [[ を入力
2. ワークスペース内のファイル候補ポップアップが表示される
3. 文字を入力するとリアルタイムでファジーフィルタリング
4. ↑↓ で選択、Enter または Tab で確定
5. 確定後: [[ファイル名]] が挿入され ]] 後ろにカーソル移動
```

### 3.2 候補ポップアップ

```
[[ を入力後:

┌──────────────────────────────────────────────┐
│ 🔍 note                                      │  ← 入力中のクエリ
├──────────────────────────────────────────────┤
│ 📄 meeting-notes.md          /docs/          │
│ ▶ 📄 meeting-notes-2026.md   /docs/ ← 選択中 │
│ 📄 note-taking-tips.md       /blog/          │
│ 📄 design-notes.md           /               │
└──────────────────────────────────────────────┘
  ↑↓ で移動  Enter で選択  Esc で閉じる
```

### 3.3 候補表示ルール

- **ソート**: 最近開いたファイル順（LRU）> ファジーマッチスコア順
- **除外**: 現在編集中のファイル自身は除外
- **最大表示数**: 10 件（超過時はスクロール可）

---

## 4. バックリンクパネル設計

### 4.1 パネル表示

サイドバーの「バックリンク」タブとして実装する。

```
┌────────────────────────────────────────────────────┐
│ バックリンク                          [更新 🔄]    │
├────────────────────────────────────────────────────┤
│ このファイルへのリンク: 3 件                       │
├────────────────────────────────────────────────────┤
│ 📄 project-overview.md              /              │
│   > 設計については [[system-design]] を参照...    │  ← コンテキスト引用
│                                                    │
│ 📄 roadmap.md                       /docs/         │
│   > 詳細は [[system-design#アーキテクチャ]] へ... │
│                                                    │
│ 📄 README.md                        /              │
│   > ドキュメント一覧: [[system-design]]           │
└────────────────────────────────────────────────────┘
```

### 4.2 バックリンク機能

| 機能 | 詳細 |
|------|------|
| リンク元のクリック | リンク元ファイルを新規タブで開き、該当行へジャンプ |
| コンテキスト表示 | リンクを含む段落のテキスト（最大140文字）を引用表示 |
| リアルタイム更新 | ファイル保存時にバックリンクインデックスを自動更新 |
| 未解決リンク表示 | バックリンクとして解決済みリンクのみ表示（未解決は別セクション） |

---

## 5. インデックス設計

### 5.1 インデックス構造

ワークスペース内の全 `.md` ファイルをスキャンし、Wikiリンクのインデックスを構築・管理する。

```typescript
// src/core/wikilinks/index.ts

interface WikilinkIndex {
  /** ファイルパス → そのファイルが持つ Wikiリンク一覧 */
  outgoingLinks: Map<string, WikilinkEntry[]>;

  /** リンク解決名（ファイル名）→ リンク元ファイルパス一覧（バックリンク） */
  incomingLinks: Map<string, BacklinkEntry[]>;

  /** ファイル名（拡張子なし）→ 実際のファイルパス一覧（重複解決用） */
  fileNameMap: Map<string, string[]>;
}

interface WikilinkEntry {
  targetName: string;     // [[targetName]] の targetName 部分
  targetAnchor?: string;  // #見出し 部分
  displayText?: string;   // |表示テキスト 部分
  lineNumber: number;     // リンクが存在する行番号
  context: string;        // 周辺テキスト（コンテキスト表示用）
}

interface BacklinkEntry {
  sourceFilePath: string;
  lineNumber: number;
  context: string;
}
```

### 5.2 インデックス更新タイミング

| イベント | 動作 |
|---------|------|
| ワークスペースを開く | 全ファイルをスキャンしてインデックスを構築（バックグラウンド） |
| ファイル保存時 | 保存したファイルのリンクを更新 |
| ファイル作成時 | 新ファイルをインデックスに追加 |
| ファイル削除時 | インデックスから削除（他ファイルの未解決リンクが増える） |
| ファイルリネーム時 | リネーム処理と連動して更新（§7 参照） |

### 5.3 パフォーマンス考慮

- インデックス構築は Tauri バックエンド（Rust）で実装し、walkdir クレートでスキャン
- 差分更新（変更ファイルのみ再スキャン）でパフォーマンスを維持
- フロントエンドには `zustand` ストアで結果を同期

---

## 6. リンク解決ロジック

### 6.1 ファイル解決の優先順位

`[[note]]` を解決する場合:

```
1. 現在ファイルと同じディレクトリ内の note.md
2. ワークスペース直下の note.md
3. ワークスペース全体で一意に解決できる note.md
4. 複数候補 → ユーザーに選択を促す（次回から記憶）
5. 解決不可 → 未解決リンクとして表示
```

### 6.2 見出しアンカーの解決

```typescript
// [[ファイル名#見出しテキスト]] の解決
function resolveAnchor(filePath: string, anchorText: string): number | null {
  // ファイルの見出し一覧から、スラッグ化した値で一致する見出しの行番号を返す
  const headings = extractHeadingsFromFile(filePath);
  return headings.find(h => slugify(h.text) === slugify(anchorText))?.lineNumber ?? null;
}
```

---

## 7. ファイルリネーム時の自動更新

### 7.1 自動更新の仕組み

ワークスペース内でファイルをリネームすると、そのファイルへの Wikiリンクを自動的に更新する。

```
ファイルリネーム: old-name.md → new-name.md

自動更新対象:
  - [[old-name]] → [[new-name]]
  - [[old-name|表示テキスト]] → [[new-name|表示テキスト]]
  - [[old-name#見出し]] → [[new-name#見出し]]
```

### 7.2 UX フロー

```
1. ファイルリネーム実行
2. トースト通知: 「○○のリンクを X 件更新しますか？」[更新する] [スキップ]
3. [更新する] 選択時: バックグラウンドで一括更新
4. 更新完了後: 「X 件のリンクを更新しました」（Undo 可能）
```

- 既存の標準 Markdown リンク (`[text](path)`) も同時に更新対象
- 詳細は [workspace-design.md](./workspace-design.md) §6「リネーム・移動時のリンク自動更新」と連携

---

## 8. WYSIWYG 表示設計

### 8.1 解決済みリンクの表示

```
WYSIWYG モードでの表示:

  解決済み: [meeting-notes]  ← クリックで対象ファイルを開く（下線付き・青色）
  未解決:   [broken-link]    ← 赤色・波線下線（ファイルが存在しない）
```

### 8.2 NodeView 設計

```typescript
// src/renderer/wysiwyg/node-views/wikilink-view.tsx

interface WikilinkAttrs {
  targetName: string;
  targetAnchor?: string;
  displayText?: string;
  resolvedPath?: string;  // 解決済みファイルパス（null なら未解決）
}

function WikilinkNodeView({ node }: NodeViewProps) {
  const { targetName, targetAnchor, displayText, resolvedPath } = node.attrs;
  const isResolved = resolvedPath !== null;
  const label = displayText || targetName + (targetAnchor ? `#${targetAnchor}` : '');

  return (
    <NodeViewWrapper
      as="span"
      className={isResolved ? 'wikilink-resolved' : 'wikilink-unresolved'}
      onClick={() => isResolved && openFile(resolvedPath)}
      title={isResolved ? resolvedPath : 'ファイルが見つかりません'}
    >
      {label}
    </NodeViewWrapper>
  );
}
```

### 8.3 ソースモードでの表示

ソースモードでは `[[ファイル名]]` がそのままシンタックスハイライト付きで表示される。

---

## 9. 実装方針

### 9.1 TipTap 拡張

```typescript
// src/renderer/wysiwyg/extensions/wikilink.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { InputRule } from 'prosemirror-inputrules';

export const WikilinkExtension = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,  // 内部は編集不可のアトムノード

  addAttributes() {
    return {
      targetName: { default: null },
      targetAnchor: { default: null },
      displayText: { default: null },
      resolvedPath: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-wikilink': '' }, HTMLAttributes)];
  },

  addInputRules() {
    return [
      // [[ で始まり ]] で終わるパターンを検出
      new InputRule(
        /\[\[([^\]]+)\]\]/,
        (state, match, start, end) => {
          const [fullMatch, inner] = match;
          const [nameAndAnchor, displayText] = inner.split('|');
          const [targetName, targetAnchor] = nameAndAnchor.split('#');
          // WikilinkIndex から resolvedPath を解決
          const resolvedPath = wikilinkStore.resolve(targetName);
          return state.tr.replaceWith(start, end, this.type.create({
            targetName, targetAnchor, displayText, resolvedPath,
          }));
        }
      ),
    ];
  },
});
```

### 9.2 Zustand ストア

```typescript
// src/store/wikilinkStore.ts
interface WikilinkStore {
  index: WikilinkIndex;
  buildIndex: (workspaceRoot: string) => Promise<void>;
  resolve: (targetName: string, fromFilePath?: string) => string | null;
  getBacklinks: (filePath: string) => BacklinkEntry[];
  updateOnSave: (filePath: string, content: string) => void;
}
```

---

## 10. Markdown 出力形式

### 10.1 保存時の形式

Wikiリンクは `.md` ファイルに保存する際、そのまま `[[...]]` 記法で保存する。

```markdown
設計については [[system-design]] を参照してください。

また [[ai-features|AI 機能の詳細]] も参照すること。
```

### 10.2 標準 Markdown リンクとの共存

- `[[...]]` 形式と `[text](path)` 形式は完全に共存
- エクスポート時（HTML/PDF）は `[[...]]` を `<a href="./target.html">...</a>` に変換
- 変換オプション: エクスポートダイアログで Wikiリンクを通常リンクに展開するかを選択可能

---

## 関連ドキュメント

- [workspace-design.md](./workspace-design.md) — ワークスペース・ファイルツリー設計（リネーム時リンク更新）
- [editor-ux-design.md](./editor-ux-design.md) §7 — リンクのクリック動作設計
- [search-design.md](./search-design.md) — 全文検索設計（Wikiリンクのインデックス連携）
- [export-design.md](./export-design.md) — エクスポート時の Wikiリンク変換
- [performance-design.md](./performance-design.md) — バックグラウンドインデックス更新のパフォーマンス
