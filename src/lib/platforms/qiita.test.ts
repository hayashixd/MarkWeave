import { describe, it, expect } from 'vitest';
import { parseQiitaFrontmatter, serializeQiitaFrontmatter } from './qiita';

describe('parseQiitaFrontmatter', () => {
  it('parses full frontmatter', () => {
    const yaml = `title: "TypeScript入門"\ntags:\n  - name: TypeScript\n  - name: React\nprivate: false`;
    const fm = parseQiitaFrontmatter(yaml);
    expect(fm.title).toBe('TypeScript入門');
    expect(fm.tags).toEqual(['TypeScript', 'React']);
    expect(fm.private).toBe(false);
  });

  it('parses private: true', () => {
    const yaml = `title: "test"\ntags:\n  - name: Go\nprivate: true`;
    expect(parseQiitaFrontmatter(yaml).private).toBe(true);
  });

  it('parses empty tags block', () => {
    const yaml = `title: "test"\ntags: []\nprivate: false`;
    expect(parseQiitaFrontmatter(yaml).tags).toEqual([]);
  });

  it('uses defaults for missing fields', () => {
    const fm = parseQiitaFrontmatter('title: "test"');
    expect(fm.tags).toEqual([]);
    expect(fm.private).toBe(false);
  });
});

describe('serializeQiitaFrontmatter', () => {
  it('serializes all fields', () => {
    const yaml = serializeQiitaFrontmatter({
      title: 'TypeScript入門',
      tags: ['TypeScript', 'React'],
      private: false,
    });
    expect(yaml).toContain('title: "TypeScript入門"');
    expect(yaml).toContain('- name: TypeScript');
    expect(yaml).toContain('- name: React');
    expect(yaml).toContain('private: false');
  });

  it('serializes empty tags', () => {
    const yaml = serializeQiitaFrontmatter({ title: '', tags: [], private: false });
    expect(yaml).toContain('tags: []');
  });

  it('roundtrips correctly', () => {
    const original = {
      title: 'テスト記事',
      tags: ['Go', 'Docker'],
      private: true,
    };
    const yaml = serializeQiitaFrontmatter(original);
    const parsed = parseQiitaFrontmatter(yaml);
    expect(parsed).toEqual(original);
  });
});
