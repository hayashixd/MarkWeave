/**
 * DOMPurify 共通設定（セキュリティ設計書 §1.2, §1.3 準拠）
 *
 * すべての dangerouslySetInnerHTML / innerHTML 使用箇所で
 * この設定を経由してサニタイズすること。
 *
 * 新しい TipTap カスタムノード追加時は ADD_TAGS / ADD_ATTR を更新すること。
 */

import DOMPurify, { type Config } from 'dompurify';

/** HTML プレビュー・カスタムノード共通の DOMPurify 設定 */
export const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    // 基本 HTML タグ
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'del', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img',
    'div', 'span', 'section', 'article', 'header', 'footer',
    'details', 'summary',
    'figure', 'figcaption',
    'sup', 'sub', 'mark',
  ],
  // TipTap カスタムノード向け追加タグ
  ADD_TAGS: [
    // KaTeX / MathML
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn',
    'mfrac', 'msup', 'msub', 'msubsup', 'msqrt', 'mroot',
    'mtext', 'mspace', 'mtable', 'mtr', 'mtd', 'mover', 'munder',
    'annotation', 'annotation-xml',
    // Mermaid SVG
    'svg', 'path', 'g', 'rect', 'text', 'circle', 'ellipse',
    'line', 'polyline', 'polygon', 'use', 'defs', 'marker',
    'linearGradient', 'stop', 'clipPath', 'mask',
    // HTML プレビュー用
    'style',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'width', 'height', 'align', 'colspan', 'rowspan',
    'data-*', 'target', 'rel', 'type', 'start', 'checked', 'disabled',
  ],
  // TipTap カスタムノード向け追加属性
  ADD_ATTR: [
    // MathML 属性
    'mathvariant', 'mathsize', 'mathcolor', 'mathbackground',
    'display', 'fence', 'form', 'stretchy', 'largeop', 'xmlns',
    // SVG 属性
    'viewBox', 'd', 'fill', 'stroke', 'stroke-width',
    'transform', 'cx', 'cy', 'rx', 'ry', 'x', 'y',
    'x1', 'y1', 'x2', 'y2', 'points', 'marker-end',
    'refX', 'refY', 'orient', 'markerWidth', 'markerHeight',
    'clip-path', 'opacity', 'font-size', 'text-anchor',
    'preserveAspectRatio',
    // a11y / カスタムコンテナ
    'aria-label', 'aria-hidden', 'role',
    'tabindex', 'contenteditable',
  ],
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe'],
  FORCE_BODY: true,
  USE_PROFILES: { html: true, svg: true, mathMl: true },
};

/**
 * Mermaid SVG 出力用の厳格な設定（foreignObject を許可しない）
 * security-design.md §1.3 Mermaid 特別扱い
 */
export const MERMAID_DOMPURIFY_CONFIG: Config = {
  ...DOMPURIFY_CONFIG,
  FORBID_TAGS: [...(DOMPURIFY_CONFIG.FORBID_TAGS as string[]), 'foreignObject'],
};

/** サニタイズ済み HTML を返す（汎用ヘルパー） */
export function sanitizeHtml(rawHtml: string, config = DOMPURIFY_CONFIG): string {
  return DOMPurify.sanitize(rawHtml, config);
}

/** Mermaid SVG 出力を安全にサニタイズする */
export function sanitizeMermaidSvg(svgHtml: string): string {
  return DOMPurify.sanitize(svgHtml, MERMAID_DOMPURIFY_CONFIG);
}

/** ペーストされた HTML のサイズ上限（5MB） */
export const MAX_PASTE_HTML_BYTES = 5 * 1024 * 1024;

/** data URI 画像のサイズ上限（10MB） */
export const MAX_DATA_URI_BYTES = 10 * 1024 * 1024;
