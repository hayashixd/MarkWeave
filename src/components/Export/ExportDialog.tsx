/**
 * ExportDialog - HTML エクスポートダイアログ
 *
 * export-interop-design.md §4.1 に準拠。
 * テーマ選択、TOC 生成、CSS インライン化、数式レンダリングの各オプションを提供する。
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { MdToHtmlOptions } from '../../core/converter/md-to-html';
import { themeList } from '../../core/converter/theme-loader';
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

  const selectedThemeInfo = useMemo(
    () => themeList.find((t) => t.id === theme) ?? themeList[0]!,
    [theme],
  );

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
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
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
            <div className="space-y-2">
              {themeList.map((t) => (
                <ThemeCard
                  key={t.id}
                  info={t}
                  selected={theme === t.id}
                  onSelect={() => setTheme(t.id)}
                />
              ))}
            </div>
          </fieldset>

          {/* テーマプレビュー */}
          <ThemePreview themeInfo={selectedThemeInfo} />

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

/** テーマ選択カード */
function ThemeCard({
  info,
  selected,
  onSelect,
}: {
  info: (typeof themeList)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <input
        type="radio"
        name="theme"
        value={info.id}
        checked={selected}
        onChange={onSelect}
        className="accent-blue-600 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: info.accentColor }}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-gray-900">{info.label}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{info.description}</p>
      </div>
    </label>
  );
}

/** 選択テーマのミニプレビュー */
function ThemePreview({ themeInfo }: { themeInfo: (typeof themeList)[number] }) {
  const isPresentation = themeInfo.id === 'presentation';
  const isDocument = themeInfo.id === 'document';

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-medium">プレビュー</span>
        <span className="text-xs text-gray-400">{themeInfo.fontHint}</span>
      </div>
      <div
        className="p-4"
        style={{
          backgroundColor: '#ffffff',
          fontFamily: isDocument
            ? "Georgia, 'Noto Serif CJK JP', serif"
            : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* 見出し */}
        <div
          style={{
            fontSize: isPresentation ? 18 : isDocument ? 16 : 15,
            fontWeight: 700,
            color: themeInfo.headingColor,
            borderBottom: `${isPresentation ? 3 : isDocument ? 2 : 1}px solid ${themeInfo.headingColor}`,
            paddingBottom: 4,
            marginBottom: 8,
            textAlign: isPresentation || isDocument ? 'center' : undefined,
          }}
        >
          Sample Heading
        </div>
        {/* 本文 */}
        <div
          style={{
            fontSize: isPresentation ? 12 : 11,
            lineHeight: 1.6,
            color: isDocument ? '#2c3e50' : '#1f2328',
            textAlign: isDocument ? 'justify' : undefined,
            marginBottom: 8,
          }}
        >
          ここにドキュメントの本文が表示されます。テーマによってフォント、サイズ、配色が変わります。
        </div>
        {/* コードブロック */}
        <div
          style={{
            fontSize: 10,
            fontFamily: "'SFMono-Regular', Consolas, monospace",
            backgroundColor: isPresentation ? '#2d2d2d' : '#f6f8fa',
            color: isPresentation ? '#f8f8f2' : '#1f2328',
            borderRadius: isPresentation ? 6 : 4,
            border: isDocument ? '1px solid #e0e0e0' : undefined,
            padding: '4px 8px',
            marginBottom: 8,
          }}
        >
          const theme = &quot;{themeInfo.id}&quot;;
        </div>
        {/* 引用 */}
        <div
          style={{
            fontSize: 10,
            borderLeft: `3px solid ${themeInfo.accentColor}`,
            paddingLeft: 8,
            color: isDocument ? '#555' : '#59636e',
            fontStyle: isDocument ? 'italic' : undefined,
            backgroundColor: isPresentation || isDocument ? '#f8f9fa' : undefined,
          }}
        >
          引用テキストのサンプルです。
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
