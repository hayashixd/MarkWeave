/**
 * smart-paste (htmlToMarkdown) 追加エッジケーステスト
 */
import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './smart-paste';

describe('htmlToMarkdown – edge cases', () => {
  it('handles empty string', () => {
    expect(htmlToMarkdown('')).toBe('');
  });

  it('handles plain text without HTML', () => {
    const text = 'Just plain text here';
    const result = htmlToMarkdown(text);
    expect(result).toContain('Just plain text here');
  });

  it('handles deeply nested lists', () => {
    const html = '<ul><li>A<ul><li>B<ul><li>C</li></ul></li></ul></li></ul>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
  });

  it('handles multiple paragraphs', () => {
    const html = '<p>First</p><p>Second</p><p>Third</p>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('First');
    expect(result).toContain('Second');
    expect(result).toContain('Third');
  });

  it('handles links', () => {
    const html = '<a href="https://example.com">Example</a>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('[Example](https://example.com)');
  });

  it('handles images', () => {
    const html = '<img src="test.png" alt="Test Image">';
    const result = htmlToMarkdown(html);
    expect(result).toContain('![Test Image](test.png)');
  });

  it('handles bold and italic', () => {
    const html = '<p><strong>bold</strong> and <em>italic</em></p>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('**bold**');
    expect(result).toContain('*italic*');
  });

  it('handles tables', () => {
    const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('1');
    expect(result).toContain('2');
  });

  it('handles code blocks', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('const x = 1;');
  });

  it('handles inline code', () => {
    const html = '<p>Use <code>npm install</code> to install.</p>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('`npm install`');
  });

  it('handles blockquote', () => {
    const html = '<blockquote><p>A wise quote</p></blockquote>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('> A wise quote');
  });

  it('handles ordered lists', () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('1.');
    expect(result).toContain('First');
  });

  it('handles strikethrough', () => {
    const html = '<del>deleted text</del>';
    const result = htmlToMarkdown(html);
    // turndown-plugin-gfm uses ~ for strikethrough
    expect(result).toContain('~deleted text~');
  });

  it('handles horizontal rule', () => {
    const html = '<hr>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('---');
  });

  it('handles br tags', () => {
    const html = '<p>line1<br>line2</p>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('line1');
    expect(result).toContain('line2');
  });
});
