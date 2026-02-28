import { describe, it, expect } from 'vitest';
import { markdownToTipTap } from './markdown-to-tiptap';

describe('markdownToTipTap', () => {
  it('converts headings', () => {
    const doc = markdownToTipTap('# Hello\n\n## World\n');
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Hello' }],
    });
    expect(doc.content[1]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'World' }],
    });
  });

  it('converts paragraphs', () => {
    const doc = markdownToTipTap('Hello world\n');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0]).toMatchObject({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    });
  });

  it('converts bold text', () => {
    const doc = markdownToTipTap('**bold text**\n');
    expect(doc.content[0]!.content![0]).toMatchObject({
      type: 'text',
      text: 'bold text',
      marks: [{ type: 'bold' }],
    });
  });

  it('converts italic text', () => {
    const doc = markdownToTipTap('*italic text*\n');
    expect(doc.content[0]!.content![0]).toMatchObject({
      type: 'text',
      text: 'italic text',
      marks: [{ type: 'italic' }],
    });
  });

  it('converts bold+italic text with accumulated marks', () => {
    const doc = markdownToTipTap('***bold italic***\n');
    const textNode = doc.content[0]!.content![0]!;
    expect(textNode.text).toBe('bold italic');
    expect(textNode.marks).toHaveLength(2);
    const markTypes = textNode.marks!.map((m) => m.type).sort();
    expect(markTypes).toEqual(['bold', 'italic']);
  });

  it('converts bullet list', () => {
    const doc = markdownToTipTap('- item 1\n- item 2\n');
    expect(doc.content[0]).toMatchObject({
      type: 'bulletList',
    });
    expect(doc.content[0]!.content).toHaveLength(2);
    expect(doc.content[0]!.content![0]!.type).toBe('listItem');
  });

  it('converts ordered list', () => {
    const doc = markdownToTipTap('1. first\n2. second\n');
    expect(doc.content[0]).toMatchObject({
      type: 'orderedList',
    });
    expect(doc.content[0]!.content).toHaveLength(2);
  });

  it('converts inline code', () => {
    const doc = markdownToTipTap('use `console.log`\n');
    expect(doc.content[0]!.content![1]).toMatchObject({
      type: 'text',
      text: 'console.log',
      marks: [{ type: 'code' }],
    });
  });

  it('converts links without target/rel', () => {
    const doc = markdownToTipTap('[click](https://example.com)\n');
    const textNode = doc.content[0]!.content![0]!;
    expect(textNode.marks![0]).toMatchObject({
      type: 'link',
      attrs: {
        href: 'https://example.com',
        target: null,
        rel: null,
      },
    });
  });

  it('converts blockquote', () => {
    const doc = markdownToTipTap('> quoted text\n');
    expect(doc.content[0]).toMatchObject({
      type: 'blockquote',
    });
    expect(doc.content[0]!.content![0]!.content![0]).toMatchObject({
      type: 'text',
      text: 'quoted text',
    });
  });

  it('converts code block', () => {
    const doc = markdownToTipTap('```js\nconsole.log("hi")\n```\n');
    expect(doc.content[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'js' },
    });
  });

  it('converts horizontal rule', () => {
    const doc = markdownToTipTap('---\n');
    expect(doc.content[0]).toMatchObject({
      type: 'horizontalRule',
    });
  });

  it('returns at least one empty paragraph for empty input', () => {
    const doc = markdownToTipTap('');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0]!.type).toBe('paragraph');
  });

  it('converts GFM table to TipTap table structure', () => {
    const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |\n';
    const doc = markdownToTipTap(md);
    expect(doc.content[0]).toMatchObject({ type: 'table' });
    const table = doc.content[0]!;
    // ヘッダー行 + データ行 2 行
    expect(table.content).toHaveLength(3);
    // ヘッダー行のセルは tableHeader
    expect(table.content![0]!.content![0]).toMatchObject({ type: 'tableHeader' });
    // データ行のセルは tableCell
    expect(table.content![1]!.content![0]).toMatchObject({ type: 'tableCell' });
  });

  it('preserves column alignment in table cell attrs', () => {
    const md = '| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |\n';
    const doc = markdownToTipTap(md);
    const headerRow = doc.content[0]!.content![0]!;
    expect(headerRow.content![0]!.attrs?.style).toContain('text-align: left');
    expect(headerRow.content![1]!.attrs?.style).toContain('text-align: center');
    expect(headerRow.content![2]!.attrs?.style).toContain('text-align: right');
  });
});
