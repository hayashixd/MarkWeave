/**
 * pdf-exporter.ts
 *
 * Markdown ドキュメントを PDF ファイルとしてエクスポートするモジュール。
 * export-interop-design.md §3 に準拠。
 *
 * HTML エクスポートと同じ変換パイプラインを通した後、
 * Tauri の WebView 印刷 API（print_to_pdf コマンド）で PDF を生成する。
 */

import { convertMdToHtml, extractTitle, type MdToHtmlOptions } from '../../core/converter/md-to-html';
import printCss from '../../themes/print.css?raw';

export interface PdfExportOptions {
  /** エクスポート用テーマ名 */
  theme: MdToHtmlOptions['theme'];
  /** 用紙サイズ */
  paperSize: 'A4' | 'Letter' | 'A3';
  /** 印刷方向 */
  orientation: 'portrait' | 'landscape';
  /** 余白（mm 単位） */
  marginMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** ヘッダー/フッターを印刷するか */
  printHeaderFooter: boolean;
  /** 目次を生成するか */
  includeToc: boolean;
  /** 数式をレンダリングするか */
  renderMath: boolean;
  /** コードのシンタックスハイライト */
  highlight: boolean;
}

export const defaultPdfOptions: PdfExportOptions = {
  theme: 'github',
  paperSize: 'A4',
  orientation: 'portrait',
  marginMm: { top: 20, bottom: 20, left: 25, right: 25 },
  printHeaderFooter: false,
  includeToc: false,
  renderMath: true,
  highlight: true,
};

export interface PdfExportResult {
  filePath: string;
  sizeBytes: number;
}

/**
 * Markdown テキストを PDF ファイルとしてエクスポートする。
 *
 * @param markdown     - エクスポート対象の Markdown テキスト
 * @param outputPath   - 出力先ファイルパス（例: '/path/to/output.pdf'）
 * @param options      - PDF エクスポートオプション
 * @returns エクスポート結果
 */
export async function exportToPdf(
  markdown: string,
  outputPath: string,
  options: Partial<PdfExportOptions> = {},
): Promise<PdfExportResult> {
  const opts = { ...defaultPdfOptions, ...options };

  const title = extractTitle(markdown) || 'Document';

  // HTML 変換パイプラインを通す（CSS インライン化あり）
  const htmlContent = await convertMdToHtml(markdown, {
    theme: opts.theme,
    highlight: opts.highlight,
    math: opts.renderMath,
    toc: opts.includeToc,
    inlineCss: true,
    title,
  });

  // 印刷用 CSS を注入（</head> の直前に挿入）
  const htmlWithPrintCss = htmlContent.replace(
    '</head>',
    `  <style>${printCss}</style>\n</head>`,
  );

  // Tauri の print_to_pdf コマンドを呼び出す
  const { invoke } = await import('@tauri-apps/api/core');
  const sizeBytes = await invoke<number>('print_to_pdf', {
    htmlContent: htmlWithPrintCss,
    outputPath,
    options: {
      paperSize: opts.paperSize,
      orientation: opts.orientation,
      marginTop: opts.marginMm.top,
      marginBottom: opts.marginMm.bottom,
      marginLeft: opts.marginMm.left,
      marginRight: opts.marginMm.right,
      printHeaderFooter: opts.printHeaderFooter,
    },
  });

  return { filePath: outputPath, sizeBytes };
}
