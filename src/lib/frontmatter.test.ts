import { describe, it, expect } from 'vitest';
import {
  parseFrontMatter,
  serializeFrontMatter,
  getYamlSummary,
  parseYamlFields,
} from './frontmatter';

describe('frontmatter', () => {
  // =========================================================================
  // parseFrontMatter
  // =========================================================================
  describe('parseFrontMatter', () => {
    it('extracts YAML block and body', () => {
      const md = '---\ntitle: Test\n---\n# Hello';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('title: Test');
      expect(result.body).toBe('# Hello');
    });

    it('returns empty yaml when no front matter', () => {
      const md = '# Just a heading\n\nSome text';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('');
      expect(result.body).toBe(md);
    });

    it('handles empty YAML block', () => {
      const md = '---\n\n---\nBody';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('');
      expect(result.body).toBe('Body');
    });

    it('handles multiline YAML', () => {
      const md = '---\ntitle: Test\ndate: 2026-01-01\ntags: [a, b]\n---\nBody text';
      const result = parseFrontMatter(md);
      expect(result.yaml).toContain('title: Test');
      expect(result.yaml).toContain('date: 2026-01-01');
      expect(result.body).toBe('Body text');
    });

    it('handles Windows line endings', () => {
      const md = '---\r\ntitle: Test\r\n---\r\n# Hello';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('title: Test');
      expect(result.body).toBe('# Hello');
    });

    it('does not treat --- in body as front matter', () => {
      const md = '# Title\n\n---\n\nSome text';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('');
      expect(result.body).toBe(md);
    });

    it('handles front matter at end of file (no body)', () => {
      const md = '---\ntitle: Test\n---\n';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('title: Test');
      expect(result.body).toBe('');
    });

    it('handles front matter at end of file without trailing newline', () => {
      const md = '---\ntitle: Test\n---';
      const result = parseFrontMatter(md);
      expect(result.yaml).toBe('title: Test');
      expect(result.body).toBe('');
    });
  });

  // =========================================================================
  // serializeFrontMatter
  // =========================================================================
  describe('serializeFrontMatter', () => {
    it('combines YAML and body', () => {
      const result = serializeFrontMatter('title: Test', '# Hello');
      expect(result).toBe('---\ntitle: Test\n---\n# Hello');
    });

    it('returns body only when yaml is empty', () => {
      expect(serializeFrontMatter('', 'Body')).toBe('Body');
    });

    it('returns body only when yaml is whitespace', () => {
      expect(serializeFrontMatter('  \n  ', 'Body')).toBe('Body');
    });

    it('roundtrips with parseFrontMatter', () => {
      const yaml = 'title: Test\ndate: 2026-01-01';
      const body = '# Hello\n\nWorld';
      const serialized = serializeFrontMatter(yaml, body);
      const parsed = parseFrontMatter(serialized);
      expect(parsed.yaml).toBe(yaml);
      expect(parsed.body).toBe(body);
    });
  });

  // =========================================================================
  // getYamlSummary
  // =========================================================================
  describe('getYamlSummary', () => {
    it('extracts title', () => {
      expect(getYamlSummary('title: My Post')).toContain('My Post');
    });

    it('extracts title and date', () => {
      const result = getYamlSummary('title: My Post\ndate: 2026-03-07');
      expect(result).toBe('My Post · 2026-03-07');
    });

    it('extracts inline tags', () => {
      const result = getYamlSummary('title: Post\ntags: [markdown, editor]');
      expect(result).toContain('#markdown');
      expect(result).toContain('#editor');
    });

    it('extracts block-format tags', () => {
      const result = getYamlSummary('title: Post\ntags:\n  - markdown\n  - editor\n');
      expect(result).toContain('#markdown');
      expect(result).toContain('#editor');
    });

    it('strips quotes from title', () => {
      expect(getYamlSummary("title: 'My Post'")).toContain('My Post');
      expect(getYamlSummary('title: "My Post"')).toContain('My Post');
    });

    it('returns default when no fields found', () => {
      expect(getYamlSummary('draft: true')).toBe('フロントマター');
    });

    it('handles empty yaml', () => {
      expect(getYamlSummary('')).toBe('フロントマター');
    });
  });

  // =========================================================================
  // parseYamlFields
  // =========================================================================
  describe('parseYamlFields', () => {
    it('parses title', () => {
      const result = parseYamlFields('title: My Title');
      expect(result.title).toBe('My Title');
    });

    it('parses date', () => {
      const result = parseYamlFields('date: 2026-03-07');
      expect(result.date).toBe('2026-03-07');
    });

    it('parses draft: true', () => {
      const result = parseYamlFields('draft: true');
      expect(result.draft).toBe(true);
    });

    it('parses draft: false', () => {
      const result = parseYamlFields('draft: false');
      expect(result.draft).toBe(false);
    });

    it('parses description', () => {
      const result = parseYamlFields('description: Some desc');
      expect(result.description).toBe('Some desc');
    });

    it('parses inline tags', () => {
      const result = parseYamlFields('tags: [a, b, c]');
      expect(result.tags).toEqual(['a', 'b', 'c']);
    });

    it('parses inline tags with quotes', () => {
      const result = parseYamlFields("tags: ['a', \"b\"]");
      expect(result.tags).toEqual(['a', 'b']);
    });

    it('parses block tags', () => {
      const result = parseYamlFields('tags:\n  - markdown\n  - editor\n');
      expect(result.tags).toEqual(['markdown', 'editor']);
    });

    it('returns empty object for empty yaml', () => {
      const result = parseYamlFields('');
      expect(result).toEqual({});
    });

    it('parses all fields together', () => {
      const yaml = `title: My Post
date: 2026-03-07
draft: true
description: A great post
tags: [a, b]`;
      const result = parseYamlFields(yaml);
      expect(result.title).toBe('My Post');
      expect(result.date).toBe('2026-03-07');
      expect(result.draft).toBe(true);
      expect(result.description).toBe('A great post');
      expect(result.tags).toEqual(['a', 'b']);
    });
  });
});
