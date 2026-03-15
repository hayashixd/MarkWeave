/**
 * PdfExportDialog - PDF エクスポートダイアログ
 *
 * export-interop-design.md §3, §4 に準拠。
 * 用紙サイズ・方向・余白・テーマ等のオプションを提供し、
 * Tauri WebView 印刷 API 経由で PDF を生成する。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MdToHtmlOptions } from '../../core/converter/md-to-html';
import { themeList } from '../../core/converter/theme-loader';
import { exportToPdf, defaultPdfOptions, type PdfExportOptions } from '../../file/export/pdf-exporter';
import { useToastStore } from '../../store/toastStore';

export interface PdfExportDialogProps {
  markdown: string;
  currentFilePath?: string;
  onClose: () => void;
}

type PaperSize = PdfExportOptions['paperSize'];
type Orientation = PdfExportOptions['orientation'];

const paperSizeLabels: Record<PaperSize, string> = {
  A4: 'A4 (210 x 297 mm)',
  A3: 'A3 (297 x 420 mm)',
  Letter: 'Letter (8.5 x 11 in)',
};

export function PdfExportDialog({ markdown, currentFilePath, onClose }: PdfExportDialogProps) {
  const [theme, setTheme] = useState<MdToHtmlOptions['theme']>(defaultPdfOptions.theme);
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultPdfOptions.paperSize);
  const [orientation, setOrientation] = useState<Orientation>(defaultPdfOptions.orientation);
  const [marginTop, setMarginTop] = useState(defaultPdfOptions.marginMm.top);
  const [marginBottom, setMarginBottom] = useState(defaultPdfOptions.marginMm.bottom);
  const [marginLeft, setMarginLeft] = useState(defaultPdfOptions.marginMm.left);
  const [marginRight, setMarginRight] = useState(defaultPdfOptions.marginMm.right);
  const [includeToc, setIncludeToc] = useState(defaultPdfOptions.includeToc);
  const [renderMath, setRenderMath] = useState(defaultPdfOptions.renderMath);
  const [highlight, setHighlight] = useState(defaultPdfOptions.highlight);
  const [printHeaderFooter, setPrintHeaderFooter] = useState(defaultPdfOptions.printHeaderFooter);
  const [exporting, setExporting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc キーでダイアログを閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ダイアログ外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Tauri の保存ダイアログ
      let outputPath: string | null = null;
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const defaultName = currentFilePath
          ? currentFilePath.replace(/\.(md|html)$/, '.pdf')
          : 'export.pdf';
        outputPath = await save({
          filters: [{ name: 'PDF File', extensions: ['pdf'] }],
          defaultPath: defaultName,
        });
      } catch {
        outputPath = 'export.pdf';
      }

      if (!outputPath) {
        setExporting(false);
        return;
      }

      const result = await exportToPdf(markdown, outputPath, {
        theme,
        paperSize,
        orientation,
        marginMm: {
          top: marginTop,
          bottom: marginBottom,
          left: marginLeft,
          right: marginRight,
        },
        includeToc,
        renderMath,
        highlight,
        printHeaderFooter,
      });

      useToastStore.getState().show(
        'info',
        `PDF にエクスポートしました (${formatBytes(result.sizeBytes)})`,
      );
      onClose();
    } catch (err) {
      useToastStore.getState().show(
        'error',
        `PDF エクスポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExporting(false);
    }
  }, [
    markdown, currentFilePath, theme, paperSize, orientation,
    marginTop, marginBottom, marginLeft, marginRight,
    includeToc, renderMath, highlight, printHeaderFooter, onClose,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="PDF にエクスポート"
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg z-10">
          <h2 className="text-base font-semibold text-gray-900">PDF にエクスポート</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* テーマ選択 */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">テーマ</legend>
            <div className="space-y-2">
              {themeList.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    theme === t.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdf-theme"
                    value={t.id}
                    checked={theme === t.id}
                    onChange={() => setTheme(t.id)}
                    className="accent-blue-600 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.accentColor }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-gray-900">{t.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 用紙設定 */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">用紙設定</legend>
            <div className="grid grid-cols-2 gap-3">
              {/* 用紙サイズ */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">用紙サイズ</label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                >
                  {(Object.keys(paperSizeLabels) as PaperSize[]).map((size) => (
                    <option key={size} value={size}>{paperSizeLabels[size]}</option>
                  ))}
                </select>
              </div>

              {/* 印刷方向 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">印刷方向</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as Orientation)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                >
                  <option value="portrait">縦向き (Portrait)</option>
                  <option value="landscape">横向き (Landscape)</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* 余白設定 */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">余白 (mm)</legend>
            <div className="grid grid-cols-4 gap-2">
              <MarginInput label="上" value={marginTop} onChange={setMarginTop} />
              <MarginInput label="下" value={marginBottom} onChange={setMarginBottom} />
              <MarginInput label="左" value={marginLeft} onChange={setMarginLeft} />
              <MarginInput label="右" value={marginRight} onChange={setMarginRight} />
            </div>
          </fieldset>

          {/* オプション */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">オプション</legend>
            <div className="space-y-2">
              <CheckboxOption
                label="目次（TOC）を自動生成"
                checked={includeToc}
                onChange={setIncludeToc}
              />
              <CheckboxOption
                label="数式をレンダリング（KaTeX）"
                checked={renderMath}
                onChange={setRenderMath}
              />
              <CheckboxOption
                label="コードのシンタックスハイライト"
                checked={highlight}
                onChange={setHighlight}
              />
              <CheckboxOption
                label="ヘッダー/フッターを印刷"
                checked={printHeaderFooter}
                onChange={setPrintHeaderFooter}
              />
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'エクスポート中...' : 'PDF にエクスポート'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarginInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-center"
      />
    </div>
  );
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-blue-600 rounded"
      />
      {label}
    </label>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
