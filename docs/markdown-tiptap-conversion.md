# Markdown ↔ TipTap 双方向変換 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-23

---

## 目次

1. [設計方針の概要](#1-設計方針の概要)
2. [mdast ↔ TipTap スキーマ マッピング](#2-mdast--tiptap-スキーマ-マッピング)
3. [Source-of-Truth アーキテクチャ比較と採用方針](#3-source-of-truth-アーキテクチャ比較と採用方針)
4. [生HTML の表現・保持戦略](#4-生html-の表現保持戦略)
5. [ラウンドトリップテスト実装方針](#5-ラウンドトリップテスト実装方針)
6. [GFM拡張の変換課題と対策](#6-gfm拡張の変換課題と対策)
7. [実装優先度](#7-実装優先度)

---

## 1. 設計方針の概要

本エディタにおける Markdown ↔ TipTap 変換は、以下の原則に基づいて設計する。

```
.md ファイル
    │
    │ remark parse（unified）
    ▼
mdast（Markdown AST）
    │
    │ mdastToTipTap()  ← 本モジュールの責務
    ▼
TipTap JSON（ProseMirror Document）  ← 編集中の SoT
    │
    │ tiptapToMdast()  ← 本モジュールの責務
    ▼
mdast
    │
    │ remark-stringify
    ▼
.md ファイル（正規化済み）
```

**変換の最重要原則**:

- `mdastToTipTap()` は **完全忠実** であること（情報の欠落を許さない）
- `tiptapToMdast()` は **安定した正規化** を行うこと（同じ内容は常に同じMDを出力）
- 生HTML・フロントマター等の「TipTap で意味をなさない要素」は **不透明ノード** として保持し、改変しない

---

## 2. mdast ↔ TipTap スキーマ マッピング

### 2.1 ブロックノードのマッピング

| mdast ノード | TipTap / PM ノード | 保持すべき属性 | 注意点 |
|---|---|---|---|
| `root` | `doc` | — | — |
| `paragraph` | `paragraph` | — | — |
| `heading` (depth: 1–6) | `heading` | `level` (= depth) | — |
| `blockquote` | `blockquote` | — | 入れ子も再帰的に変換 |
| `list` (ordered: false) | `bulletList` | — | tight/loose は `spread` attr で保持 |
| `list` (ordered: true) | `orderedList` | `start` | `start` 属性を必ず保持 |
| `listItem` | `listItem` | `spread` | tight/loose 区別（後述） |
| `code` (fenced) | `codeBlock` | `language` | `info` string から言語を抽出 |
| `thematicBreak` | `horizontalRule` | — | — |
| `html` (block) | `rawHtmlBlock` ★カスタム | `html` (生文字列) | **改変禁止** |
| `table` | `table` | — | `align` は各セルに分配 |
| `tableRow` | `tableRow` | — | — |
| `tableCell` | `tableCell` | `align`, `isHeader` | GFM align を col 単位で保持 |
| `yaml` (frontmatter) | `frontmatter` ★カスタム | `value` (YAML文字列) | remark-frontmatter 使用 |
| `math` (block) | `mathBlock` ★カスタム | `value` | remark-math 使用 |

### 2.2 インラインノード・マークのマッピング

| mdast ノード | TipTap Mark / ノード | 保持すべき属性 | 注意点 |
|---|---|---|---|
| `text` | テキストノード | — | — |
| `strong` | `bold` mark | — | **ネスト→フラット変換** が必要 |
| `emphasis` | `italic` mark | — | 同上 |
| `delete` | `strike` mark | — | remark-gfm 必要 |
| `inlineCode` | `code` mark | — | — |
| `link` | `link` mark | `href`, `title` | `url`, `title` の属性名変換に注意 |
| `image` | `image` ノード | `src`, `alt`, `title` | `url`→`src` に変換 |
| `break` (hard break) | `hardBreak` | — | `\n` → `<br>` 相当 |
| `html` (inline) | `rawHtmlInline` ★カスタム | `html` (生文字列) | **改変禁止** |
| `footnoteReference` | `footnoteRef` ★カスタム | `identifier` | 定義は doc attrs に保持 |
| `inlineMath` | `mathInline` ★カスタム | `value` | remark-math 使用 |

### 2.3 マーク変換の非対称性（最重要）

mdast は**ネスト構造**でマークを表現し、ProseMirror は**フラット構造**でテキストノードにマークを付与する。この構造差が変換の最難関。

#### mdast → TipTap（ネスト→フラット）

```typescript
// src/core/converter/mdast-to-tiptap.ts

/**
 * mdast インラインノードを ProseMirror ノード列に変換する。
 * マークを再帰的に収集してフラット化する。
 */
function convertInline(node: MdastNode, marks: PMark[] = []): PMNode[] {
  switch (node.type) {
    case 'text':
      return [schema.text(node.value, marks.length ? marks : null)];

    case 'strong':
      return node.children.flatMap(child =>
        convertInline(child, [...marks, schema.marks.bold.create()])
      );

    case 'emphasis':
      return node.children.flatMap(child =>
        convertInline(child, [...marks, schema.marks.italic.create()])
      );

    case 'delete':
      return node.children.flatMap(child =>
        convertInline(child, [...marks, schema.marks.strike.create()])
      );

    case 'inlineCode':
      return [schema.text(node.value, [schema.marks.code.create()])];

    case 'link':
      const linkMark = schema.marks.link.create({ href: node.url, title: node.title });
      return node.children.flatMap(child =>
        convertInline(child, [...marks, linkMark])
      );

    case 'image':
      return [schema.nodes.image.create({ src: node.url, alt: node.alt, title: node.title })];

    case 'break':
      return [schema.nodes.hardBreak.create(null, null, marks)];

    case 'html':
      return [schema.nodes.rawHtmlInline.create({ html: node.value })];

    default:
      return [];
  }
}
```

#### TipTap → mdast（フラット→ネスト再構築）

```typescript
// src/core/converter/tiptap-to-mdast.ts

/**
 * ProseMirror テキストノードのマーク差分から mdast ネスト構造を再構築する。
 * ★ これが最もバグを生みやすい箇所。ここに最重点でテストを書く。
 */
function convertPMTextToMdast(node: PMNode): MdastNode {
  const marks = node.marks ?? [];

  // マークがなければ plain text
  if (marks.length === 0) {
    return { type: 'text', value: node.text ?? '' };
  }

  // マークをネストで包む（最初のマークが最外側）
  let inner: MdastNode = { type: 'text', value: node.text ?? '' };
  for (const mark of [...marks].reverse()) {
    inner = wrapWithMark(mark, inner);
  }
  return inner;
}

function wrapWithMark(mark: PMark, child: MdastNode): MdastNode {
  switch (mark.type.name) {
    case 'bold':      return { type: 'strong', children: [child] };
    case 'italic':    return { type: 'emphasis', children: [child] };
    case 'strike':    return { type: 'delete', children: [child] };
    case 'code':      return { type: 'inlineCode', value: (child as MdastText).value };
    case 'link':      return { type: 'link', url: mark.attrs.href, title: mark.attrs.title, children: [child] };
    default:          return child;
  }
}
```

> **注意**: 隣接するテキストノードで同じマークが続く場合は、mdast 変換時にマージして一つの strong/emphasis ノードにまとめること。

---

## 3. Source-of-Truth アーキテクチャ比較と採用方針

### 3.1 2つのアーキテクチャの比較

#### File-as-Source-of-Truth（ファイル優先）

.md ファイルを正典とし、TipTap はビューとして機能する。

```
[ファイル] ←→ [mdast] ←→ [TipTap JSON]
     ↑
  正典（SoT）
```

| 観点 | 評価 |
|------|------|
| Markdown の品質 | ◎ 常に正規の Markdown が保たれる |
| 他エディタとの共存 | ◎ ファイルが常に正しい |
| バージョン管理との親和性 | ◎ git diff が常に意味のある diff になる |
| 実装難易度 | ✗ 双方向変換が完全である必要があり高コスト |
| パフォーマンス | △ 編集ごとに MD→AST→PM 変換が必要、デバウンス必須 |
| TipTap 独自機能 | ✗ MD に対応する表現がない機能は使えない |

#### Editor-as-Source-of-Truth（エディタ優先）

TipTap 内部ドキュメントを正典とし、Markdown は保存時にシリアライズ。

```
[TipTap JSON]
     ↑
  正典（SoT）
     ↓
[ファイル]（保存時のみ）
```

| 観点 | 評価 |
|------|------|
| Markdown の品質 | △ 保存時のシリアライザの品質に依存、劣化リスクあり |
| 他エディタとの共存 | △ 外部変更を取り込む仕組みが別途必要 |
| 実装難易度 | ◯ 一方向変換（TipTap→MD）だけ完全であればよい |
| パフォーマンス | ◎ 編集は TipTap 任せで高速 |
| TipTap 独自機能 | ◎ MD 外の機能も自由に使える |

### 3.2 採用方針：ハイブリッド戦略（推奨）

個人開発の工数を考慮し、**ハイブリッド戦略**を採用する。

```
読み込み時: .md → mdast → TipTap JSON（一方向、完全忠実）
編集中: TipTap JSON が SoT
保存時: TipTap JSON → mdast → .md（正規化済み出力）
外部変更: ファイルウォッチャーが検知 → ダイアログで「再読込」を促す
```

**完全な File-as-SoT を採用しない理由**:
- 双方向変換が完全に揃うまで保存のたびにデータが壊れるリスクがある
- ラウンドトリップテストが全てパスするまで File-as-SoT は危険
- 個人開発の初期フェーズでは Editor-as-SoT の方が安全に実装を進められる

**Editor-as-SoT への移行パス**:
- Phase 1: ハイブリッド戦略でスタート
- Phase 2: ラウンドトリップテストが全フィクスチャでパスしたら File-as-SoT に移行検討

### 3.3 外部変更の検知と対応

```typescript
// src/file/watcher.ts

import { watch } from '@tauri-apps/plugin-fs';

export function setupFileWatcher(filePath: string, onExternalChange: () => void) {
  return watch(filePath, (event) => {
    if (event.type === 'modify') {
      // エディタが「自分の保存」で発火した変更は無視する
      // （保存フラグで区別）
      onExternalChange();
    }
  });
}
```

外部変更検知時のUI：
- トースト通知「外部で変更されました。再読込しますか？」
- 「再読込」→ ファイルを再パースして TipTap ドキュメントを更新（Undo 履歴はクリア）
- 「無視」→ 次回保存時に TipTap の内容でファイルを上書き

---

## 4. 生HTML の表現・保持戦略

### 4.1 基本方針

生HTML は **不透明（opaque）** として扱う。TipTap でパースや解釈を試みず、文字列としてそのまま保持する。改変するとラウンドトリップが破綻する。

> **禁止**: rehype-sanitize 等でHTMLを正規化すること
> **必須**: 生文字列を attr に格納し、MD出力時にそのまま吐き出すこと

### 4.2 ケース別対応

| HTML の種類 | 対応方針 | 実装 |
|---|---|---|
| `<br>` | `HardBreak` ノードにマップ | TipTap 標準ノードで OK |
| ブロックHTML（`<div>`, `<details>` 等） | `rawHtmlBlock` カスタムノード | atom ノード、contentEditable=false |
| インラインHTML（`<span>`, `<abbr>` 等） | `rawHtmlInline` カスタムノード | atom ノード、contentEditable=false |
| HTMLコメント `<!-- ... -->` | `rawHtmlBlock` カスタムノード | atom ノード |
| `<table>` (生HTML) | `rawHtmlBlock` カスタムノード | GFMテーブルとは別扱い |

### 4.3 rawHtmlBlock カスタムノード実装

```typescript
// src/renderer/wysiwyg/extensions/raw-html-block.ts

import { Node, mergeAttributes } from '@tiptap/core';

export const RawHtmlBlock = Node.create({
  name: 'rawHtmlBlock',
  group: 'block',
  atom: true,        // 内部を編集不可にする
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      html: {
        default: '',
        // HTML を属性として保持（改変しない）
        parseHTML: el => el.getAttribute('data-raw-html') ?? '',
        renderHTML: attrs => ({ 'data-raw-html': attrs.html }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-raw-html]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'raw-html-block' }), 0];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const container = document.createElement('div');
      container.className = 'raw-html-block-view';
      container.contentEditable = 'false';

      // 生HTMLをそのまま描画（表示目的）
      const preview = document.createElement('div');
      preview.innerHTML = node.attrs.html;
      container.appendChild(preview);

      return { dom: container };
    };
  },
});
```

```typescript
// mdast → TipTap への組み込み
case 'html': // mdast blockHtml
  return {
    type: 'rawHtmlBlock',
    attrs: { html: node.value },  // 生文字列をそのまま格納
  };
```

```typescript
// TipTap → mdast への組み込み
case 'rawHtmlBlock':
  return {
    type: 'html',
    value: node.attrs.html,  // 格納した生文字列をそのまま出力
  };
```

### 4.4 rawHtmlInline カスタムノード実装

```typescript
// src/renderer/wysiwyg/extensions/raw-html-inline.ts

import { Node } from '@tiptap/core';

export const RawHtmlInline = Node.create({
  name: 'rawHtmlInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      html: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-raw-html-inline]' }];
  },

  renderHTML({ node }) {
    return ['span', { 'data-raw-html-inline': node.attrs.html, class: 'raw-html-inline-view' }];
  },
});
```

---

## 5. ラウンドトリップテスト実装方針

### 5.1 テストハーネス

```typescript
// tests/roundtrip/roundtrip.test.ts

import { describe, test, expect } from 'vitest';
import { markdownToTipTap } from '../../src/core/converter/mdast-to-tiptap';
import { tiptapToMarkdown } from '../../src/core/converter/tiptap-to-mdast';

/**
 * MD → TipTap JSON → MD のラウンドトリップを実行して返す。
 */
function roundTrip(md: string): string {
  const doc = markdownToTipTap(md);
  return tiptapToMarkdown(doc);
}

// フィクスチャファイルベースのテスト
const fixtures = import.meta.glob('./fixtures/*.md', { as: 'raw', eager: true });

describe('Markdown round-trip', () => {
  for (const [path, content] of Object.entries(fixtures)) {
    test(path, () => {
      expect(roundTrip(content as string)).toBe(content);
    });
  }
});

// 個別ケースのユニットテスト（デバッグ用）
describe('Inline mark edge cases', () => {
  test('ネストしたボールドと斜体', () => {
    const md = '***bold and italic***\n';
    expect(roundTrip(md)).toBe(md);
  });

  test('リンク内の太字', () => {
    const md = '[**bold link**](https://example.com)\n';
    expect(roundTrip(md)).toBe(md);
  });

  test('コードスパン内のアスタリスクは無視', () => {
    const md = '`code with *asterisk*`\n';
    expect(roundTrip(md)).toBe(md);
  });
});
```

### 5.2 フィクスチャファイル一覧

```
tests/roundtrip/fixtures/
  01-headings-atx.md          # ATX 見出し（# H1 〜 ###### H6）
  02-headings-setext.md       # setext 見出し（===, ---）→ ATX に正規化
  03-paragraph.md             # 段落、改行、連続段落
  04-emphasis-basic.md        # bold、italic、strikethrough の基本
  05-emphasis-nested.md       # ネストしたマーク（***、_**_** 等）
  06-emphasis-overlap.md      # マークの境界が重なるケース
  07-lists-tight.md           # タイトリスト（項目間に空行なし）
  08-lists-loose.md           # ルーズリスト（項目間に空行あり）
  09-lists-nested.md          # 入れ子リスト（ol > ul > ol 等）
  10-lists-ordered-start.md   # ordered list の start 属性（5. から始まる等）
  11-codeblock-fenced.md      # フェンスコードブロック（言語指定あり/なし）
  12-codeblock-indent.md      # インデントコードブロック
  13-blockquote-basic.md      # 引用ブロック
  14-blockquote-nested.md     # 入れ子引用ブロック
  15-links-inline.md          # インラインリンク（title あり/なし）
  16-links-reference.md       # 参照リンク（省略形含む）→ インラインに正規化
  17-images.md                # 画像（alt, title）
  18-tables-gfm.md            # GFM テーブル、列揃え（left/center/right）
  19-tasklist-gfm.md          # タスクリスト（チェック済み / 未 / 通常リストとの混在）
  20-footnotes-gfm.md         # 脚注参照と定義
  21-strikethrough-gfm.md     # 取り消し線
  22-raw-html-block.md        # ブロック生HTML（<div>, <details>, <!-- --> 等）
  23-raw-html-inline.md       # インライン生HTML（<span>, <abbr> 等）
  24-linebreak-hard.md        # ハードブレーク（行末スペース2つ、バックスラッシュ）
  25-thematic-break.md        # 水平線（***, ---, ___ → --- に正規化）
  26-frontmatter-yaml.md      # YAML フロントマター
  27-math-block.md            # 数式ブロック（$$...$$）
  28-math-inline.md           # インライン数式（$...$）
  29-unicode-cjk.md           # 日本語・中国語・韓国語テキスト
  30-unicode-emoji.md         # 絵文字・ZWJ シーケンス
  31-escape-chars.md          # バックスラッシュエスケープ
  32-html-entities.md         # HTML 実体参照（&amp; &lt; 等）
  33-empty-elements.md        # 空段落、空リスト項目、空見出し
  34-edge-trailing-newline.md # ファイル末尾改行の扱い
```

### 5.3 シリアライザの正規化ルール（明示的に決定する）

ラウンドトリップテストを安定させるために、以下の正規化を **意図的な仕様** として採用する。フィクスチャはこの正規化後の形式で記述する。

| 要素 | 正規化ルール |
|---|---|
| 見出し | 常に ATX 形式（`# H1`）。setext 形式は変換時に ATX に |
| リストマーカー | 常に `-`（`*`、`+` は `-` に統一） |
| 水平線 | 常に `---` |
| 強調 | `**bold**`（`__bold__` は `**` に統一） |
| 斜体 | `*italic*`（`_italic_` は `*` に統一） |
| 参照リンク | インラインリンクに展開 |
| コードフェンス | バックティック3つ（`` ` `` ）のみ。チルダ（`~~~`）は変換 |
| ファイル末尾 | 改行1つで終端 |

> `remark-stringify` のオプションで上記を設定することで自動的に正規化される。

---

## 6. GFM拡張の変換課題と対策

### 6.1 テーブル

#### 問題: 列の align 情報の欠落

```typescript
// mdast table の align 配列を各セルの attr として分配する
function convertTable(node: MdastTable): TipTapNode {
  const aligns = node.align ?? [];  // ['left', 'center', null, 'right'] 等

  return {
    type: 'table',
    content: node.children.map((row, rowIdx) => ({
      type: 'tableRow',
      content: row.children.map((cell, colIdx) => ({
        type: rowIdx === 0 ? 'tableHeader' : 'tableCell',
        attrs: {
          align: aligns[colIdx] ?? null,   // ← align を各セルに付与
          colspan: 1,
          rowspan: 1,
        },
        content: convertBlockContent(cell.children),
      })),
    })),
  };
}
```

逆変換時は各列の最初のセルの `align` を読んで `table.align` 配列を再構築する。

#### 問題: `|` を含むセルのエスケープ

`remark-stringify` のオプション `tablePipeAlign: true` を使い、常にパイプ揃えにすることでエスケープの一貫性を保つ。

### 6.2 タスクリスト

#### 問題: 3値（null / false / true）の区別

```typescript
// TipTap TaskItem の定義
const TaskItem = Node.create({
  name: 'taskItem',
  group: 'listItem',

  addAttributes() {
    return {
      checked: {
        default: null,
        // null  = 通常リスト項目（チェックボックスなし）
        // false = 未チェック
        // true  = チェック済み
      },
    };
  },

  renderHTML({ node }) {
    if (node.attrs.checked === null) {
      // 通常の listItem として描画
      return ['li', {}, 0];
    }
    return ['li', { 'data-checked': node.attrs.checked }, 0];
  },
});
```

```typescript
// mdast → TipTap
case 'listItem':
  return {
    type: 'taskItem',
    attrs: { checked: node.checked },  // null / false / true をそのまま
    content: convertListItemContent(node),
  };
```

### 6.3 脚注

脚注は参照（`[^1]`）と定義（`[^1]: ...`）が文書内で分離しており、TipTap のブロック構造に自然に収まらない。

#### 採用戦略：doc attrs に格納 + 末尾固定表示

```typescript
// TipTap doc レベルで脚注定義を保持
// ★ TipTap の Extension で doc ノードにカスタム attrs を追加
const FootnoteExtension = Extension.create({
  name: 'footnote',
  addGlobalAttributes() {
    return [{
      types: ['doc'],
      attributes: {
        footnotes: {
          default: {},
          // { '1': 'First footnote.', 'note': 'Named footnote.' }
        },
      },
    }];
  },
});
```

```typescript
// mdast → TipTap 変換時
function convertRoot(root: MdastRoot): TipTapDoc {
  // 脚注定義を収集して doc attrs に格納
  const footnotes: Record<string, string> = {};
  const bodyNodes: MdastNode[] = [];

  for (const node of root.children) {
    if (node.type === 'footnoteDefinition') {
      footnotes[node.identifier] = serializeToMarkdown(node.children);
    } else {
      bodyNodes.push(node);
    }
  }

  return {
    type: 'doc',
    attrs: { footnotes },
    content: bodyNodes.map(convertBlock),
  };
}
```

UI：脚注参照（`[^1]`）をクリックするとポップアップで内容を表示・編集。

### 6.4 タイト vs ルーズリスト（最も見落とされやすい問題）

mdast の `listItem.spread` が `false` のとき「タイトリスト」（項目間に空行なし）、`true` のとき「ルーズリスト」（項目間に空行あり）を表す。これを TipTap に保持しないと、ラウンドトリップで全リストがルーズ化する。

```markdown
タイトリスト（変換前）:
- item 1
- item 2
- item 3

ルーズリスト（正常）:
- item 1

- item 2

- item 3
```

```typescript
// TipTap listItem に spread attr を追加
const ListItem = Node.create({
  name: 'listItem',
  addAttributes() {
    return {
      spread: { default: false },
    };
  },
});

// mdast → TipTap
case 'listItem':
  return {
    type: 'listItem',
    attrs: { spread: node.spread ?? false },  // ← 保持
    content: convertListItemContent(node),
  };
```

```typescript
// TipTap → mdast
case 'listItem':
  return {
    type: 'listItem',
    spread: node.attrs.spread,
    children: convertContent(node.content),
  };
```

### 6.5 GFM 拡張の発生しやすい問題まとめ

| 拡張 | 発生しやすい問題 | 対策 |
|---|---|---|
| テーブル | align の欠落 | セル attrs に分配して保持 |
| テーブル | `\|` のエスケープ | `tablePipeAlign: true` で一貫化 |
| タスクリスト | null/false/true の混同 | attrs の型を `boolean \| null` で定義 |
| 脚注 | 参照と定義の乖離 | doc attrs に定義を集約 |
| 脚注 | 番号の振り直し | identifier をキーとして保持し、順序は出力時に決定 |
| 取り消し線 | `~~` のダブル vs シングル | remark-gfm は `~~` のみ対応 |
| タイト/ルーズリスト | 全リストがルーズ化 | `listItem.spread` を必ず attrs で保持 |
| オートリンク | `<https://...>` の形式保持 | remark-stringify のオプションで制御 |

---

## 7. 実装優先度

個人開発での工数を最小化しながら品質を上げるための推奨フェーズ。

### Phase 1: 基本変換 + テスト基盤（Phase 1 MVPに対応）

- [ ] `mdastToTipTap()` の実装（ブロック・インライン基本要素）
- [ ] `tiptapToMarkdown()` の実装（remark-stringify 活用）
- [ ] ラウンドトリップテストハーネスの構築（`roundtrip.test.ts`）
- [ ] フィクスチャ 01〜17 のテストを全パス
- [ ] 正規化ルールの確定

### Phase 2: GFM 拡張（Phase 2 テーブルに対応）

- [ ] GFM テーブル変換（align 保持含む）
- [ ] タスクリスト変換（null/false/true 三値）
- [ ] 取り消し線変換
- [ ] フィクスチャ 18〜21 のテストを全パス

### Phase 3: 生HTML 保持

- [ ] `rawHtmlBlock` カスタムノード実装
- [ ] `rawHtmlInline` カスタムノード実装
- [ ] `<br>` → `HardBreak` マッピング
- [ ] フィクスチャ 22〜24 のテストを全パス

### Phase 4: 脚注・数式・エッジケース

- [ ] 脚注変換（参照 + 定義の doc attrs 戦略）
- [ ] インライン数式 / ブロック数式変換
- [ ] フロントマター保持
- [ ] フィクスチャ 25〜34 のテストを全パス

### Phase 5: File-as-SoT への移行（全フィクスチャパス後）

- [ ] 全フィクスチャのラウンドトリップテストがパスしたことを確認
- [ ] ファイルウォッチャーと自動再読込の実装
- [ ] 保存フラグによる「自分の保存」イベント除外
- [ ] Editor-as-SoT からFile-as-SoT への切り替え

---

## 関連ドキュメント

- [system-design.md](./system-design.md) — システム全体設計
- [roadmap.md](./roadmap.md) — 開発ロードマップ

---

*このドキュメントは実装進行に伴い更新される。変換仕様の変更は必ずラウンドトリップテストのフィクスチャ更新を伴うこと。*
