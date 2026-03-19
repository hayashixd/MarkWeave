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
    expect(fm.coediting).toBeUndefined();
  });

  it('parses coediting: true', () => {
    const yaml = `title: "test"\ntags: []\nprivate: false\ncoediting: true`;
    expect(parseQiitaFrontmatter(yaml).coediting).toBe(true);
  });

  it('parses coediting: false as undefined（デフォルト値と区別しない）', () => {
    const yaml = `title: "test"\ntags: []\nprivate: false\ncoediting: false`;
    expect(parseQiitaFrontmatter(yaml).coediting).toBe(false);
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

  it('coediting: true のとき YAML に出力される', () => {
    const yaml = serializeQiitaFrontmatter({ title: 'test', tags: [], private: false, coediting: true });
    expect(yaml).toContain('coediting: true');
  });

  it('coediting: false / undefined のとき YAML に出力されない', () => {
    const yaml1 = serializeQiitaFrontmatter({ title: 'test', tags: [], private: false });
    expect(yaml1).not.toContain('coediting');
    const yaml2 = serializeQiitaFrontmatter({ title: 'test', tags: [], private: false, coediting: false });
    expect(yaml2).not.toContain('coediting');
  });

  it('coediting: true のラウンドトリップ', () => {
    const original = { title: 'チーム記事', tags: ['Go'], private: false, coediting: true };
    const yaml = serializeQiitaFrontmatter(original);
    const parsed = parseQiitaFrontmatter(yaml);
    expect(parsed.coediting).toBe(true);
  });
});
