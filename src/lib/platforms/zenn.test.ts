import { describe, it, expect } from 'vitest';
import { parseZennFrontmatter, serializeZennFrontmatter } from './zenn';

describe('parseZennFrontmatter', () => {
  it('parses full frontmatter', () => {
    const yaml = `title: "TypeScript入門"\nemoji: "📝"\ntype: "tech"\ntopics: ["typescript", "react"]\npublished: false`;
    const fm = parseZennFrontmatter(yaml);
    expect(fm.title).toBe('TypeScript入門');
    expect(fm.emoji).toBe('📝');
    expect(fm.type).toBe('tech');
    expect(fm.topics).toEqual(['typescript', 'react']);
    expect(fm.published).toBe(false);
  });

  it('parses published: true', () => {
    const yaml = `title: "test"\nemoji: "📝"\ntype: "tech"\ntopics: []\npublished: true`;
    expect(parseZennFrontmatter(yaml).published).toBe(true);
  });

  it('parses topics as block list', () => {
    const yaml = `title: "test"\nemoji: "📝"\ntype: "tech"\ntopics:\n  - typescript\n  - react\npublished: false`;
    expect(parseZennFrontmatter(yaml).topics).toEqual(['typescript', 'react']);
  });

  it('parses empty topics', () => {
    const yaml = `title: "test"\nemoji: "📝"\ntype: "tech"\ntopics: []\npublished: false`;
    expect(parseZennFrontmatter(yaml).topics).toEqual([]);
  });

  it('uses defaults for missing fields', () => {
    const fm = parseZennFrontmatter('title: "test"');
    expect(fm.emoji).toBe('📝');
    expect(fm.type).toBe('tech');
    expect(fm.topics).toEqual([]);
    expect(fm.published).toBe(false);
  });

  it('handles unquoted type', () => {
    const yaml = 'title: "test"\ntype: idea';
    expect(parseZennFrontmatter(yaml).type).toBe('idea');
  });
});

describe('serializeZennFrontmatter', () => {
  it('serializes all fields', () => {
    const yaml = serializeZennFrontmatter({
      title: 'TypeScript入門',
      emoji: '📝',
      type: 'tech',
      topics: ['typescript', 'react'],
      published: false,
    });
    expect(yaml).toContain('title: "TypeScript入門"');
    expect(yaml).toContain('emoji: "📝"');
    expect(yaml).toContain('type: "tech"');
    expect(yaml).toContain('topics: ["typescript", "react"]');
    expect(yaml).toContain('published: false');
  });

  it('serializes empty topics', () => {
    const yaml = serializeZennFrontmatter({
      title: '',
      emoji: '📝',
      type: 'tech',
      topics: [],
      published: false,
    });
    expect(yaml).toContain('topics: []');
  });

  it('roundtrips correctly', () => {
    const original = {
      title: 'テスト記事',
      emoji: '🚀',
      type: 'idea' as const,
      topics: ['go', 'rust'],
      published: true,
    };
    const yaml = serializeZennFrontmatter(original);
    const parsed = parseZennFrontmatter(yaml);
    expect(parsed).toEqual(original);
  });
});
