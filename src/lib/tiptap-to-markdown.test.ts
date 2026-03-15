import { describe, it, expect } from 'vitest';
import { tiptapToMarkdown } from './tiptap-to-markdown';
import { markdownToTipTap } from './markdown-to-tiptap';
import type { TipTapDoc } from './markdown-to-tiptap';

describe('tiptapToMarkdown', () => {
  it('serializes headings', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('# Hello\n');
  });

  it('serializes paragraphs', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('Hello world\n');
  });

  it('serializes bold text', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('**bold**\n');
  });

  it('serializes italic text', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('*italic*\n');
  });

  it('serializes bullet list', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'item 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'item 2' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('- item 1\n- item 2\n');
  });

  it('serializes ordered list', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'first' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'second' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('1. first\n2. second\n');
  });

  it('serializes links', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com', target: null, rel: null },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('[click](https://example.com)\n');
  });

  it('serializes code block with language', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'console.log("hi")' }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('```js\nconsole.log("hi")\n```\n');
  });

  it('serializes horizontal rule', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    };
    expect(tiptapToMarkdown(doc)).toBe('---\n');
  });

  it('serializes hard break as two trailing spaces + newline (CommonMark)', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'line one' },
            { type: 'hardBreak' },
            { type: 'text', text: 'line two' },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('line one  \nline two\n');
  });

  it('returns empty string for empty doc', () => {
    const doc: TipTapDoc = { type: 'doc', content: [] };
    expect(tiptapToMarkdown(doc)).toBe('');
  });
});

describe('roundtrip: MD → TipTap → MD', () => {
  const cases = [
    { name: 'heading', input: '# Hello\n' },
    { name: 'paragraph', input: 'Hello world\n' },
    { name: 'bold', input: '**bold text**\n' },
    { name: 'italic', input: '*italic text*\n' },
    { name: 'inline code', input: '`code`\n' },
    { name: 'horizontal rule', input: '---\n' },
    {
      name: 'bullet list',
      input: '- item 1\n- item 2\n',
    },
    {
      name: 'ordered list',
      input: '1. first\n2. second\n',
    },
    {
      name: 'code block',
      input: '```js\nconsole.log("hi")\n```\n',
    },
    {
      name: 'link',
      input: '[click](https://example.com)\n',
    },
    {
      name: 'simple table',
      input: '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |\n',
    },
    {
      name: 'aligned table',
      input: '| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |\n',
    },
  ];

  for (const { name, input } of cases) {
    it(`roundtrips: ${name}`, () => {
      const doc = markdownToTipTap(input);
      const output = tiptapToMarkdown(doc);
      expect(output).toBe(input);
    });
  }
});

describe('tiptapToMarkdown - table serialization', () => {
  it('serializes table nodes to GFM pipe syntax', () => {
    const doc = markdownToTipTap('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
    const result = tiptapToMarkdown(doc);
    expect(result).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('serializes alignment separators correctly', () => {
    const doc = markdownToTipTap('| L | C | R |\n| :--- | :---: | ---: |\n| x | y | z |\n');
    const result = tiptapToMarkdown(doc);
    expect(result).toContain(':---');
    expect(result).toContain(':---:');
    expect(result).toContain('---:');
  });
});
