/**
 * HTML → Markdown 変換（スマートペースト用）。
 *
 * smart-paste-design.md §3 に準拠。
 *
 * パイプライン:
 * 1. DOMPurify でサニタイズ（XSS 防止）
 * 2. Turndown + GFM プラグインで HTML → Markdown 変換
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import DOMPurify from 'dompurify';

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

turndown.use(gfm);

// 数式 LaTeX の Turndown カスタムルール（smart-paste-design.md §7.1）
// ChatGPT / Claude などが <span class="math"> や <span class="katex"> で数式を出力する場合に対応
turndown.addRule('inlineMath', {
  filter: (node: HTMLElement) =>
    node.nodeName === 'SPAN' &&
    (node.classList.contains('math') || node.classList.contains('katex')),
  replacement: (content: string) => `$${content}$`,
});

// ブロック数式（div.math や div.katex）
turndown.addRule('blockMath', {
  filter: (node: HTMLElement) =>
    node.nodeName === 'DIV' &&
    (node.classList.contains('math') || node.classList.contains('katex')),
  replacement: (content: string) => `\n$$\n${content}\n$$\n`,
});

// 画像 data-URI の検出と変換（smart-paste-design.md §7.4）
// data:image/... の場合は Markdown 画像記法に変換
turndown.addRule('imgDataUri', {
  filter: (node: HTMLElement) =>
    node.nodeName === 'IMG' &&
    (node as HTMLImageElement).src?.startsWith('data:image/'),
  replacement: (_content: string, node: Node) => {
    const img = node as HTMLImageElement;
    const alt = img.alt || '';
    const src = img.src || '';
    return `![${alt}](${src})`;
  },
});

/** HTML 文字列を Markdown に変換する。XSS 防止のため DOMPurify でサニタイズ済み。 */
export function htmlToMarkdown(html: string): string {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return turndown.turndown(clean);
}
