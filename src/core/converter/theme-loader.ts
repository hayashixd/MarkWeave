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
import presentationThemeCss from '../../themes/presentation/html-export.css?raw';
import highlightCss from 'highlight.js/styles/github.css?raw';
import katexCss from 'katex/dist/katex.min.css?raw';

export type ExportTheme = 'github' | 'document' | 'presentation';

/** テーマのメタデータ。ダイアログでの選択支援に使用。 */
export interface ThemeInfo {
  id: ExportTheme;
  label: string;
  description: string;
  /** テーマの代表的なアクセントカラー（プレビュー表示用） */
  accentColor: string;
  /** テーマの見出しカラー */
  headingColor: string;
  /** テーマの本文フォント種別 */
  fontHint: string;
}

const themeCssMap: Record<ExportTheme, string> = {
  github: githubThemeCss,
  document: documentThemeCss,
  presentation: presentationThemeCss,
};

/** テーマ一覧（メタデータ付き）。ExportDialog のテーマ選択で使用する。 */
export const themeList: ThemeInfo[] = [
  {
    id: 'github',
    label: 'GitHub スタイル（デフォルト）',
    description: '技術文書・README 向け。Sans-serif、コンパクトな 800px 幅。',
    accentColor: '#0969da',
    headingColor: '#1f2328',
    fontHint: 'Sans-serif',
  },
  {
    id: 'document',
    label: 'ドキュメントスタイル（書籍風）',
    description: '長文・報告書向け。明朝体、均等揃え、落ち着いた配色。',
    accentColor: '#2980b9',
    headingColor: '#2c3e50',
    fontHint: 'Serif',
  },
  {
    id: 'presentation',
    label: 'プレゼンテーションスタイル',
    description: '発表・画面共有向け。大フォント、高コントラスト、960px 幅。',
    accentColor: '#e94560',
    headingColor: '#16213e',
    fontHint: 'Sans-serif',
  },
];

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
