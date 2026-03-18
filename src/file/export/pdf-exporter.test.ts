/**
 * pdf-exporter.ts のユニットテスト
 *
 * - defaultPdfOptions: 定数の構造検証
 * - exportToPdf: Tauri invoke と md-to-html をモックして動作検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  defaultPdfOptions,
  exportToPdf,
  type PdfExportOptions,
} from './pdf-exporter';

// ─── モック設定 ──────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('../../core/converter/md-to-html', () => ({
  convertMdToHtml: vi.fn().mockResolvedValue(
    '<html><head></head><body><p>test</p></body></html>'
  ),
  extractTitle: vi.fn().mockReturnValue('Test Title'),
}));

// ─── defaultPdfOptions ───────────────────────────────────────────────────────

describe('defaultPdfOptions', () => {
  it('theme が github である', () => {
    expect(defaultPdfOptions.theme).toBe('github');
  });

  it('paperSize が A4 である', () => {
    expect(defaultPdfOptions.paperSize).toBe('A4');
  });

  it('orientation が portrait である', () => {
    expect(defaultPdfOptions.orientation).toBe('portrait');
  });

  it('marginMm が正しいデフォルト値を持つ', () => {
    expect(defaultPdfOptions.marginMm).toEqual({
      top: 20,
      bottom: 20,
      left: 25,
      right: 25,
    });
  });

  it('printHeaderFooter が false である', () => {
    expect(defaultPdfOptions.printHeaderFooter).toBe(false);
  });

  it('includeToc が false である', () => {
    expect(defaultPdfOptions.includeToc).toBe(false);
  });

  it('renderMath が true である', () => {
    expect(defaultPdfOptions.renderMath).toBe(true);
  });

  it('highlight が true である', () => {
    expect(defaultPdfOptions.highlight).toBe(true);
  });

  it('すべての必須フィールドが存在する', () => {
    const keys: (keyof PdfExportOptions)[] = [
      'theme',
      'paperSize',
      'orientation',
      'marginMm',
      'printHeaderFooter',
      'includeToc',
      'renderMath',
      'highlight',
    ];
    for (const key of keys) {
      expect(defaultPdfOptions).toHaveProperty(key);
    }
  });
});

// ─── exportToPdf ─────────────────────────────────────────────────────────────

describe('exportToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(1024); // sizeBytes
  });

  it('invoke("print_to_pdf") を呼び出す', async () => {
    await exportToPdf('# Hello', '/tmp/test.pdf');
    expect(mockInvoke).toHaveBeenCalledWith(
      'print_to_pdf',
      expect.objectContaining({
        outputPath: '/tmp/test.pdf',
      })
    );
  });

  it('filePath と sizeBytes を返す', async () => {
    const result = await exportToPdf('# Hello', '/tmp/output.pdf');
    expect(result.filePath).toBe('/tmp/output.pdf');
    expect(result.sizeBytes).toBe(1024);
  });

  it('デフォルトオプションが invoke に渡される', async () => {
    await exportToPdf('# Hello', '/tmp/test.pdf');
    expect(mockInvoke).toHaveBeenCalledWith(
      'print_to_pdf',
      expect.objectContaining({
        options: expect.objectContaining({
          paperSize: 'A4',
          orientation: 'portrait',
          marginTop: 20,
          marginBottom: 20,
          marginLeft: 25,
          marginRight: 25,
          printHeaderFooter: false,
        }),
      })
    );
  });

  it('カスタムオプションがデフォルトを上書きする', async () => {
    await exportToPdf('# Hello', '/tmp/test.pdf', {
      paperSize: 'Letter',
      orientation: 'landscape',
      printHeaderFooter: true,
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      'print_to_pdf',
      expect.objectContaining({
        options: expect.objectContaining({
          paperSize: 'Letter',
          orientation: 'landscape',
          printHeaderFooter: true,
        }),
      })
    );
  });

  it('marginMm をカスタマイズできる', async () => {
    await exportToPdf('# Hello', '/tmp/test.pdf', {
      marginMm: { top: 10, bottom: 10, left: 15, right: 15 },
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      'print_to_pdf',
      expect.objectContaining({
        options: expect.objectContaining({
          marginTop: 10,
          marginBottom: 10,
          marginLeft: 15,
          marginRight: 15,
        }),
      })
    );
  });

  it('invoke が失敗した場合は例外をスローする', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri error'));
    await expect(exportToPdf('# Hello', '/tmp/test.pdf')).rejects.toThrow('Tauri error');
  });

  it('htmlContent に印刷用 CSS が注入される', async () => {
    const { convertMdToHtml } = await import('../../core/converter/md-to-html');
    vi.mocked(convertMdToHtml).mockResolvedValueOnce(
      '<html><head></head><body><p>test</p></body></html>'
    );
    await exportToPdf('# Hello', '/tmp/test.pdf');
    const call = mockInvoke.mock.calls[0];
    const htmlContent = (call[1] as { htmlContent: string }).htmlContent;
    // print.css が </head> の前に注入されているはず
    expect(htmlContent).toContain('<style>');
    expect(htmlContent).toContain('</head>');
  });
});
