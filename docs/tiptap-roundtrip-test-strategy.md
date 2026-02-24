# TipTap JSON フォーマット詳細 & ラウンドトリップテスト戦略 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [TipTap JSON フォーマット仕様](#1-tiptap-json-フォーマット仕様)
2. [ProseMirror スキーマ制約と変換への影響](#2-prosemirror-スキーマ制約と変換への影響)
3. [ノード別 JSON 具体例](#3-ノード別-json-具体例)
4. [変換で発生するエッジケースと対策](#4-変換で発生するエッジケースと対策)
5. [フィクスチャファイル実装ガイド](#5-フィクスチャファイル実装ガイド)
6. [テスト実装ロードマップ](#6-テスト実装ロードマップ)

---

## 1. TipTap JSON フォーマット仕様

### 1.1 基本構造

TipTap の内部ドキュメントは ProseMirror の `Node` オブジェクトを JSON シリアライズしたもの。
`editor.getJSON()` / `editor.commands.setContent(json)` でやり取りする。

```typescript
// TipTap ドキュメントのトップレベル型
interface TipTapDoc {
  type: 'doc';
  attrs?: Record<string, unknown>;   // カスタム拡張で追加
  content: TipTapNode[];
}

interface TipTapNode {
  type: string;                       // ノード種別
  attrs?: Record<string, unknown>;    // ノード属性
  content?: TipTapNode[];             // 子ノード（atom ノードは持たない）
  marks?: TipTapMark[];               // テキストノードに付与されるマーク
  text?: string;                      // text ノードのみ
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}
```

### 1.2 text ノードの特殊性

`text` ノードは `content` を持たない葉ノード。`marks` 配列でスタイルを表現する。

```json
{
  "type": "text",
  "text": "Hello",
  "marks": [
    { "type": "bold" },
    { "type": "italic" }
  ]
}
```

**重要**: ProseMirror はテキストノードを自動的に**マージ**する。同じマークセットを持つ連続テキストは一つのノードになる。

### 1.3 空ノードの扱い

ProseMirror は `content: []` と `content` キーなしを区別する。
空のブロックノード（空の段落など）は通常 `content` キー自体を省略する。

```json
// 空の paragraph
{ "type": "paragraph" }

// テキストを含む paragraph
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "Hello" }
  ]
}
```

---

## 2. ProseMirror スキーマ制約と変換への影響

### 2.1 コンテンツ式（Content Expression）

各ノードは `content` に何が入れられるかを定義する「コンテンツ式」を持つ。

| ノード | コンテンツ式 | 意味 |
|-------|-------------|------|
| `doc` | `block+` | 1つ以上のブロックノード |
| `paragraph` | `inline*` | 0個以上のインラインノード |
| `bulletList` | `listItem+` | 1つ以上の listItem |
| `listItem` | `paragraph block*` | 段落 + 任意のブロック |
| `blockquote` | `block+` | 1つ以上のブロックノード |
| `codeBlock` | `text*` | テキストのみ（マーク不可）|
| `table` | `tableRow+` | 1つ以上の tableRow |
| `tableRow` | `(tableCell\|tableHeader)+` | セルのみ |

**変換への影響**:

```typescript
// NG: codeBlock の中にマーク付きテキストを入れようとすると
// ProseMirror がスキーマ違反で自動修正してしまう
{
  "type": "codeBlock",
  "content": [{
    "type": "text",
    "text": "const x = 1",
    "marks": [{ "type": "bold" }]  // ← codeBlock は marks を持てない → 無視される
  }]
}
```

### 2.2 マークの適用範囲制限

各マークには適用できるノードの制限がある。

| マーク | 適用可能 | 適用不可 |
|-------|---------|---------|
| `bold` | `text` | `image`, `hardBreak` |
| `italic` | `text` | `image`, `hardBreak` |
| `code` | `text` | `image`, `hardBreak` |
| `link` | `text`, `image` | — |

**変換への影響**: `image` ノードは `link` マークで包むことができる（`[![alt](img)](url)` パターン）。
`bold` 等は `image` には適用できないため、Markdown の文法上存在しないケースだが念のため確認が必要。

### 2.3 スキーマによる自動正規化

ProseMirror は `setContent()` 時にスキーマ違反のノードを自動修正する：

- スキーマ違反のノードは**静かに削除**される
- `content` の最低要件（`block+` など）を満たさない場合、空の段落が自動挿入される
- マーク順序は ProseMirror が内部でソートする（変換時にマーク順序を気にしない）

**テストへの示唆**: `mdastToTipTap()` が返す JSON を直接 `editor.setContent()` に渡してから `editor.getJSON()` で読み返すと、スキーマ検証後の正規化済み JSON が得られる。これをゴールデンデータとしてテストに使うと良い。

---

## 3. ノード別 JSON 具体例

### 3.1 見出し（Heading）

```markdown
# H1 見出し
## H2 見出し
```

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "H1 見出し" }]
    },
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "H2 見出し" }]
    }
  ]
}
```

### 3.2 段落・インラインマーク

```markdown
通常テキスト、**太字**、*斜体*、~~取り消し~~、`コード`、**_複合_**
```

```json
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "通常テキスト、" },
    { "type": "text", "text": "太字", "marks": [{ "type": "bold" }] },
    { "type": "text", "text": "、" },
    { "type": "text", "text": "斜体", "marks": [{ "type": "italic" }] },
    { "type": "text", "text": "、" },
    { "type": "text", "text": "取り消し", "marks": [{ "type": "strike" }] },
    { "type": "text", "text": "、" },
    { "type": "text", "text": "コード", "marks": [{ "type": "code" }] },
    { "type": "text", "text": "、" },
    {
      "type": "text",
      "text": "複合",
      "marks": [{ "type": "bold" }, { "type": "italic" }]
    }
  ]
}
```

**重要**: マークの順序は ProseMirror が内部でスキーマ定義順にソートする。
`bold` と `italic` の順序は変換元の Markdown に関わらず常に一定になる。

### 3.3 リスト

```markdown
- item 1
- item 2
  - nested item
```

```json
{
  "type": "bulletList",
  "content": [
    {
      "type": "listItem",
      "attrs": { "spread": false },
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "item 1" }] }
      ]
    },
    {
      "type": "listItem",
      "attrs": { "spread": false },
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "item 2" }] },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "attrs": { "spread": false },
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "nested item" }] }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 3.4 コードブロック

```markdown
```typescript
const x: number = 1;
```
```

```json
{
  "type": "codeBlock",
  "attrs": { "language": "typescript" },
  "content": [
    { "type": "text", "text": "const x: number = 1;" }
  ]
}
```

**注意**: `codeBlock` 内のテキストには**マークが付かない**（スキーマ制約）。

### 3.5 リンク・画像

```markdown
[リンクテキスト](https://example.com "タイトル")
![代替テキスト](image.png "画像タイトル")
```

```json
// リンク（mark として表現）
{
  "type": "text",
  "text": "リンクテキスト",
  "marks": [{
    "type": "link",
    "attrs": {
      "href": "https://example.com",
      "title": "タイトル",
      "target": "_blank"   // TipTap Link 拡張のデフォルト attr
    }
  }]
}

// 画像（block-level ノードとして表現）
{
  "type": "image",
  "attrs": {
    "src": "image.png",
    "alt": "代替テキスト",
    "title": "画像タイトル"
  }
}
```

**注意**: TipTap の `Link` 拡張はデフォルトで `target` 属性を追加する。
変換時に `target` を mdast に含めないよう注意。

### 3.6 テーブル（GFM）

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| A    |   B    |     C |
```

```json
{
  "type": "table",
  "content": [
    {
      "type": "tableRow",
      "content": [
        {
          "type": "tableHeader",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null, "align": "left" },
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Left" }] }]
        },
        {
          "type": "tableHeader",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null, "align": "center" },
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Center" }] }]
        },
        {
          "type": "tableHeader",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null, "align": "right" },
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Right" }] }]
        }
      ]
    },
    {
      "type": "tableRow",
      "content": [
        {
          "type": "tableCell",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null, "align": "left" },
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "A" }] }]
        },
        {
          "type": "tableCell",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null, "align": "center" },
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "B" }] }]
        },
        {
          "type": "tableCell",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null, "align": "right" },
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "C" }] }]
        }
      ]
    }
  ]
}
```

**重要**: TipTap Table 拡張は `tableHeader` と `tableCell` を区別し、どちらも `align` 属性をセルレベルで持つ。逆変換時は最初の行を `tableHeader` かどうかで判断して GFM の区切り行（`|:-----|`）を生成する。

### 3.7 フロントマター（カスタムノード）

```markdown
---
title: My Document
date: 2026-02-24
---
```

```json
{
  "type": "frontmatter",
  "attrs": {
    "value": "title: My Document\ndate: 2026-02-24\n"
  }
}
```

### 3.8 生HTML（カスタムノード）

```markdown
<div class="callout">
  Important note
</div>
```

```json
{
  "type": "rawHtmlBlock",
  "attrs": {
    "html": "<div class=\"callout\">\n  Important note\n</div>\n"
  }
}
```

---

## 4. 変換で発生するエッジケースと対策

### 4.1 マーク境界の重なり問題

#### 問題

Markdown では `**bold _bold-italic_ bold**` のようにマーク境界が重なり得るが、
ProseMirror のフラット構造では各テキストノードに独立してマークが付く。

```markdown
**bold _bold-italic_ bold**
```

```
mdast のネスト構造:
strong
  text: "bold "
  emphasis
    text: "bold-italic"
  text: " bold"

↓ TipTap のフラット構造:
text "bold "    marks=[bold]
text "bold-italic"  marks=[bold, italic]
text " bold"    marks=[bold]
```

#### 対策

逆変換（TipTap → mdast）時は、隣接テキストノードのマーク差分を分析してネスト構造を再構築する。
**隣接するマークをできる限りマージして最小ネストにする**ことで正規化した Markdown を出力する。

```typescript
// tiptap-to-mdast.ts における隣接テキストのマージ戦略
function mergeAdjacentTextsWithSameMark(nodes: PMNode[]): MdastNode[] {
  // 同一マークセットを持つ連続テキストをグループ化してから変換
  const groups = groupByMarkSet(nodes);
  return groups.flatMap(group => convertGroup(group));
}
```

**正規化後の出力**:
```markdown
**bold _bold-italic_ bold**
```
（`***` の代わりに `**_..._**` の形式で出力）

### 4.2 インライン画像へのリンク

#### 問題

```markdown
[![alt](image.png)](https://example.com)
```

mdast では `link > image` のネスト構造になるが、TipTap では `image` ノードに `link` マークを付与するか、専用の `linkImage` ノードが必要になる。

#### 対策

`image` ノードに `link` マークを付与できるようスキーマを定義する：

```typescript
// schema 定義に link mark を image ノードに適用可能にする
const Image = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  marks: 'link',   // ← link マークを適用可能に
  // ...
});
```

```json
{
  "type": "image",
  "attrs": { "src": "image.png", "alt": "alt" },
  "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }]
}
```

### 4.3 空のリストアイテム

#### 問題

```markdown
- First item
-
- Third item
```

空のリストアイテムは mdast では `listItem > paragraph`（空の paragraph）になるが、
TipTap は `listItem > paragraph` の `paragraph` が空でも `content` キー自体を持つかどうかが実装依存。

#### 対策

空のブロックは必ず `content: []` ではなく `content` キー省略で正規化する。
フィクスチャでこのケースを明示的にカバーする。

### 4.4 コードブロック内の特殊文字

#### 問題

```markdown
```bash
echo "Hello & <World>"
```
```

コードブロック内の `&`, `<`, `>` は HTML エンティティ（`&amp;`, `&lt;`, `&gt;`）に変換**してはならない**。
TipTap の `codeBlock` はデフォルトで内部テキストをそのまま保持するが、
HTML レンダリング時に自動エスケープがかかることがある。

#### 対策

`tiptapToMarkdown()` 時に `codeBlock` の内容は**エスケープなしでそのまま出力**する。
`remark-stringify` の設定で `codeBlock` 内のエスケープを無効化する。

### 4.5 ハードブレークの扱い

#### 問題

Markdown のハードブレークは2種類ある：
- 行末スペース2つ: `Hello  \n`
- バックスラッシュ: `Hello\\\n`

remark-stringify はデフォルトでバックスラッシュ形式を出力する。
フィクスチャは正規化後の形式（バックスラッシュ形式）で統一する。

```json
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "Hello" },
    { "type": "hardBreak" },
    { "type": "text", "text": "World" }
  ]
}
```

```markdown
Hello\
World
```

### 4.6 参照リンクの正規化

#### 問題

```markdown
[text][ref]

[ref]: https://example.com "タイトル"
```

mdast では `linkReference` ノードになるが、TipTap に対応するノードがない。

#### 採用方針

`mdastToTipTap()` 時点でインラインリンクに展開して変換する。
`tiptapToMarkdown()` では常にインラインリンクを出力する（参照リンクへの逆変換はしない）。

**これはラウンドトリップの「意図的な非対称」であり、仕様として明記する**。

### 4.7 ルーズリストのネスト内でのタイト/ルーズ混在

#### 問題

```markdown
- outer item 1

  - inner item 1
  - inner item 2

- outer item 2
```

外側リストはルーズ（`spread: true`）、内側リストはタイト（`spread: false`）。
この状態を TipTap の attrs で正確に保持し、逆変換で再現する必要がある。

#### 対策

`bulletList` / `orderedList` ノード自体にも `spread` attrs を付与して、
親リストのルーズ/タイト状態を保持する：

```json
{
  "type": "bulletList",
  "attrs": { "spread": true },
  "content": [
    {
      "type": "listItem",
      "attrs": { "spread": true },
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "outer item 1" }] },
        {
          "type": "bulletList",
          "attrs": { "spread": false },
          "content": [...]
        }
      ]
    }
  ]
}
```

---

## 5. フィクスチャファイル実装ガイド

### 5.1 フィクスチャの形式

各フィクスチャは「正規化済み Markdown」であること。
`roundtrip(fixture) === fixture` が成立するように設計する。

### 5.2 重要フィクスチャの具体的内容

#### 05-emphasis-nested.md（最重要・最難関）

```markdown
**太字** *斜体* ***太字と斜体***

**_この順序_** *__この順序__*

**bold _bold-italic_ bold**

_italic **italic-bold** italic_
```

**正規化ルール**:
- `***text***` → `***text***`（そのまま維持、`**_text_**` ではなく）
- `**_text_**` → `**_text_**`（そのまま維持）
- `*__text__*` → `***text***`（`__` を `**` に正規化後、`***` になる）

#### 07-lists-tight.md

```markdown
- item 1
- item 2
- item 3
```

（各項目間に空行なし = タイトリスト）

#### 08-lists-loose.md

```markdown
- item 1

- item 2

- item 3
```

（各項目間に空行あり = ルーズリスト）

#### 18-tables-gfm.md

```markdown
| Left aligned | Center aligned | Right aligned |
| :----------- | :------------: | ------------: |
| Content      |    Content     |       Content |
| Content      |    Content     |       Content |
```

**注意**: `remark-stringify` の `tablePipeAlign` オプションでパイプ位置を揃える。

#### 22-raw-html-block.md

```markdown
<div class="note">

  This is a **note**.

</div>

<!-- HTML コメント -->

<details>
  <summary>Details</summary>
  Content here.
</details>
```

**重要**: 生HTML の内容は**一切変更しない**。空白、改行、属性の順序もそのまま保持。

### 5.3 フィクスチャ作成のワークフロー

```bash
# 1. フィクスチャ候補の Markdown を作成
echo "**bold**" > tests/roundtrip/fixtures/04-emphasis-basic.md

# 2. 実際に変換してみて出力を確認
npx vitest run --reporter=verbose roundtrip

# 3. 出力が正規化後の形と一致していれば OK
# 4. 一致しなければ正規化後の形でフィクスチャを更新するか、
#    変換ロジックのバグを修正する
```

---

## 6. テスト実装ロードマップ

### 6.1 Phase 1: 基盤整備（最優先）

#### テストハーネスの拡張

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

/**
 * TipTap JSON の構造を検証するヘルパー。
 * スキーマ違反がないか確認する。
 */
function validateTipTapJson(json: unknown): void {
  // @tiptap/core の createDocument を使って検証
  // スキーマ違反があると例外が発生する
  const { generateJSON } = require('@tiptap/html');
  // ...実装省略
}

// ゴールデンテスト: MD → TipTap JSON の変換結果を検証
describe('mdastToTipTap golden tests', () => {
  test('paragraph with bold', () => {
    const md = '**Hello**\n';
    const json = markdownToTipTap(md);
    expect(json).toMatchSnapshot();  // スナップショットで管理
  });
});

// ラウンドトリップテスト
const fixtures = import.meta.glob('./fixtures/*.md', { as: 'raw', eager: true });

describe('Markdown round-trip', () => {
  for (const [path, content] of Object.entries(fixtures)) {
    test(path, () => {
      expect(roundTrip(content as string)).toBe(content);
    });
  }
});
```

#### スナップショットテストによる TipTap JSON 検証

ラウンドトリップテストだけでは「MD → TipTap JSON」変換の中間状態が正しいか確認できない。
スナップショットテストを組み合わせて TipTap JSON の構造自体を検証する：

```typescript
describe('TipTap JSON structure', () => {
  test('bold text produces correct mark', () => {
    const md = '**bold**\n';
    const json = markdownToTipTap(md);
    expect(json.content[0].content[0].marks).toEqual([{ type: 'bold' }]);
  });

  test('table has align attrs on each cell', () => {
    const md = '| L | C |\n|:--|:-:|\n| a | b |\n';
    const json = markdownToTipTap(md);
    const firstCell = json.content[0].content[0].content[0];
    expect(firstCell.attrs?.align).toBe('left');
  });
});
```

### 6.2 Phase 2: 基本変換のフィクスチャ（01〜17）

優先度順に実装する：

| 優先度 | フィクスチャ | 実装難易度 | 依存関係 |
|--------|------------|----------|---------|
| 1 | 01-headings-atx | 低 | なし |
| 2 | 03-paragraph | 低 | なし |
| 3 | 04-emphasis-basic | 中 | なし |
| 4 | 13-blockquote-basic | 低 | paragraph |
| 5 | 11-codeblock-fenced | 低 | なし |
| 6 | 07-lists-tight | 中 | paragraph |
| 7 | 08-lists-loose | 中 | paragraph |
| 8 | 09-lists-nested | 高 | tight/loose |
| 9 | 05-emphasis-nested | 高 | emphasis-basic |
| 10 | 15-links-inline | 中 | paragraph |
| 11 | 17-images | 低 | なし |
| 12 | 16-links-reference | 中 | links-inline（正規化） |

### 6.3 Phase 3: GFM 拡張（18〜21）

| フィクスチャ | 主な実装ポイント |
|------------|---------------|
| 18-tables-gfm | align の分配と逆変換 |
| 19-tasklist-gfm | null/false/true 3値の保持 |
| 21-strikethrough-gfm | `~~` の変換 |
| 20-footnotes-gfm | doc attrs 戦略 |

### 6.4 Phase 4: 生HTML・エッジケース（22〜34）

| フィクスチャ | 主な実装ポイント |
|------------|---------------|
| 22-raw-html-block | opaque ノード戦略 |
| 23-raw-html-inline | inline atom ノード |
| 24-linebreak-hard | バックスラッシュ正規化 |
| 26-frontmatter-yaml | doc の先頭ノード |
| 27-math-block | mathBlock カスタムノード |
| 29-unicode-cjk | 文字列長と境界の正確な処理 |
| 34-edge-trailing-newline | 末尾改行の正規化 |

### 6.5 テスト失敗時のデバッグフロー

```
1. ラウンドトリップテスト失敗
        ↓
2. 中間の TipTap JSON をコンソール出力して確認
        ↓
3. TipTap JSON がスキーマ違反かどうか確認
   （スキーマ違反 → mdastToTipTap() のバグ）
        ↓
4. TipTap JSON は正しいが Markdown 出力が違う
   （→ tiptapToMarkdown() のバグ）
        ↓
5. Markdown は合っているがフィクスチャと異なる
   （→ フィクスチャの正規化ルールを再確認）
```

---

## 関連ドキュメント

- [markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) — Markdown ↔ TipTap 双方向変換設計（概要・方針）
- [system-design.md](./system-design.md) — システム全体設計
- [roadmap.md](./roadmap.md) — 開発ロードマップ

---

*このドキュメントは変換実装フェーズで参照する詳細設計書。実装で新たなエッジケースが発見された場合はセクション 4 に追記すること。*
