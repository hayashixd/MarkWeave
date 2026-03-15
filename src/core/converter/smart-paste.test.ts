import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './smart-paste';

describe('htmlToMarkdown', () => {
  it('見出しを atx 形式に変換する', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
    expect(htmlToMarkdown('<h2>Sub</h2>')).toBe('## Sub');
    expect(htmlToMarkdown('<h3>H3</h3>')).toBe('### H3');
  });

  it('太字・斜体を変換する', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
    expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*');
  });

  it('リンクをインライン形式に変換する', () => {
    expect(htmlToMarkdown('<a href="https://example.com">link</a>')).toBe(
      '[link](https://example.com)',
    );
  });

  it('順序なしリストを - 記号で変換する', () => {
    const html = '<ul><li>item 1</li><li>item 2</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toMatch(/-\s+item 1/);
    expect(md).toMatch(/-\s+item 2/);
  });

  it('順序付きリストを変換する', () => {
    const html = '<ol><li>first</li><li>second</li></ol>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('1.');
    expect(md).toContain('first');
  });

  it('コードブロックをフェンスド形式に変換する', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('```');
    expect(md).toContain('const x = 1;');
  });

  it('インラインコードを変換する', () => {
    expect(htmlToMarkdown('<code>foo</code>')).toBe('`foo`');
  });

  it('水平線を --- に変換する', () => {
    expect(htmlToMarkdown('<hr>')).toBe('---');
  });

  it('scriptタグをサニタイズ（除去）する', () => {
    const html = '<p>safe</p><script>alert("xss")</script>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('safe');
    expect(md).not.toContain('script');
    expect(md).not.toContain('alert');
  });

  it('危険な属性をサニタイズする', () => {
    const html = '<img src="x" onerror="alert(1)">';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('onerror');
  });

  it('GFM テーブルを変換する', () => {
    const html =
      '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('| A | B |');
    expect(md).toContain('| 1 | 2 |');
  });

  it('取り消し線を変換する', () => {
    const md = htmlToMarkdown('<del>deleted</del>');
    // turndown-plugin-gfm は ~deleted~ or ~~deleted~~ を出力
    expect(md).toMatch(/~+deleted~+/);
  });

  it('空文字列を受け取ると空文字列を返す', () => {
    expect(htmlToMarkdown('')).toBe('');
  });

  it('プレーンテキストのみの場合はそのまま返す', () => {
    expect(htmlToMarkdown('just text')).toBe('just text');
  });
});
