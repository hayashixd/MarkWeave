/**
 * html-exporter.ts
 *
 * Markdown ドキュメントをスタイル付きスタンドアロン HTML としてエクスポートするモジュール。
 *
 * convertMdToHtml() を使って変換し、ファイルシステムへ書き出す。
 */

import { convertMdToHtml, type MdToHtmlOptions } from '../../core/converter/md-to-html';

export interface ExportResult {
  /** 書き出したファイルのパス */
  filePath: string;
  /** 書き出したファイルのサイズ（バイト） */
  sizeBytes: number;
}

/**
 * Markdown テキストを HTML ファイルとしてエクスポートする。
 *
 * @param markdown     - エクスポート対象の Markdown テキスト
 * @param outputPath   - 出力先ファイルパス（例: '/path/to/output.html'）
 * @param options      - 変換オプション（テーマ・数式・ハイライト等）
 * @returns エクスポート結果
 *
 * @example
 * const result = await exportToHtml(markdownText, '/docs/output.html', {
 *   theme: 'github',
 *   title: 'My Document',
 * });
 * console.log(`Exported: ${result.filePath} (${result.sizeBytes} bytes)`);
 */
export async function exportToHtml(
  markdown: string,
  outputPath: string,
  options: Partial<MdToHtmlOptions> = {}
): Promise<ExportResult> {
  const html = await convertMdToHtml(markdown, options);

  // TODO: File System Access API または Node.js fs を使ってファイルに書き出す
  // const encoder = new TextEncoder();
  // const data = encoder.encode(html);
  // const fileHandle = await window.showSaveFilePicker({ ... });
  // const writable = await fileHandle.createWritable();
  // await writable.write(data);
  // await writable.close();

  void html;
  void outputPath;
  throw new Error('exportToHtml: not implemented yet');
}

/**
 * エクスポートダイアログを表示して、ユーザーにオプションを選択させる。
 * 確定後に exportToHtml() を呼び出す。
 *
 * @param markdown   - エクスポート対象の Markdown テキスト
 * @param defaultTitle - デフォルトのドキュメントタイトル
 */
export async function showExportDialog(
  markdown: string,
  defaultTitle: string
): Promise<ExportResult | null> {
  // TODO: Reactモーダルを開いてオプションをUIで選択させる
  // 選択後に exportToHtml() を実行
  void markdown;
  void defaultTitle;
  return null;
}
