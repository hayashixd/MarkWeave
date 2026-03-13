import { describe, it, expect } from 'vitest';
import {
  resolveWikilinksForExport,
  extractTitle,
  convertMdToHtml,
} from './md-to-html';

describe('md-to-html', () => {
  // =========================================================================
  // resolveWikilinksForExport
  // =========================================================================
  describe('resolveWikilinksForExport', () => {
    it('converts simple wikilink to markdown link', () => {
      const result = resolveWikilinksForExport('See [[my-note]]');
      expect(result).toBe('See [my-note](my-note.md)');
    });

    it('converts labeled wikilink', () => {
      const result = resolveWikilinksForExport('See [[my-note|Click here]]');
      expect(result).toBe('See [Click here](my-note.md)');
    });

    it('handles multiple wikilinks', () => {
      const result = resolveWikilinksForExport('[[a]] and [[b]]');
      expect(result).toBe('[a](a.md) and [b](b.md)');
    });

    it('handles spaces in target (converts to hyphens)', () => {
      const result = resolveWikilinksForExport('[[my great note]]');
      expect(result).toBe('[my great note](my-great-note.md)');
    });

    it('leaves non-wikilink text unchanged', () => {
      const input = 'Regular text [link](url)';
      expect(resolveWikilinksForExport(input)).toBe(input);
    });

    it('handles empty wikilink target', () => {
      // The regex requires at least one non-] char, so empty brackets are left as-is
      const input = '[[]]';
      expect(resolveWikilinksForExport(input)).toBe('[[]]');
    });

    it('handles wikilink with whitespace trimming', () => {
      const result = resolveWikilinksForExport('[[ spaced ]]');
      expect(result).toContain('[spaced]');
    });
  });

  // =========================================================================
  // extractTitle
  // =========================================================================
  describe('extractTitle', () => {
    it('extracts H1 heading as title', () => {
      expect(extractTitle('# My Title\n\nSome text')).toBe('My Title');
    });

    it('returns null when no H1', () => {
      expect(extractTitle('## Not H1\n\nSome text')).toBeNull();
    });

    it('returns null for empty text', () => {
      expect(extractTitle('')).toBeNull();
    });

    it('extracts first H1 from multi-heading document', () => {
      expect(extractTitle('# First\n\n# Second')).toBe('First');
    });

    it('trims whitespace from title', () => {
      expect(extractTitle('#   Spaced Title  ')).toBe('Spaced Title');
    });

    it('handles H1 not at start of document', () => {
      expect(extractTitle('Some text\n\n# Title')).toBe('Title');
    });
  });

  // =========================================================================
  // convertMdToHtml (integration)
  // =========================================================================
  describe('convertMdToHtml', () => {
    it('converts basic markdown to HTML', async () => {
      const html = await convertMdToHtml('# Hello\n\nWorld');
      expect(html).toContain('<h1');
      expect(html).toContain('Hello');
      expect(html).toContain('World');
    });

    it('wraps content in HTML document structure', async () => {
      const html = await convertMdToHtml('Test');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
    });

    it('sets document title', async () => {
      const html = await convertMdToHtml('Test', { title: 'My Doc' });
      expect(html).toContain('My Doc');
    });

    it('renders GFM tables', async () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const html = await convertMdToHtml(md);
      expect(html).toContain('<table');
    });

    it('resolves wikilinks before conversion', async () => {
      const md = 'See [[my-note]]';
      const html = await convertMdToHtml(md);
      expect(html).toContain('my-note.md');
      expect(html).not.toContain('[[');
    });

    it('handles code blocks', async () => {
      const md = '```javascript\nconst x = 1;\n```';
      const html = await convertMdToHtml(md);
      expect(html).toContain('<code');
    });

    it('escapes title for HTML safety', async () => {
      const html = await convertMdToHtml('Test', { title: '<script>alert(1)</script>' });
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
