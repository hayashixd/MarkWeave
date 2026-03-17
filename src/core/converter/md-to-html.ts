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

// ---------------------------------------------------------------------------
// セキュリティ: 危険な URL スキームの除去
// ---------------------------------------------------------------------------

/** javascript: / vbscript: にマッチする正規表現（先頭の空白・null バイトを考慮） */
const DANGEROUS_URL_SCHEME = /^[\s\u0000]*(?:javascript|vbscript):/i;

/**
 * rehype プラグイン: hast ツリーを再帰的に走査し、
 * リンク・画像・フォームの href / src / action 属性から
 * javascript: / vbscript: スキームを除去する。
 *
 * remark-rehype の allowDangerousHtml:false は raw HTML ブロックの除去のみを
 * 行い、リンク href の URL スキームは検査しない。このプラグインでその欠を補う。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rehypeSanitizeUrls(): (tree: any) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function visit(node: any): void {
    if (node.type === 'element' && node.properties) {
      for (const attr of ['href', 'src', 'action', 'formAction']) {
        if (
          typeof node.properties[attr] === 'string' &&
          DANGEROUS_URL_SCHEME.test(node.properties[attr] as string)
        ) {
          delete node.properties[attr];
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }
  return visit;
}

/**
 * rehype-stringify 出力の属性値内に含まれる未エスケープの `<` / `>` を
 * `&lt;` / `&gt;` に変換する後処理。
 *
 * hast-util-to-html は HTML5 仕様に従い双引用符内の `<` `>` をエスケープしない。
 * XML 互換性と後段の文字列処理の安全のためにここで変換する。
 */
function encodeAngleBracketsInAttributes(html: string): string {
  // ="..." にマッチし、値内の < > を文字参照に置換する
  // 双引用符内の " は rehype-stringify が &quot; に変換済みのため
  // [^"]* は安全にマッチできる
  return html.replace(/="([^"]*)"/g, (_match, value: string) => {
    if (!value.includes('<') && !value.includes('>')) return _match;
    return '="' + value.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"';
  });
}

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
    .use(rehypeSanitizeUrls)  // javascript: / vbscript: を href/src から除去
    .use(rehypeSlug);

  if (opts.highlight) pipeline = pipeline.use(rehypeHighlight, { detect: true });
  if (opts.math) pipeline = pipeline.use(rehypeKatex);

  pipeline = pipeline.use(rehypeStringify);

  // Markdown → HTML コンテンツ変換
  const result = await pipeline.process(processedMarkdown);
  // 属性値内の未エスケープ < / > を後処理でエスケープ（XML互換性）
  const contentHtml = encodeAngleBracketsInAttributes(String(result));

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
  const highlightCss = options.highlight ? loadHighlightCss(options.theme) : '';
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
