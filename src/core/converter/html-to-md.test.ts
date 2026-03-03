/**
 * html-to-md.ts のユニットテスト。
 * HTML → Markdown 変換の正確性と変換ロス検出の網羅性を検証する。
 */

import { describe, it, expect } from 'vitest';
import { convertHtmlToMd, detectLoss } from './html-to-md';

describe('convertHtmlToMd', () => {
  it('基本的なHTML要素をMarkdownに変換する', () => {
    const html = '<h1>見出し</h1><p>段落テキスト</p>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('# 見出し');
    expect(result.markdown).toContain('段落テキスト');
  });

  it('太字・斜体を変換する', () => {
    const html = '<p><strong>太字</strong>と<em>斜体</em></p>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('**太字**');
    expect(result.markdown).toContain('*斜体*');
  });

  it('リンクを変換する', () => {
    const html = '<a href="https://example.com">リンク</a>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('[リンク](https://example.com)');
  });

  it('画像を変換する', () => {
    const html = '<img src="image.png" alt="画像の説明">';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('![画像の説明](image.png)');
  });

  it('リストを変換する', () => {
    const html = '<ul><li>アイテム1</li><li>アイテム2</li></ul>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toMatch(/-\s+アイテム1/);
    expect(result.markdown).toMatch(/-\s+アイテム2/);
  });

  it('引用を変換する', () => {
    const html = '<blockquote><p>引用テキスト</p></blockquote>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('> 引用テキスト');
  });

  it('水平線を変換する', () => {
    const html = '<hr>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('---');
  });

  it('<mark>を拡張記法に変換する', () => {
    const html = '<mark>ハイライト</mark>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('==ハイライト==');
  });

  it('<sup>/<sub>を拡張記法に変換する', () => {
    const html = '<sup>上付き</sup><sub>下付き</sub>';
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('^上付き^');
    expect(result.markdown).toContain('~下付き~');
  });

  it('完全なHTMLドキュメントからbodyの中身のみ変換する', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>テスト</title><style>body { color: red; }</style></head>
<body>
<h1>タイトル</h1>
<p>本文</p>
</body>
</html>`;
    const result = convertHtmlToMd(html);
    expect(result.markdown).toContain('# タイトル');
    expect(result.markdown).toContain('本文');
    // head の内容は含まれない
    expect(result.markdown).not.toContain('<title>');
  });

  it('オプションでheadingStyleをsetextに設定できる', () => {
    const html = '<h1>見出し</h1>';
    const result = convertHtmlToMd(html, { headingStyle: 'setext' });
    expect(result.markdown).toContain('見出し');
    expect(result.markdown).toContain('===');
  });

  it('オプションでbulletListMarkerを変更できる', () => {
    const html = '<ul><li>アイテム</li></ul>';
    const result = convertHtmlToMd(html, { bulletListMarker: '*' });
    expect(result.markdown).toMatch(/\*\s+アイテム/);
  });
});

describe('detectLoss', () => {
  it('インラインスタイルを検出する', () => {
    const html = '<p style="color: red">赤いテキスト</p><span style="font-size: 20px">大きい</span>';
    const warnings = detectLoss(html);
    const styleWarning = warnings.find((w) => w.type === 'inline-style');
    expect(styleWarning).toBeDefined();
    expect(styleWarning!.count).toBe(2);
  });

  it('カスタムクラスを検出する（math/katexは除外）', () => {
    const html = '<div class="container">内容</div><span class="math">数式</span>';
    const warnings = detectLoss(html);
    const classWarning = warnings.find((w) => w.type === 'custom-class');
    expect(classWarning).toBeDefined();
    expect(classWarning!.count).toBe(1); // math は除外される
  });

  it('div構造を検出する', () => {
    const html = '<div><div>ネスト</div></div>';
    const warnings = detectLoss(html);
    const divWarning = warnings.find((w) => w.type === 'div-structure');
    expect(divWarning).toBeDefined();
    expect(divWarning!.count).toBe(2);
  });

  it('セマンティック要素を検出する', () => {
    const html = '<section>内容</section><article>記事</article>';
    const warnings = detectLoss(html);
    const semWarning = warnings.find((w) => w.type === 'semantic-element');
    expect(semWarning).toBeDefined();
    expect(semWarning!.count).toBe(2);
  });

  it('テーブルのセル結合を検出する', () => {
    const html = '<table><tr><td colspan="2">結合セル</td></tr></table>';
    const warnings = detectLoss(html);
    const mergeWarning = warnings.find((w) => w.type === 'cell-merge');
    expect(mergeWarning).toBeDefined();
    expect(mergeWarning!.count).toBe(1);
  });

  it('SVGを検出する', () => {
    const html = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
    const warnings = detectLoss(html);
    const svgWarning = warnings.find((w) => w.type === 'svg');
    expect(svgWarning).toBeDefined();
  });

  it('iframeを検出する', () => {
    const html = '<iframe src="https://example.com"></iframe>';
    const warnings = detectLoss(html);
    const iframeWarning = warnings.find((w) => w.type === 'iframe');
    expect(iframeWarning).toBeDefined();
  });

  it('scriptタグを検出する', () => {
    const html = '<script>alert("test")</script>';
    const warnings = detectLoss(html);
    const scriptWarning = warnings.find((w) => w.type === 'script');
    expect(scriptWarning).toBeDefined();
  });

  it('styleタグを検出する', () => {
    const html = '<style>body { color: red; }</style>';
    const warnings = detectLoss(html);
    const styleWarning = warnings.find((w) => w.type === 'style-tag');
    expect(styleWarning).toBeDefined();
  });

  it('video/audioを検出する', () => {
    const html = '<video src="video.mp4"></video><audio src="audio.mp3"></audio>';
    const warnings = detectLoss(html);
    const mediaWarning = warnings.find((w) => w.type === 'video-audio');
    expect(mediaWarning).toBeDefined();
    expect(mediaWarning!.count).toBe(2);
  });

  it('details/summaryを検出する', () => {
    const html = '<details><summary>見出し</summary>内容</details>';
    const warnings = detectLoss(html);
    const detailsWarning = warnings.find((w) => w.type === 'details-summary');
    expect(detailsWarning).toBeDefined();
  });

  it('ロスのないシンプルなHTMLでは警告が空', () => {
    const html = '<h1>見出し</h1><p>段落</p><ul><li>リスト</li></ul>';
    const warnings = detectLoss(html);
    expect(warnings).toHaveLength(0);
  });
});
