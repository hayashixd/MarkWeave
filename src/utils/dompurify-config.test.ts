/**
 * dompurify-config のユニットテスト
 *
 * sanitizeHtml / sanitizeMermaidSvg が各 XSS ベクターを正しく除去し、
 * 正当なコンテンツを保持することを検証する。
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeMermaidSvg } from './dompurify-config';

describe('sanitizeHtml', () => {
  // ---------------------------------------------------------------------------
  // script タグの除去
  // ---------------------------------------------------------------------------
  describe('script tag removal', () => {
    it('<script> タグを除去する', () => {
      const result = sanitizeHtml('<p>text</p><script>alert(1)</script>');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert(1)');
      expect(result).toContain('text');
    });

    it('src 付き <script> を除去する', () => {
      const result = sanitizeHtml('<script src="https://evil.com/xss.js"></script>');
      expect(result).not.toContain('<script');
    });

    it('大文字・小文字混在の ScRiPt タグを除去する', () => {
      const result = sanitizeHtml('<ScRiPt>alert(1)</ScRiPt>');
      expect(result).not.toContain('alert(1)');
    });
  });

  // ---------------------------------------------------------------------------
  // FORBID_TAGS に指定されたタグの除去
  // ---------------------------------------------------------------------------
  describe('forbidden tag removal (FORBID_TAGS)', () => {
    it('<iframe> タグを除去する', () => {
      const result = sanitizeHtml('<iframe src="https://evil.com"></iframe>Safe text');
      expect(result).not.toContain('<iframe');
      expect(result).toContain('Safe text');
    });

    it('<object> タグを除去する', () => {
      const result = sanitizeHtml('<object data="exploit.swf"></object>');
      expect(result).not.toContain('<object');
    });

    it('<embed> タグを除去する', () => {
      const result = sanitizeHtml('<embed src="plugin.swf">');
      expect(result).not.toContain('<embed');
    });

    it('<form> タグと内部の <input> を除去する', () => {
      const result = sanitizeHtml(
        '<form action="https://phish.com"><input name="pass"><button>Submit</button></form>',
      );
      expect(result).not.toContain('<form');
      expect(result).not.toContain('<input');
      expect(result).not.toContain('<button');
    });

    it('<style> タグを除去する（CSS インジェクション防止）', () => {
      const result = sanitizeHtml(
        '<style>body { background: url("javascript:alert(1)") }</style><p>text</p>',
      );
      expect(result).not.toContain('<style');
      expect(result).not.toContain('expression');
    });
  });

  // ---------------------------------------------------------------------------
  // イベントハンドラ属性の除去
  // ---------------------------------------------------------------------------
  describe('event handler attribute removal', () => {
    it('onclick を除去する', () => {
      const result = sanitizeHtml('<a href="#" onclick="alert(document.cookie)">click</a>');
      expect(result).not.toContain('onclick');
    });

    it('onerror を除去する', () => {
      const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('onload を除去する', () => {
      const result = sanitizeHtml('<img src="valid.jpg" onload="exfil()">');
      expect(result).not.toContain('onload');
    });

    it('onmouseover を除去する', () => {
      const result = sanitizeHtml('<span onmouseover="track(this)">hover</span>');
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('hover');
    });

    it('onfocus を除去する', () => {
      const result = sanitizeHtml('<input type="text" onfocus="steal()">');
      expect(result).not.toContain('onfocus');
    });

    it('onsubmit を除去する', () => {
      const result = sanitizeHtml('<form onsubmit="steal(this)">content</form>');
      expect(result).not.toContain('onsubmit');
    });
  });

  // ---------------------------------------------------------------------------
  // 危険なプロトコルの除去
  // ---------------------------------------------------------------------------
  describe('dangerous protocol removal', () => {
    it('javascript: href を除去する', () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('vbscript: href を除去する', () => {
      const result = sanitizeHtml('<a href="vbscript:msgbox(1)">click</a>');
      expect(result).not.toContain('vbscript:');
    });

    it('data:text/html href を除去する', () => {
      const result = sanitizeHtml(
        '<a href="data:text/html,<script>alert(1)</script>">payload</a>',
      );
      expect(result).not.toContain('data:text/html');
    });

    it('img src の javascript: を除去する', () => {
      const result = sanitizeHtml('<img src="javascript:alert(1)" alt="img">');
      expect(result).not.toContain('javascript:');
    });

    it('https:// href は保持する', () => {
      const result = sanitizeHtml('<a href="https://example.com">link</a>');
      expect(result).toContain('https://example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // SVG 内 XSS
  // ---------------------------------------------------------------------------
  describe('SVG XSS vectors', () => {
    it('SVG 内の <script> を除去する', () => {
      const result = sanitizeHtml(
        '<svg><script>alert(1)</script><circle cx="50" cy="50" r="40"/></svg>',
      );
      expect(result).not.toContain('alert(1)');
      expect(result).not.toContain('<script');
    });

    it('SVG の onclick ハンドラを除去する', () => {
      const result = sanitizeHtml(
        '<svg><rect onclick="alert(1)" width="100" height="100"/></svg>',
      );
      expect(result).not.toContain('onclick');
    });

    it('SVG の正当な要素は保持する', () => {
      const result = sanitizeHtml(
        '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>',
      );
      expect(result).toContain('<rect');
    });
  });

  // ---------------------------------------------------------------------------
  // 許可されたコンテンツの保持
  // ---------------------------------------------------------------------------
  describe('allowed content passes through', () => {
    it('見出しタグを保持する', () => {
      const result = sanitizeHtml('<h1>Title</h1><h2>Subtitle</h2>');
      expect(result).toContain('<h1>');
      expect(result).toContain('Title');
    });

    it('href 付きリンクを保持する', () => {
      const result = sanitizeHtml('<a href="https://example.com">link</a>');
      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
    });

    it('src 付き画像を保持する', () => {
      const result = sanitizeHtml('<img src="photo.jpg" alt="photo">');
      expect(result).toContain('<img');
      expect(result).toContain('src="photo.jpg"');
    });

    it('コードブロックを保持する', () => {
      const result = sanitizeHtml('<pre><code>const x = 1;</code></pre>');
      expect(result).toContain('<pre>');
      expect(result).toContain('const x = 1;');
    });

    it('テーブルを保持する', () => {
      const result = sanitizeHtml(
        '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>',
      );
      expect(result).toContain('<table>');
      expect(result).toContain('<th>');
    });

    it('強調・斜体を保持する', () => {
      const result = sanitizeHtml('<p><strong>bold</strong> and <em>italic</em></p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });
  });

  // ---------------------------------------------------------------------------
  // エッジケース
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('空文字列を処理できる', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('HTML なしのプレーンテキストを処理できる', () => {
      const result = sanitizeHtml('just plain text');
      expect(result).toContain('just plain text');
    });

    it('深くネストされた危険なコンテンツを除去する', () => {
      const html =
        '<div><p><span><a onclick="alert(1)" href="javascript:void(0)">x</a></span></p></div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('javascript:');
    });

    it('HTML エンティティとしてエンコードされた script は展開後も安全', () => {
      // &lt;script&gt; はエンティティとして表示されるため実行されない
      const result = sanitizeHtml('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
      expect(result).not.toMatch(/<script>/i);
    });

    it('ヌルバイトを含む属性値は無害化される', () => {
      const result = sanitizeHtml('<img src="jav\0ascript:alert(1)" alt="img">');
      expect(result).not.toContain('javascript:');
    });

    it('<meta http-equiv="refresh"> を除去する', () => {
      const result = sanitizeHtml(
        '<meta http-equiv="refresh" content="0;url=https://phish.com"><p>content</p>',
      );
      // meta は ALLOWED_TAGS に含まれていないため除去される
      expect(result).not.toContain('http-equiv');
    });
  });
});

describe('sanitizeMermaidSvg', () => {
  it('foreignObject を除去する（Mermaid 特別制限）', () => {
    const svg =
      '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">' +
      '<script>alert(1)</script></body></foreignObject></svg>';
    const result = sanitizeMermaidSvg(svg);
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('alert(1)');
  });

  it('標準 SVG 要素は保持する', () => {
    const svg =
      '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>';
    const result = sanitizeMermaidSvg(svg);
    expect(result).toContain('<rect');
    expect(result).toContain('fill');
  });

  it('SVG 内の script タグを除去する', () => {
    const svg = '<svg><script>alert(1)</script><circle cx="50" cy="50" r="40"/></svg>';
    const result = sanitizeMermaidSvg(svg);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('<circle');
  });

  it('path, g, marker など Mermaid が使う要素を保持する', () => {
    const svg =
      '<svg><defs><marker id="m" markerWidth="10" markerHeight="10" orient="auto">' +
      '<path d="M0,0 L10,5 L0,10 Z" fill="black"/></marker></defs>' +
      '<g><path d="M10 10 L90 90" stroke="black"/></g></svg>';
    const result = sanitizeMermaidSvg(svg);
    expect(result).toContain('<path');
    expect(result).toContain('<marker');
  });

  it('空文字列を処理できる', () => {
    expect(sanitizeMermaidSvg('')).toBe('');
  });
});
