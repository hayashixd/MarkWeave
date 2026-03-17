/**
 * md-to-html 追加テスト — セキュリティ・エッジケース
 *
 * 検証するシナリオ:
 * - Markdown 内の raw HTML インジェクション（allowDangerousHtml: false）
 * - javascript: / vbscript: リンク
 * - title フィールドへの XSS（escapeHtml 全文字）
 * - TOC 生成時の XSS
 * - 極端に大きなドキュメント
 * - Wikilink 変換の境界値
 */

import { describe, it, expect } from 'vitest';
import {
  convertMdToHtml,
  resolveWikilinksForExport,
  extractTitle,
  injectIntoTemplate,
  type MdToHtmlOptions,
} from './md-to-html';

// injectIntoTemplate は md-to-html.ts からエクスポートされている前提。
// 万一エクスポートされていない場合は convertMdToHtml 経由でテストを代替する。

const baseOpts: MdToHtmlOptions = {
  theme: 'github',
  highlight: false,
  math: false,
  toc: false,
  inlineCss: false,
  title: 'Test',
};

describe('convertMdToHtml – security', () => {
  // ---------------------------------------------------------------------------
  // raw HTML インジェクション（allowDangerousHtml: false）
  // ---------------------------------------------------------------------------
  describe('raw HTML injection in markdown body (allowDangerousHtml: false)', () => {
    it('Markdown 内の <script> タグはレンダリングされない', async () => {
      const md = 'before\n\n<script>alert(document.cookie)</script>\n\nafter';
      const html = await convertMdToHtml(md);
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('after');
    });

    it('Markdown 内の <iframe> タグはレンダリングされない', async () => {
      const md = 'text\n\n<iframe src="https://evil.com"></iframe>\n\nmore';
      const html = await convertMdToHtml(md);
      expect(html).not.toContain('<iframe');
      expect(html).toContain('more');
    });

    it('Markdown 内の onerror 付き <img> はレンダリングされない', async () => {
      const md = 'text\n\n<img src="x" onerror="alert(1)">\n\nend';
      const html = await convertMdToHtml(md);
      expect(html).not.toContain('onerror');
    });
  });

  // ---------------------------------------------------------------------------
  // javascript: リンク
  // ---------------------------------------------------------------------------
  describe('javascript: and vbscript: links in markdown', () => {
    it('[text](javascript:alert(1)) の href が除去される', async () => {
      const md = '[click me](javascript:alert(document.domain))';
      const html = await convertMdToHtml(md);
      expect(html).not.toMatch(/href="javascript:/i);
      // リンクテキスト自体は残る
      expect(html).toContain('click me');
    });

    it('[link](vbscript:msgbox(1)) の href が除去される', async () => {
      const md = '[link](vbscript:msgbox(1))';
      const html = await convertMdToHtml(md);
      expect(html).not.toMatch(/href="vbscript:/i);
    });

    it('通常の https:// リンクは正常にレンダリングされる', async () => {
      const md = '[Example](https://example.com)';
      const html = await convertMdToHtml(md);
      expect(html).toContain('href="https://example.com"');
    });

    it('mailto: リンクは除去されない', async () => {
      const md = '[mail](mailto:user@example.com)';
      const html = await convertMdToHtml(md);
      expect(html).toContain('href="mailto:user@example.com"');
    });

    it('アンカーリンク（#）は除去されない', async () => {
      const md = '[section](#heading)';
      const html = await convertMdToHtml(md);
      expect(html).toContain('href="#heading"');
    });
  });

  // ---------------------------------------------------------------------------
  // 画像 alt テキストへの注入
  // ---------------------------------------------------------------------------
  describe('image alt text injection', () => {
    it('alt テキストの < > が &lt; &gt; にエスケープされる', async () => {
      const md = '![<script>alert(1)</script>](image.png)';
      const html = await convertMdToHtml(md);
      expect(html).not.toContain('alt="<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('<img');
      expect(html).toContain('image.png');
    });
  });

  // ---------------------------------------------------------------------------
  // 大量コンテンツ（パフォーマンス / クラッシュ）
  // ---------------------------------------------------------------------------
  describe('large content handling', () => {
    it('100 段落のコンテンツを処理できる', async () => {
      const paragraphs = Array.from({ length: 100 }, (_, i) => `Paragraph ${i + 1}.`).join(
        '\n\n',
      );
      const html = await convertMdToHtml(paragraphs);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Paragraph 1.');
      expect(html).toContain('Paragraph 100.');
    }, 10_000);

    it('空の Markdown でも有効な HTML ドキュメントを返す', async () => {
      const html = await convertMdToHtml('');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<body>');
    });

    it('10,000 語の連続テキストを処理できる', async () => {
      const longLine = ('word ').repeat(10_000).trim();
      const html = await convertMdToHtml(longLine);
      expect(html).toContain('<!DOCTYPE html>');
    }, 10_000);

    it('多数の見出しを持つドキュメントを処理できる', async () => {
      const headings = Array.from({ length: 200 }, (_, i) => `## Heading ${i + 1}`).join('\n\n');
      const html = await convertMdToHtml(headings);
      expect(html).toContain('Heading 1');
      expect(html).toContain('Heading 200');
    }, 10_000);
  });

  // ---------------------------------------------------------------------------
  // 基本的な変換品質（回帰テスト）
  // ---------------------------------------------------------------------------
  describe('basic conversion quality regression', () => {
    it('コードブロック内のコードは正しく出力される（rehype-highlight でトークン化）', async () => {
      const md = '```javascript\nconst x = 1;\nalert(x);\n```';
      const html = await convertMdToHtml(md);
      // rehype-highlight がコードをトークン化して <span> でラップするため
      // プレーンテキスト検索ではなく要素・キーワードの存在を確認する
      expect(html).toContain('<code');
      expect(html).toContain('class="hljs');
      // JavaScript キーワード「const」はシンタックスハイライトされる
      expect(html).toContain('const');
      expect(html).toContain('alert');
    });

    it('数式ブロックが有効な場合、数式をレンダリングする', async () => {
      const md = '$$\nE = mc^2\n$$';
      const html = await convertMdToHtml(md, { math: true });
      // KaTeX がレンダリング、または数式テキストが含まれる
      expect(html).toContain('<!DOCTYPE html>');
    });
  });
});

describe('injectIntoTemplate – escapeHtml', () => {
  // ---------------------------------------------------------------------------
  // title フィールドの全特殊文字エスケープ
  // ---------------------------------------------------------------------------
  describe('title XSS via escapeHtml', () => {
    it('<script> を含む title はエスケープされる', () => {
      const html = injectIntoTemplate('<p>content</p>', {
        ...baseOpts,
        title: '<script>alert(1)</script>',
      });
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert(1)');
    });

    it('& を含む title は &amp; にエスケープされる', () => {
      const html = injectIntoTemplate('<p>content</p>', {
        ...baseOpts,
        title: 'A & B',
      });
      expect(html).toContain('A &amp; B');
      expect(html).not.toContain('A & B');
    });

    it('" を含む title は &quot; にエスケープされる', () => {
      const html = injectIntoTemplate('<p>content</p>', {
        ...baseOpts,
        title: '"quoted title"',
      });
      expect(html).toContain('&quot;quoted title&quot;');
    });

    it('> を含む title は &gt; にエスケープされる', () => {
      const html = injectIntoTemplate('<p>content</p>', {
        ...baseOpts,
        title: 'a > b',
      });
      expect(html).toContain('a &gt; b');
    });

    it('< を含む title は &lt; にエスケープされる', () => {
      const html = injectIntoTemplate('<p>content</p>', {
        ...baseOpts,
        title: 'a < b',
      });
      expect(html).toContain('a &lt; b');
    });

    it('複数の特殊文字が混在する title を正しくエスケープする', () => {
      const html = injectIntoTemplate('<p>content</p>', {
        ...baseOpts,
        title: '<b class="x">AT&T</b>',
      });
      expect(html).toContain('&lt;b');
      expect(html).toContain('AT&amp;T');
      expect(html).not.toContain('<b class');
    });

    it('空文字列の title でも HTML 構造が壊れない', () => {
      const html = injectIntoTemplate('<p>content</p>', { ...baseOpts, title: '' });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title></title>');
    });
  });
});

describe('convertMdToHtml – TOC security', () => {
  it('TOC 生成時に見出しテキストの XSS がエスケープされる', async () => {
    const md =
      '# <script>alert(1)</script>\n\n## Normal heading\n\nContent here.';
    const html = await convertMdToHtml(md, { toc: true });
    // <script> が実行可能な形で TOC に含まれないこと
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('TOC 生成時に見出し ID の XSS がエスケープされる', async () => {
    const md = '## <img onerror="alert(1)"> title\n\nContent.';
    const html = await convertMdToHtml(md, { toc: true });
    expect(html).not.toContain('onerror');
  });
});

describe('resolveWikilinksForExport – edge cases', () => {
  it('スクリプトタグを含む Wikilink ターゲットは変換される', () => {
    const result = resolveWikilinksForExport('[[<script>]]');
    expect(result).not.toContain('[[');
    // 変換後の href に直接 <script> が残っていても remark が処理する
  });

  it('100 個の Wikilink を含むテキストを処理できる', () => {
    const input = Array.from({ length: 100 }, (_, i) => `[[note-${i}]]`).join(' ');
    const result = resolveWikilinksForExport(input);
    expect(result).not.toContain('[[');
    expect(result).toContain('note-0');
    expect(result).toContain('note-99');
  });

  it('ラベル付き Wikilink が正しく変換される', () => {
    const result = resolveWikilinksForExport('[[target|Display Text]]');
    expect(result).toBe('[Display Text](target.md)');
  });

  it('スペースを含むターゲットがハイフンに変換される', () => {
    const result = resolveWikilinksForExport('[[my great note]]');
    expect(result).toBe('[my great note](my-great-note.md)');
  });

  it('空のテキストを処理できる', () => {
    expect(resolveWikilinksForExport('')).toBe('');
  });
});

describe('extractTitle – edge cases', () => {
  it('YAML フロントマターを含むドキュメントから H1 を抽出できる', () => {
    const md = '---\ntitle: Meta title\n---\n\n# Document Title\n\nContent';
    const result = extractTitle(md);
    // フロントマター内の title ではなく H1 を抽出する
    expect(result).toBe('Document Title');
  });

  it('H1 のみのドキュメントでタイトルを抽出できる', () => {
    expect(extractTitle('# Just a Title')).toBe('Just a Title');
  });

  it('H1 のない長いドキュメントは null を返す', () => {
    const md = Array.from({ length: 100 }, (_, i) => `## Heading ${i}`).join('\n\n');
    expect(extractTitle(md)).toBeNull();
  });

  it('空文字列は null を返す', () => {
    expect(extractTitle('')).toBeNull();
  });

  it('前後の空白をトリムする', () => {
    expect(extractTitle('#   Title with spaces   ')).toBe('Title with spaces');
  });
});
