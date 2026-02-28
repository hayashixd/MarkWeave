/**
 * theme-loader.ts
 *
 * エクスポート用テーマ CSS / ハイライト CSS / KaTeX CSS をロードするユーティリティ。
 * export-interop-design.md §2.2, §5 に準拠。
 *
 * Vite の `?raw` インポートを使用して CSS を文字列として取得する。
 */

import githubThemeCss from '../../themes/default/html-export.css?raw';
import documentThemeCss from '../../themes/document/html-export.css?raw';
import highlightCss from 'highlight.js/styles/github.css?raw';
import katexCss from 'katex/dist/katex.min.css?raw';

export type ExportTheme = 'github' | 'document';

const themeCssMap: Record<ExportTheme, string> = {
  github: githubThemeCss,
  document: documentThemeCss,
};

/**
 * 指定テーマのエクスポート用 CSS 文字列を返す。
 */
export function loadThemeCss(theme: ExportTheme): string {
  return themeCssMap[theme] ?? themeCssMap.github;
}

/**
 * コードブロック用シンタックスハイライト CSS 文字列を返す。
 */
export function loadHighlightCss(): string {
  return highlightCss;
}

/**
 * KaTeX 数式レンダリング用 CSS 文字列を返す。
 */
export function loadKatexCss(): string {
  return katexCss;
}
