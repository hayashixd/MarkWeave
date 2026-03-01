import { describe, it, expect } from 'vitest';
import { htmlToTipTap } from './html-to-tiptap';

describe('htmlToTipTap', () => {
  // -----------------------------------------------------------------------
  // 基本ブロック要素
  // -----------------------------------------------------------------------

  describe('headings', () => {
    it('converts h1-h6 elements', () => {
      const result = htmlToTipTap('<h1>Title</h1><h2>Subtitle</h2><h3>H3</h3>');
      expect(result.doc.content).toHaveLength(3);
      expect(result.doc.content[0]).toMatchObject({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Title' }],
      });
      expect(result.doc.content[1]).toMatchObject({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Subtitle' }],
      });
      expect(result.doc.content[2]).toMatchObject({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'H3' }],
      });
    });

    it('converts all heading levels (h4-h6)', () => {
      const result = htmlToTipTap('<h4>H4</h4><h5>H5</h5><h6>H6</h6>');
      expect(result.doc.content[0]!.attrs).toEqual({ level: 4 });
      expect(result.doc.content[1]!.attrs).toEqual({ level: 5 });
      expect(result.doc.content[2]!.attrs).toEqual({ level: 6 });
    });
  });

  describe('paragraphs', () => {
    it('converts paragraph elements', () => {
      const result = htmlToTipTap('<p>Hello world</p>');
      expect(result.doc.content).toHaveLength(1);
      expect(result.doc.content[0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello world' }],
      });
    });

    it('wraps bare text in implicit paragraph', () => {
      const result = htmlToTipTap('bare text content');
      expect(result.doc.content).toHaveLength(1);
      expect(result.doc.content[0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'bare text content' }],
      });
    });
  });

  describe('lists', () => {
    it('converts unordered list', () => {
      const result = htmlToTipTap('<ul><li>Item 1</li><li>Item 2</li></ul>');
      expect(result.doc.content[0]).toMatchObject({ type: 'bulletList' });
      expect(result.doc.content[0]!.content).toHaveLength(2);
      expect(result.doc.content[0]!.content![0]!.type).toBe('listItem');
    });

    it('converts ordered list', () => {
      const result = htmlToTipTap('<ol><li>First</li><li>Second</li></ol>');
      expect(result.doc.content[0]).toMatchObject({ type: 'orderedList' });
      expect(result.doc.content[0]!.content).toHaveLength(2);
    });

    it('preserves ordered list start attribute', () => {
      const result = htmlToTipTap('<ol start="5"><li>Fifth</li></ol>');
      expect(result.doc.content[0]!.attrs).toMatchObject({ start: 5 });
    });

    it('converts nested lists', () => {
      const result = htmlToTipTap(
        '<ul><li>Parent<ul><li>Child</li></ul></li></ul>',
      );
      const parentItem = result.doc.content[0]!.content![0]!;
      expect(parentItem.type).toBe('listItem');
      // Should have paragraph + nested bulletList
      expect(parentItem.content!.length).toBeGreaterThanOrEqual(2);
      const nestedList = parentItem.content!.find((n) => n.type === 'bulletList');
      expect(nestedList).toBeDefined();
    });
  });

  describe('task lists', () => {
    it('converts task list with checkboxes', () => {
      const html =
        '<ul><li><input type="checkbox"> Todo</li><li><input type="checkbox" checked> Done</li></ul>';
      const result = htmlToTipTap(html);
      expect(result.doc.content[0]).toMatchObject({ type: 'taskList' });
      expect(result.doc.content[0]!.content![0]).toMatchObject({
        type: 'taskItem',
        attrs: { checked: false },
      });
      expect(result.doc.content[0]!.content![1]).toMatchObject({
        type: 'taskItem',
        attrs: { checked: true },
      });
    });
  });

  describe('blockquote', () => {
    it('converts blockquote', () => {
      const result = htmlToTipTap('<blockquote><p>Quoted text</p></blockquote>');
      expect(result.doc.content[0]).toMatchObject({ type: 'blockquote' });
      expect(result.doc.content[0]!.content![0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Quoted text' }],
      });
    });
  });

  describe('code blocks', () => {
    it('converts pre>code with language class', () => {
      const result = htmlToTipTap(
        '<pre><code class="language-js">console.log("hi")</code></pre>',
      );
      expect(result.doc.content[0]).toMatchObject({
        type: 'codeBlock',
        attrs: { language: 'js' },
        content: [{ type: 'text', text: 'console.log("hi")' }],
      });
    });

    it('converts pre>code without language', () => {
      const result = htmlToTipTap('<pre><code>plain code</code></pre>');
      expect(result.doc.content[0]).toMatchObject({
        type: 'codeBlock',
        attrs: { language: null },
        content: [{ type: 'text', text: 'plain code' }],
      });
    });

    it('converts bare pre element', () => {
      const result = htmlToTipTap('<pre>preformatted text</pre>');
      expect(result.doc.content[0]).toMatchObject({
        type: 'codeBlock',
        attrs: { language: null },
        content: [{ type: 'text', text: 'preformatted text' }],
      });
    });
  });

  describe('horizontal rule', () => {
    it('converts hr element', () => {
      const result = htmlToTipTap('<hr>');
      expect(result.doc.content[0]).toMatchObject({ type: 'horizontalRule' });
    });
  });

  // -----------------------------------------------------------------------
  // テーブル
  // -----------------------------------------------------------------------

  describe('tables', () => {
    it('converts simple table with thead and tbody', () => {
      const html = `
        <table>
          <thead><tr><th>Name</th><th>Age</th></tr></thead>
          <tbody>
            <tr><td>Alice</td><td>30</td></tr>
            <tr><td>Bob</td><td>25</td></tr>
          </tbody>
        </table>
      `;
      const result = htmlToTipTap(html);
      const table = result.doc.content[0]!;
      expect(table.type).toBe('table');
      expect(table.content).toHaveLength(3); // 1 header + 2 data rows
      expect(table.content![0]!.content![0]!.type).toBe('tableHeader');
      expect(table.content![1]!.content![0]!.type).toBe('tableCell');
    });

    it('preserves text-align style in table cells', () => {
      const html =
        '<table><tr><th style="text-align: center">Centered</th></tr></table>';
      const result = htmlToTipTap(html);
      const cell = result.doc.content[0]!.content![0]!.content![0]!;
      expect(cell.attrs?.style).toBe('text-align: center');
    });

    it('preserves colspan and rowspan', () => {
      const html =
        '<table><tr><td colspan="2" rowspan="3">Wide</td></tr></table>';
      const result = htmlToTipTap(html);
      const cell = result.doc.content[0]!.content![0]!.content![0]!;
      expect(cell.attrs?.colspan).toBe(2);
      expect(cell.attrs?.rowspan).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // インライン要素
  // -----------------------------------------------------------------------

  describe('inline elements', () => {
    it('converts strong/b to bold mark', () => {
      const result = htmlToTipTap('<p><strong>bold</strong></p>');
      expect(result.doc.content[0]!.content![0]).toMatchObject({
        type: 'text',
        text: 'bold',
        marks: [{ type: 'bold' }],
      });
    });

    it('converts b tag to bold mark', () => {
      const result = htmlToTipTap('<p><b>bold</b></p>');
      expect(result.doc.content[0]!.content![0]!.marks).toEqual([
        { type: 'bold' },
      ]);
    });

    it('converts em/i to italic mark', () => {
      const result = htmlToTipTap('<p><em>italic</em></p>');
      expect(result.doc.content[0]!.content![0]).toMatchObject({
        type: 'text',
        text: 'italic',
        marks: [{ type: 'italic' }],
      });
    });

    it('converts i tag to italic mark', () => {
      const result = htmlToTipTap('<p><i>italic</i></p>');
      expect(result.doc.content[0]!.content![0]!.marks).toEqual([
        { type: 'italic' },
      ]);
    });

    it('converts s/del to strike mark', () => {
      const result = htmlToTipTap('<p><s>strikethrough</s></p>');
      expect(result.doc.content[0]!.content![0]!.marks).toEqual([
        { type: 'strike' },
      ]);
    });

    it('converts del tag to strike mark', () => {
      const result = htmlToTipTap('<p><del>deleted</del></p>');
      expect(result.doc.content[0]!.content![0]!.marks).toEqual([
        { type: 'strike' },
      ]);
    });

    it('converts inline code', () => {
      const result = htmlToTipTap('<p>Use <code>console.log</code></p>');
      expect(result.doc.content[0]!.content![1]).toMatchObject({
        type: 'text',
        text: 'console.log',
        marks: [{ type: 'code' }],
      });
    });

    it('converts links', () => {
      const result = htmlToTipTap(
        '<p><a href="https://example.com" title="Example">click</a></p>',
      );
      const textNode = result.doc.content[0]!.content![0]!;
      expect(textNode.text).toBe('click');
      expect(textNode.marks![0]).toMatchObject({
        type: 'link',
        attrs: {
          href: 'https://example.com',
          target: null,
          rel: null,
          title: 'Example',
        },
      });
    });

    it('converts links without title', () => {
      const result = htmlToTipTap(
        '<p><a href="https://example.com">click</a></p>',
      );
      const mark = result.doc.content[0]!.content![0]!.marks![0]!;
      expect(mark.attrs).toMatchObject({
        href: 'https://example.com',
        target: null,
        rel: null,
      });
      expect(mark.attrs!.title).toBeUndefined();
    });

    it('converts images', () => {
      const result = htmlToTipTap(
        '<p><img src="photo.png" alt="A photo" title="Photo title"></p>',
      );
      expect(result.doc.content[0]!.content![0]).toMatchObject({
        type: 'image',
        attrs: { src: 'photo.png', alt: 'A photo', title: 'Photo title' },
      });
    });

    it('converts br to hardBreak', () => {
      const result = htmlToTipTap('<p>Line 1<br>Line 2</p>');
      expect(result.doc.content[0]!.content![1]).toMatchObject({
        type: 'hardBreak',
      });
    });

    it('accumulates nested marks (bold + italic)', () => {
      const result = htmlToTipTap('<p><strong><em>bold italic</em></strong></p>');
      const textNode = result.doc.content[0]!.content![0]!;
      expect(textNode.text).toBe('bold italic');
      expect(textNode.marks).toHaveLength(2);
      const markTypes = textNode.marks!.map((m) => m.type).sort();
      expect(markTypes).toEqual(['bold', 'italic']);
    });
  });

  // -----------------------------------------------------------------------
  // セマンティックコンテナ要素
  // -----------------------------------------------------------------------

  describe('semantic container elements', () => {
    it('unwraps div into child content', () => {
      const result = htmlToTipTap('<div><p>Inside div</p></div>');
      expect(result.doc.content[0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Inside div' }],
      });
    });

    it('unwraps section, article, header, footer, nav', () => {
      const result = htmlToTipTap(
        '<section><p>Section</p></section><article><p>Article</p></article>',
      );
      expect(result.doc.content).toHaveLength(2);
      expect(result.doc.content[0]).toMatchObject({ type: 'paragraph' });
      expect(result.doc.content[1]).toMatchObject({ type: 'paragraph' });
    });
  });

  // -----------------------------------------------------------------------
  // 完全な HTML ドキュメント
  // -----------------------------------------------------------------------

  describe('full HTML document', () => {
    it('parses a complete HTML document', () => {
      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
  <meta name="description" content="A test page">
  <link rel="stylesheet" href="style.css">
  <script src="app.js"></script>
</head>
<body>
  <h1>Hello</h1>
  <p>World</p>
</body>
</html>`;
      const result = htmlToTipTap(html);
      expect(result.doc.content).toHaveLength(2);
      expect(result.doc.content[0]).toMatchObject({
        type: 'heading',
        attrs: { level: 1 },
      });
      expect(result.doc.content[1]).toMatchObject({ type: 'paragraph' });
    });
  });

  // -----------------------------------------------------------------------
  // メタデータ抽出
  // -----------------------------------------------------------------------

  describe('metadata extraction', () => {
    it('extracts title from head', () => {
      const result = htmlToTipTap(
        '<html><head><title>My Page</title></head><body></body></html>',
      );
      expect(result.metadata.title).toBe('My Page');
    });

    it('extracts meta description', () => {
      const result = htmlToTipTap(
        '<html><head><meta name="description" content="Page description"></head><body></body></html>',
      );
      expect(result.metadata.metaDescription).toBe('Page description');
    });

    it('extracts CSS links', () => {
      const result = htmlToTipTap(
        '<html><head><link rel="stylesheet" href="a.css"><link rel="stylesheet" href="b.css"></head><body></body></html>',
      );
      expect(result.metadata.cssLinks).toEqual(['a.css', 'b.css']);
    });

    it('extracts script sources', () => {
      const result = htmlToTipTap(
        '<html><head><script src="app.js"></script><script src="lib.js"></script></head><body></body></html>',
      );
      expect(result.metadata.scriptLinks).toEqual(['app.js', 'lib.js']);
    });

    it('returns default metadata for fragments', () => {
      const result = htmlToTipTap('<p>Just a paragraph</p>');
      expect(result.metadata).toEqual({
        title: '',
        metaDescription: '',
        cssLinks: [],
        scriptLinks: [],
      });
    });
  });

  // -----------------------------------------------------------------------
  // エッジケース
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns at least one empty paragraph for empty input', () => {
      const result = htmlToTipTap('');
      expect(result.doc.content).toHaveLength(1);
      expect(result.doc.content[0]!.type).toBe('paragraph');
    });

    it('handles whitespace-only content', () => {
      const result = htmlToTipTap('   \n\n   ');
      expect(result.doc.content).toHaveLength(1);
      expect(result.doc.content[0]!.type).toBe('paragraph');
    });

    it('handles HTML fragment without html/body wrapper', () => {
      const result = htmlToTipTap('<h1>Hello</h1><p>World</p>');
      expect(result.doc.content).toHaveLength(2);
    });

    it('ignores HTML comments', () => {
      const result = htmlToTipTap('<!-- comment --><p>Content</p>');
      expect(result.doc.content).toHaveLength(1);
      expect(result.doc.content[0]).toMatchObject({ type: 'paragraph' });
    });

    it('ignores script tags in body', () => {
      const result = htmlToTipTap(
        '<p>Before</p><script>alert("xss")</script><p>After</p>',
      );
      // script の中身は body コンテンツには含まれない
      const types = result.doc.content.map((n) => n.type);
      expect(types).toContain('paragraph');
    });

    it('handles mixed inline and block content', () => {
      const result = htmlToTipTap(
        '<p>Text with <strong>bold</strong> and <em>italic</em></p>',
      );
      const para = result.doc.content[0]!;
      expect(para.content).toHaveLength(4); // "Text with " + "bold" + " and " + "italic"
      expect(para.content![0]).toMatchObject({
        type: 'text',
        text: 'Text with ',
      });
      expect(para.content![1]).toMatchObject({
        type: 'text',
        text: 'bold',
        marks: [{ type: 'bold' }],
      });
    });

    it('preserves doc type as doc', () => {
      const result = htmlToTipTap('<p>Test</p>');
      expect(result.doc.type).toBe('doc');
    });
  });
});
