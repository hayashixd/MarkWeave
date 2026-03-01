/**
 * ExportDialog - HTML エクスポートダイアログ
 *
 * export-interop-design.md §4.1 に準拠。
 * テーマ選択、TOC 生成、CSS インライン化、数式レンダリングの各オプションを提供する。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MdToHtmlOptions } from '../../core/converter/md-to-html';
import { exportToHtml } from '../../file/export/html-exporter';
import { useToastStore } from '../../store/toastStore';

export interface ExportDialogProps {
  /** エクスポート対象の Markdown テキスト */
  markdown: string;
  /** 現在のファイルパス（保存先のデフォルト名に使用） */
  currentFilePath?: string;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
}

export function ExportDialog({ markdown, currentFilePath, onClose }: ExportDialogProps) {
  const [theme, setTheme] = useState<MdToHtmlOptions['theme']>('github');
  const [includeToc, setIncludeToc] = useState(false);
  const [inlineCss, setInlineCss] = useState(true);
  const [renderMath, setRenderMath] = useState(true);
  const [highlight, setHighlight] = useState(true);
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
          ? currentFilePath.replace(/\.md$/, '.html')
          : 'export.html';
        outputPath = await save({
          filters: [{ name: 'HTML File', extensions: ['html'] }],
          defaultPath: defaultName,
        });
      } catch {
        // Tauri 外ではデフォルトファイル名を使用
        outputPath = 'export.html';
      }

      if (!outputPath) {
        setExporting(false);
        return;
      }

      const result = await exportToHtml(markdown, outputPath, {
        theme,
        toc: includeToc,
        inlineCss,
        math: renderMath,
        highlight,
      });

      useToastStore.getState().show(
        'info',
        `HTML にエクスポートしました (${formatBytes(result.sizeBytes)})`,
      );
      onClose();
    } catch (err) {
      useToastStore.getState().show(
        'error',
        `エクスポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExporting(false);
    }
  }, [markdown, currentFilePath, theme, includeToc, inlineCss, renderMath, highlight, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="HTML にエクスポート"
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">HTML にエクスポート</h2>
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
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="github"
                  checked={theme === 'github'}
                  onChange={() => setTheme('github')}
                  className="accent-blue-600"
                />
                GitHub スタイル
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="document"
                  checked={theme === 'document'}
                  onChange={() => setTheme('document')}
                  className="accent-blue-600"
                />
                ドキュメントスタイル（書籍風）
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="presentation"
                  checked={theme === 'presentation'}
                  onChange={() => setTheme('presentation')}
                  className="accent-blue-600"
                />
                プレゼンテーションスタイル
              </label>
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
                label="CSS をインライン化（スタンドアローン）"
                checked={inlineCss}
                onChange={setInlineCss}
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
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
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
            {exporting ? 'エクスポート中...' : 'エクスポート'}
          </button>
        </div>
      </div>
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
