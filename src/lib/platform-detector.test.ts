import { describe, it, expect } from 'vitest';
import { detectPlatform } from './platform-detector';

describe('detectPlatform', () => {
  it('returns generic for empty yaml', () => {
    expect(detectPlatform('')).toBe('generic');
    expect(detectPlatform('   ')).toBe('generic');
  });

  it('detects zenn by emoji field', () => {
    expect(detectPlatform('title: "test"\nemoji: "📝"\ntype: "tech"')).toBe('zenn');
  });

  it('detects zenn by type field', () => {
    expect(detectPlatform('title: "test"\ntype: tech')).toBe('zenn');
    expect(detectPlatform('title: "test"\ntype: idea')).toBe('zenn');
    expect(detectPlatform('title: "test"\ntype: "tech"')).toBe('zenn');
  });

  it('detects zenn by topics field', () => {
    expect(detectPlatform('title: "test"\ntopics: []')).toBe('zenn');
    expect(detectPlatform('title: "test"\ntopics: ["typescript"]')).toBe('zenn');
  });

  it('detects qiita by block tags with name', () => {
    const yaml = 'title: test\ntags:\n  - name: TypeScript\n  - name: React\nprivate: false';
    expect(detectPlatform(yaml)).toBe('qiita');
  });

  it('returns generic for plain tags array', () => {
    // Qiita 形式ではない tags (インライン/文字列リスト)
    expect(detectPlatform('title: test\ntags: [a, b]')).toBe('generic');
    expect(detectPlatform('title: test\ntags:\n  - typescript')).toBe('generic');
  });

  it('returns generic for regular frontmatter', () => {
    expect(detectPlatform('title: test\ndate: 2026-01-01\ndraft: false')).toBe('generic');
  });

  it('zenn takes priority if both emoji and tag-name present', () => {
    const yaml = 'title: test\nemoji: "📝"\ntags:\n  - name: TypeScript';
    expect(detectPlatform(yaml)).toBe('zenn');
  });
});
