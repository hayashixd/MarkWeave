/**
 * Markdown ↔ TipTap JSON ラウンドトリップテスト
 *
 * MD → TipTap JSON → MD の変換が冪等であることを検証する。
 * 中間の TipTap JSON はスナップショットで管理し、
 * 構造が意図せず変わった場合に検出する。
 */
import { describe, it, expect } from 'vitest';
import { markdownToTipTap } from '../markdown-to-tiptap';
import { tiptapToMarkdown } from '../tiptap-to-markdown';

// ── ヘルパー ─────────────────────────────────────────
/** MD → TipTap → MD のラウンドトリップが一致することを検証 */
function expectRoundtrip(markdown: string): void {
  const doc = markdownToTipTap(markdown);
  const output = tiptapToMarkdown(doc);
  expect(output).toBe(markdown);
}

/** 中間 JSON のスナップショットを記録・検証 */
function expectSnapshot(markdown: string): void {
  const doc = markdownToTipTap(markdown);
  expect(doc).toMatchSnapshot();
}

// ── 1. 見出し (H1〜H6) ──────────────────────────────
describe('roundtrip: headings', () => {
  const cases = [
    { name: 'H1', md: '# Heading 1\n' },
    { name: 'H2', md: '## Heading 2\n' },
    { name: 'H3', md: '### Heading 3\n' },
    { name: 'H4', md: '#### Heading 4\n' },
    { name: 'H5', md: '##### Heading 5\n' },
    { name: 'H6', md: '###### Heading 6\n' },
    {
      name: 'multiple headings',
      md: '# Title\n\n## Section\n\n### Subsection\n',
    },
    {
      name: 'heading with inline marks',
      md: '## **Bold** and *italic* heading\n',
    },
  ];

  for (const { name, md } of cases) {
    it(`roundtrips: ${name}`, () => expectRoundtrip(md));
    it(`snapshot: ${name}`, () => expectSnapshot(md));
  }
});

// ── 2. リスト（順序なし・あり・ネスト）──────────────
describe('roundtrip: lists', () => {
  const cases = [
    {
      name: 'bullet list',
      md: '- item 1\n- item 2\n- item 3\n',
    },
    {
      name: 'ordered list',
      md: '1. first\n2. second\n3. third\n',
    },
    {
      name: 'nested bullet list',
      md: '- parent\n  - child 1\n  - child 2\n',
    },
    {
      name: 'nested ordered in bullet',
      md: '- parent\n  1. child 1\n  2. child 2\n',
    },
    {
      name: 'task list',
      md: '- [ ] todo\n- [x] done\n',
    },
    {
      name: 'deeply nested list',
      md: '- level 1\n  - level 2\n    - level 3\n',
    },
  ];

  for (const { name, md } of cases) {
    it(`roundtrips: ${name}`, () => expectRoundtrip(md));
    it(`snapshot: ${name}`, () => expectSnapshot(md));
  }
});

// ── 3. テーブル（GFM 形式、配置付き）─────────────────
describe('roundtrip: tables', () => {
  const cases = [
    {
      name: 'simple table',
      md: '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n',
    },
    {
      name: 'aligned table (left, center, right)',
      md: '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n',
    },
    {
      name: 'table with inline marks',
      md: '| Header |\n| --- |\n| **bold** |\n',
    },
    {
      name: 'multi-row table',
      md: '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n',
    },
  ];

  for (const { name, md } of cases) {
    it(`roundtrips: ${name}`, () => expectRoundtrip(md));
    it(`snapshot: ${name}`, () => expectSnapshot(md));
  }
});

// ── 4. コードブロック（言語指定あり・なし）────────────
describe('roundtrip: code blocks', () => {
  const cases = [
    {
      name: 'code block with language',
      md: '```typescript\nconst x = 1;\n```\n',
    },
    {
      name: 'code block without language',
      md: '```\nplain code\n```\n',
    },
    {
      name: 'code block with multiple lines',
      md: '```js\nfunction hello() {\n  return "world";\n}\n```\n',
    },
    {
      name: 'mermaid code block',
      md: '```mermaid\ngraph TD;\n  A-->B;\n```\n',
    },
  ];

  for (const { name, md } of cases) {
    it(`roundtrips: ${name}`, () => expectRoundtrip(md));
    it(`snapshot: ${name}`, () => expectSnapshot(md));
  }
});

// ── 5. インラインマークアップ ─────────────────────────
describe('roundtrip: inline markup', () => {
  const cases = [
    { name: 'bold', md: '**bold text**\n' },
    { name: 'italic', md: '*italic text*\n' },
    { name: 'strikethrough', md: '~~deleted text~~\n' },
    { name: 'inline code', md: 'use `console.log` here\n' },
    { name: 'bold + italic', md: '***bold italic***\n' },
    {
      name: 'link',
      md: '[click here](https://example.com)\n',
    },
    {
      name: 'image',
      md: '![alt text](https://example.com/img.png)\n',
    },
    {
      name: 'mixed inline',
      md: 'Normal **bold** and *italic* and `code` text\n',
    },
  ];

  for (const { name, md } of cases) {
    it(`roundtrips: ${name}`, () => expectRoundtrip(md));
    it(`snapshot: ${name}`, () => expectSnapshot(md));
  }
});

// ── 6. 複合ドキュメント ──────────────────────────────
describe('roundtrip: composite documents', () => {
  const cases = [
    {
      name: 'heading + paragraph + list',
      md: [
        '# Title',
        '',
        'A paragraph with **bold** text.',
        '',
        '- item 1',
        '- item 2',
        '',
      ].join('\n'),
    },
    {
      name: 'heading + code block + paragraph',
      md: [
        '## Code Example',
        '',
        '```js',
        'const x = 1;',
        '```',
        '',
        'That was the code.',
        '',
      ].join('\n'),
    },
    {
      name: 'heading + table + list',
      md: [
        '# Data',
        '',
        '| Key | Value |',
        '| --- | --- |',
        '| a | 1 |',
        '',
        '- note 1',
        '- note 2',
        '',
      ].join('\n'),
    },
    {
      name: 'blockquote + paragraph',
      md: ['> quoted text', '', 'Normal paragraph', ''].join('\n'),
    },
    {
      name: 'horizontal rule between sections',
      md: ['# Section 1', '', '---', '', '# Section 2', ''].join('\n'),
    },
    {
      name: 'full document',
      md: [
        '# Document Title',
        '',
        'An introductory paragraph with *emphasis* and **strong** text.',
        '',
        '## Section One',
        '',
        '- bullet **one**',
        '- bullet two',
        '',
        '### Subsection',
        '',
        '1. ordered item',
        '2. another item',
        '',
        '```python',
        'print("hello")',
        '```',
        '',
        '| Col A | Col B |',
        '| --- | --- |',
        '| x | y |',
        '',
        '---',
        '',
        '> A final quote',
        '',
      ].join('\n'),
    },
  ];

  for (const { name, md } of cases) {
    it(`roundtrips: ${name}`, () => expectRoundtrip(md));
    it(`snapshot: ${name}`, () => expectSnapshot(md));
  }
});

// ── Zenn 固有記法 ────────────────────────────────────
describe('roundtrip: Zenn固有記法', () => {
  it('コードブロック lang:filename（ファイル名指定）', () => {
    expectRoundtrip('```typescript:example.ts\nconst x = 1;\n```\n');
  });

  it('コードブロック diff meta（diff 表示）', () => {
    expectRoundtrip('```diff typescript\n+ const added = 1;\n- const removed = 2;\n```\n');
  });

  it('コードブロック meta なし（通常）', () => {
    expectRoundtrip('```typescript\nconst x = 1;\n```\n');
  });

  it('脚注参照と脚注定義のラウンドトリップ', () => {
    expectRoundtrip('本文に脚注[^1]が含まれています。\n\n[^1]: 脚注の説明文\n');
  });

  it('複数の脚注参照', () => {
    expectRoundtrip('最初の脚注[^1]と二番目の脚注[^2]。\n\n[^1]: 一番目\n\n[^2]: 二番目\n');
  });

  it(':::message ブロック（テキストとして保持）', () => {
    expectRoundtrip(':::message\nこれはメッセージです。\n:::\n');
  });

  it(':::message alert ブロック', () => {
    expectRoundtrip(':::message alert\n警告メッセージです。\n:::\n');
  });

  it(':::details アコーディオン', () => {
    expectRoundtrip(':::details タイトル\n折りたたみ内容\n:::\n');
  });

  it('@[youtube] 埋め込み', () => {
    expectRoundtrip('@[youtube](dQw4w9WgXcQ)\n');
  });

  it('@[tweet] 埋め込み', () => {
    expectRoundtrip('@[tweet](https://twitter.com/user/status/123)\n');
  });
});
