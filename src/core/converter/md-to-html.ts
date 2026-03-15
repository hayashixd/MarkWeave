/**
 * md-to-html.ts
 *
 * Markdown テキストをスタイル付き HTML に変換する変換パイプライン。
 * export-interop-design.md §2 に準拠。
 *
 * パイプライン:
 *   Markdown文字列
 *     → remark-parse（mdast）
 *     → remark-gfm（GFM テーブル・取り消し線等）
 *     → remark-math（数式ブロック）
 *     → remark-rehype（hast）
 *     → rehype-slug（見出しに id 付与）
 *     → rehype-highlight（シンタックスハイライト）
 *     → rehype-katex（数式レンダリング）
 *     → rehype-stringify（HTML文字列）
 *     → HTMLテンプレートへ注入
 *     → juice（CSSインライン化）
 *     → スタンドアロンHTML
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import juice from 'juice';
import { type ExportTheme, loadThemeCss, loadHighlightCss, loadKatexCss } from './theme-loader';

export interface MdToHtmlOptions {
  /** エクスポート用テーマ名 */
  theme: ExportTheme;
  /** シンタックスハイライトを有効にするか */
  highlight: boolean;
  /** 数式レンダリングを有効にするか */
  math: boolean;
  /** 目次（TOC）を自動生成するか */
  toc: boolean;
  /** CSSをインライン化するか（スタンドアロンHTML向け） */
  inlineCss: boolean;
  /** ドキュメントタイトル */
  title: string;
}

const defaultOptions: MdToHtmlOptions = {
  theme: 'github',
  highlight: true,
  math: true,
  toc: false,
  inlineCss: true,
  title: 'Document',
};

/**
 * Markdown テキストをスタンドアロン HTML 文字列に変換する。
 *
 * @param markdown - 入力 Markdown テキスト
 * @param options  - 変換オプション
 * @returns スタンドアロン HTML 文字列
 *
 * @example
 * const html = await convertMdToHtml('# Hello\n\nWorld', { title: 'Hello' });
 */
/**
 * Wikiリンク記法 [[target]] / [[target|label]] を通常の Markdown リンクに変換する。
 * エクスポート時にリンクを保持するための前処理。
 * Phase 7.5: エクスポート時の Wikiリンク → 通常リンク変換
 */
export function resolveWikilinksForExport(markdown: string): string {
  // [[target|label]] → [label](target.md)
  // [[target]]       → [target](target.md)
  return markdown.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, target: string, label?: string) => {
    const slug = target.trim().replace(/\s+/g, '-');
    const display = label?.trim() ?? target.trim();
    return `[${display}](${slug}.md)`;
  });
}

export async function convertMdToHtml(
  markdown: string,
  options: Partial<MdToHtmlOptions> = {}
): Promise<string> {
  const opts = { ...defaultOptions, ...options };

  // Wikiリンクを通常リンクに変換してからパイプラインに渡す (Phase 7.5)
  const processedMarkdown = resolveWikilinksForExport(markdown);

  // unified パイプラインを構築
  // 注: unified の型は .use() チェーンごとに型パラメータが変化するため、
  // 条件付きプラグイン適用では any 経由の再代入が標準パターン。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pipeline: any = unified()
    .use(remarkParse)
    .use(remarkGfm);

  if (opts.math) pipeline = pipeline.use(remarkMath);

  pipeline = pipeline
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug);

  if (opts.highlight) pipeline = pipeline.use(rehypeHighlight, { detect: true });
  if (opts.math) pipeline = pipeline.use(rehypeKatex);

  pipeline = pipeline.use(rehypeStringify);

  // Markdown → HTML コンテンツ変換
  const result = await pipeline.process(processedMarkdown);
  const contentHtml = String(result);

  // HTML テンプレートに注入
  const fullHtml = injectIntoTemplate(contentHtml, opts);

  // CSS インライン化
  if (opts.inlineCss) {
    return juice(fullHtml);
  }

  return fullHtml;
}

/**
 * Markdown テキストから H1 見出しテキストを抽出してタイトルとして返す。
 */
export function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

/**
 * HTML コンテンツをテンプレートに注入してスタンドアロン HTML を構築する。
 * export-interop-design.md §2.2 に準拠。
 */
export function injectIntoTemplate(
  content: string,
  options: MdToHtmlOptions
): string {
  const themeCss = loadThemeCss(options.theme);
  const highlightCss = options.highlight ? loadHighlightCss() : '';
  const katexCss = options.math ? loadKatexCss() : '';

  // TOC 生成
  const tocHtml = options.toc ? generateToc(content) : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  <style>${themeCss}</style>
${highlightCss ? `  <style>${highlightCss}</style>\n` : ''}${katexCss ? `  <style>${katexCss}</style>\n` : ''}</head>
<body>
${tocHtml ? `  <nav class="toc">${tocHtml}</nav>\n` : ''}  <main class="markdown-body">
${content}
  </main>
</body>
</html>`;
}

/**
 * HTML コンテンツ内の見出し（h1〜h6）から目次を生成する。
 */
function generateToc(html: string): string {
  const headingRegex = /<h([1-6])\s+id="([^"]*)"[^>]*>(.*?)<\/h[1-6]>/gi;
  const entries: { level: number; id: string; text: string }[] = [];

  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    entries.push({
      level: parseInt(match[1] ?? '1'),
      id: match[2] ?? '',
      text: (match[3] ?? '').replace(/<[^>]+>/g, ''),
    });
  }

  if (entries.length === 0) return '';

  const minLevel = Math.min(...entries.map((e) => e.level));

  let tocHtml = '<ol>\n';
  for (const entry of entries) {
    const indent = '  '.repeat(entry.level - minLevel + 1);
    tocHtml += `${indent}<li><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>\n`;
  }
  tocHtml += '</ol>';

  return tocHtml;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
