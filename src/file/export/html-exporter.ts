/**
 * html-exporter.ts
 *
 * Markdown ドキュメントをスタイル付きスタンドアロン HTML としてエクスポートするモジュール。
 * export-interop-design.md §2 に準拠。
 *
 * convertMdToHtml() を使って変換し、Tauri plugin-fs でファイルシステムへ書き出す。
 */

import { convertMdToHtml, extractTitle, type MdToHtmlOptions } from '../../core/converter/md-to-html';

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
 */
export async function exportToHtml(
  markdown: string,
  outputPath: string,
  options: Partial<MdToHtmlOptions> = {}
): Promise<ExportResult> {
  // options を変異させないようコピーして title を補完
  const opts: Partial<MdToHtmlOptions> = {
    ...options,
    title: options.title || extractTitle(markdown) || 'Document',
  };

  const html = await convertMdToHtml(markdown, opts);
  const sizeBytes = new TextEncoder().encode(html).byteLength;

  // Tauri plugin-fs でファイルに書き出し
  let tauriAvailable = false;
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    tauriAvailable = true;
    await writeTextFile(outputPath, html);
  } catch (err) {
    if (tauriAvailable) {
      // Tauri は利用可能だがファイル書き込みに失敗 → エラーを伝搬
      throw err;
    }
    // Tauri 外（テスト・ブラウザ開発）ではダウンロードにフォールバック
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputPath.split('/').pop() ?? 'export.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  return { filePath: outputPath, sizeBytes };
}
