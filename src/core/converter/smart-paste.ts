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

/** HTML 文字列を Markdown に変換する。XSS 防止のため DOMPurify でサニタイズ済み。 */
export function htmlToMarkdown(html: string): string {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return turndown.turndown(clean);
}
