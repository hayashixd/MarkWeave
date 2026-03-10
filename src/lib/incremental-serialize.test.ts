import { describe, it, expect } from 'vitest';
import { IncrementalSerializer } from './incremental-serialize';
import { tiptapToMarkdown } from './tiptap-to-markdown';
import type { TipTapDoc } from './markdown-to-tiptap';

describe('IncrementalSerializer', () => {
  it('produces the same output as tiptapToMarkdown', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };

    const serializer = new IncrementalSerializer();
    expect(serializer.serialize(doc)).toBe(tiptapToMarkdown(doc));
  });

  it('returns empty string for empty doc', () => {
    const serializer = new IncrementalSerializer();
    expect(serializer.serialize({ type: 'doc', content: [] })).toBe('');
    expect(serializer.serialize({ type: 'doc', content: undefined as unknown as [] })).toBe('');
  });

  it('reuses cached blocks when only one block changes', () => {
    const serializer = new IncrementalSerializer();

    const doc1: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    };

    // First serialization
    const result1 = serializer.serialize(doc1);
    expect(result1).toBe('# Title\n\nFirst paragraph\n\nSecond paragraph\n');

    // Modify only the second paragraph
    const doc2: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Modified paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    };

    const result2 = serializer.serialize(doc2);
    expect(result2).toBe('# Title\n\nModified paragraph\n\nSecond paragraph\n');
    expect(result2).toBe(tiptapToMarkdown(doc2));
  });

  it('handles block additions', () => {
    const serializer = new IncrementalSerializer();

    const doc1: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }],
        },
      ],
    };

    serializer.serialize(doc1);

    const doc2: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second' }],
        },
      ],
    };

    const result = serializer.serialize(doc2);
    expect(result).toBe(tiptapToMarkdown(doc2));
  });

  it('handles block deletions', () => {
    const serializer = new IncrementalSerializer();

    const doc1: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Third' }],
        },
      ],
    };

    serializer.serialize(doc1);

    // Remove the middle paragraph
    const doc2: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Third' }],
        },
      ],
    };

    const result = serializer.serialize(doc2);
    expect(result).toBe(tiptapToMarkdown(doc2));
  });

  it('invalidate clears cache', () => {
    const serializer = new IncrementalSerializer();

    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };

    serializer.serialize(doc);
    serializer.invalidate();

    // After invalidation, should still produce correct result
    const result = serializer.serialize(doc);
    expect(result).toBe('Hello\n');
  });

  it('handles complex blocks (tables, code, lists)', () => {
    const serializer = new IncrementalSerializer();

    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
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
        { type: 'horizontalRule' },
      ],
    };

    const result = serializer.serialize(doc);
    expect(result).toBe(tiptapToMarkdown(doc));
  });
});
