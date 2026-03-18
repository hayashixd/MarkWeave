/**
 * html-parser.ts / html-serializer.ts のユニットテスト
 *
 * parseHtml → extractMetadata → serializeHtml のパイプラインを検証する。
 */
import { describe, it, expect } from 'vitest';
import { parseHtml, extractMetadata } from './html-parser';
import { serializeHtml } from './html-serializer';

// ─── parseHtml ──────────────────────────────────────────────────────────────

describe('parseHtml', () => {
  it('有効な HTML をパースして Root ノードを返す', () => {
    const ast = parseHtml('<p>Hello</p>');
    expect(ast).toBeDefined();
    expect(ast.type).toBe('root');
    expect(Array.isArray(ast.children)).toBe(true);
  });

  it('完全な HTML ドキュメントをパースする', () => {
    const html = `<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body><p>Content</p></body>
</html>`;
    const ast = parseHtml(html);
    expect(ast.type).toBe('root');
    expect(ast.children.length).toBeGreaterThan(0);
  });

  it('空文字列でも Root ノードを返す', () => {
    const ast = parseHtml('');
    expect(ast.type).toBe('root');
  });

  it('不正な HTML でもクラッシュしない', () => {
    expect(() => parseHtml('<div><p>unclosed')).not.toThrow();
    expect(() => parseHtml('<<invalid>>')).not.toThrow();
  });

  it('オプション省略でも動作する', () => {
    const ast = parseHtml('<h1>Title</h1>');
    expect(ast.type).toBe('root');
  });

  it('空オプションオブジェクトでも動作する', () => {
    const ast = parseHtml('<h1>Title</h1>', {});
    expect(ast.type).toBe('root');
  });
});

// ─── extractMetadata ────────────────────────────────────────────────────────

describe('extractMetadata', () => {
  it('<title> を抽出する', () => {
    const ast = parseHtml(`
      <html>
        <head><title>My Document</title></head>
        <body></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.title).toBe('My Document');
  });

  it('<meta name="description"> を抽出する', () => {
    const ast = parseHtml(`
      <html>
        <head>
          <meta name="description" content="A test page" />
        </head>
        <body></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.description).toBe('A test page');
  });

  it('スタイルシートリンクを抽出する', () => {
    const ast = parseHtml(`
      <html>
        <head>
          <link rel="stylesheet" href="style.css" />
          <link rel="stylesheet" href="theme.css" />
        </head>
        <body></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.cssLinks).toContain('style.css');
    expect(meta.cssLinks).toContain('theme.css');
    expect(meta.cssLinks).toHaveLength(2);
  });

  it('<script src> を抽出する', () => {
    const ast = parseHtml(`
      <html>
        <head>
          <script src="app.js"></script>
          <script src="utils.js"></script>
        </head>
        <body></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.jsLinks).toContain('app.js');
    expect(meta.jsLinks).toContain('utils.js');
    expect(meta.jsLinks).toHaveLength(2);
  });

  it('rel="stylesheet" 以外の <link> は cssLinks に含めない', () => {
    const ast = parseHtml(`
      <html>
        <head>
          <link rel="icon" href="favicon.ico" />
          <link rel="stylesheet" href="style.css" />
        </head>
        <body></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.cssLinks).toHaveLength(1);
    expect(meta.cssLinks[0]).toBe('style.css');
  });

  it('src のない <script> は jsLinks に含めない', () => {
    const ast = parseHtml(`
      <html>
        <head>
          <script>console.log('inline');</script>
          <script src="external.js"></script>
        </head>
        <body></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.jsLinks).toHaveLength(1);
    expect(meta.jsLinks[0]).toBe('external.js');
  });

  it('<head> のない HTML では空のメタデータを返す', () => {
    const ast = parseHtml('<p>No head element</p>');
    // rehype-parse はデフォルトで html/head/body を補完するが、
    // title・meta・link がなければ空のまま
    const meta = extractMetadata(ast);
    expect(meta.title).toBe('');
    expect(meta.description).toBe('');
    expect(meta.cssLinks).toEqual([]);
    expect(meta.jsLinks).toEqual([]);
  });

  it('すべてのフィールドが揃った HTML を正しく解析する', () => {
    const ast = parseHtml(`
      <html>
        <head>
          <title>Full Page</title>
          <meta name="description" content="Full description" />
          <link rel="stylesheet" href="main.css" />
          <script src="bundle.js"></script>
        </head>
        <body><p>body</p></body>
      </html>
    `);
    const meta = extractMetadata(ast);
    expect(meta.title).toBe('Full Page');
    expect(meta.description).toBe('Full description');
    expect(meta.cssLinks).toEqual(['main.css']);
    expect(meta.jsLinks).toEqual(['bundle.js']);
  });
});

// ─── serializeHtml ──────────────────────────────────────────────────────────

describe('serializeHtml', () => {
  it('parseHtml の出力を文字列に戻す', () => {
    const html = '<p>Hello World</p>';
    const ast = parseHtml(html);
    const result = serializeHtml(ast);
    expect(typeof result).toBe('string');
    expect(result).toContain('Hello World');
  });

  it('roundtrip: parse → serialize で内容が保存される', () => {
    const html = '<h1>Title</h1><p>Paragraph text here.</p>';
    const ast = parseHtml(html);
    const result = serializeHtml(ast);
    expect(result).toContain('Title');
    expect(result).toContain('Paragraph text here.');
  });

  it('空のASTを文字列にシリアライズできる', () => {
    const ast = parseHtml('');
    expect(() => serializeHtml(ast)).not.toThrow();
  });

  it('オプション省略でデフォルト値が使われる', () => {
    const ast = parseHtml('<p>test</p>');
    const result = serializeHtml(ast);
    expect(typeof result).toBe('string');
  });

  it('selfClosing オプションが有効な場合は自己閉じタグを使う', () => {
    const ast = parseHtml('<br>');
    const withSelfClose = serializeHtml(ast, { selfClosing: true });
    const withoutSelfClose = serializeHtml(ast, { selfClosing: false });
    expect(withSelfClose).toContain('/>');
    expect(withoutSelfClose).not.toContain('/>');
  });

  it('メタデータを含む HTML の roundtrip', () => {
    const html = `<html><head><title>Test Title</title></head><body><p>body</p></body></html>`;
    const ast = parseHtml(html);
    const result = serializeHtml(ast);
    expect(result).toContain('Test Title');
    expect(result).toContain('body');
  });
});
