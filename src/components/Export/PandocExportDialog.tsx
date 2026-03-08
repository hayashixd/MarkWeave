/**
 * PandocExportDialog - Pandoc エクスポートダイアログ
 *
 * export-interop-design.md §4.1, §7, §8 に準拠。
 * Word (.docx) / LaTeX (.tex) / ePub (.epub) のエクスポートオプションを提供する。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { exportToDocx, exportToLatex, exportToEpub, checkPandoc } from '../../file/export/pandoc-exporter';
import type { PandocFormat } from '../../file/export/pandoc-exporter';
import { useToastStore } from '../../store/toastStore';
import { PandocNotInstalledDialog } from './PandocNotInstalledDialog';

export interface PandocExportDialogProps {
  /** エクスポート対象の Markdown テキスト */
  markdown: string;
  /** 現在のファイルパス（デフォルト保存名に使用） */
  currentFilePath?: string;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
  /** 設定を開くコールバック（Pandoc 未インストール時の案内から呼ばれる） */
  onOpenSettings: () => void;
  /** ユーザー設定の Pandoc パス */
  pandocPath?: string;
  /** 初期選択フォーマット */
  initialFormat?: PandocFormat;
}

type LatexEngine = 'pdflatex' | 'xelatex' | 'lualatex';

const FORMAT_LABELS: Record<PandocFormat, string> = {
  docx: 'Word (.docx)',
  latex: 'LaTeX (.tex)',
  epub: 'ePub (.epub)',
};

const FORMAT_EXTENSIONS: Record<PandocFormat, string> = {
  docx: 'docx',
  latex: 'tex',
  epub: 'epub',
};

const FORMAT_FILTER_NAMES: Record<PandocFormat, string> = {
  docx: 'Word Document',
  latex: 'LaTeX Source',
  epub: 'ePub Book',
};

export function PandocExportDialog({
  markdown,
  currentFilePath,
  onClose,
  onOpenSettings,
  pandocPath,
  initialFormat = 'docx',
}: PandocExportDialogProps) {
  const [format, setFormat] = useState<PandocFormat>(initialFormat);
  const [includeToc, setIncludeToc] = useState(false);
  // docx 固有
  const [includeHighlight, setIncludeHighlight] = useState(true);
  const [referenceDoc, setReferenceDoc] = useState('');
  // latex 固有
  const [latexEngine, setLatexEngine] = useState<LatexEngine>('xelatex');
  // epub 固有
  const [epubTitle, setEpubTitle] = useState('');
  const [epubAuthor, setEpubAuthor] = useState('');
  const [epubLang, setEpubLang] = useState('ja');

  const [exporting, setExporting] = useState(false);
  const [pandocNotFound, setPandocNotFound] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc キーで閉じる
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
      // Pandoc インストール確認
      const pandocCheck = await checkPandoc(pandocPath);
      if (!pandocCheck.available) {
        setPandocNotFound(true);
        return;
      }

      // 保存ダイアログ
      let outputPath: string | null = null;
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const ext = FORMAT_EXTENSIONS[format];
        const defaultName = currentFilePath
          ? currentFilePath.replace(/\.(md|html)$/, `.${ext}`)
          : `export.${ext}`;
        outputPath = await save({
          filters: [{ name: FORMAT_FILTER_NAMES[format], extensions: [ext] }],
          defaultPath: defaultName,
        });
      } catch {
        outputPath = null;
      }

      if (!outputPath) {
        return;
      }

      // フォーマット別エクスポート実行
      switch (format) {
        case 'docx':
          await exportToDocx(markdown, outputPath, {
            includeToc,
            referenceDoc: referenceDoc.trim() || undefined,
            includeHighlight,
            pandocPath,
          });
          break;
        case 'latex':
          await exportToLatex(markdown, outputPath, {
            includeToc,
            engine: latexEngine,
            pandocPath,
          });
          break;
        case 'epub':
          await exportToEpub(markdown, outputPath, {
            includeToc,
            title: epubTitle.trim() || undefined,
            author: epubAuthor.trim() || undefined,
            language: epubLang,
            pandocPath,
          });
          break;
      }

      useToastStore.getState().show('info', `${FORMAT_LABELS[format]} にエクスポートしました`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Pandoc が見つからないエラーメッセージを検出
      if (msg.includes('Pandoc が見つかりません') || msg.includes('Pandoc not found')) {
        setPandocNotFound(true);
      } else {
        useToastStore.getState().show(
          'error',
          `エクスポートに失敗しました: ${msg}`,
        );
      }
    } finally {
      setExporting(false);
    }
  }, [
    format, markdown, currentFilePath, pandocPath,
    includeToc, includeHighlight, referenceDoc,
    latexEngine, epubTitle, epubAuthor, epubLang,
    onClose,
  ]);

  // Pandoc 未インストールダイアログが開いている場合
  if (pandocNotFound) {
    return (
      <PandocNotInstalledDialog
        onClose={() => setPandocNotFound(false)}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pandoc エクスポート"
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">エクスポート</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 space-y-5">
          {/* フォーマット選択 */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">エクスポート形式</legend>
            <div className="space-y-2">
              {(Object.keys(FORMAT_LABELS) as PandocFormat[]).map((fmt) => (
                <label
                  key={fmt}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    format === fmt
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={fmt}
                    checked={format === fmt}
                    onChange={() => setFormat(fmt)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {FORMAT_LABELS[fmt]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 共通オプション */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">共通オプション</legend>
            <CheckboxOption
              label="目次（TOC）を自動生成"
              checked={includeToc}
              onChange={setIncludeToc}
            />
          </fieldset>

          {/* フォーマット別オプション */}
          {format === 'docx' && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Word オプション</legend>
              <div className="space-y-3">
                <CheckboxOption
                  label="コードのシンタックスハイライトを含める"
                  checked={includeHighlight}
                  onChange={setIncludeHighlight}
                />
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    reference.docx パス（省略時は Pandoc デフォルト）
                  </label>
                  <input
                    type="text"
                    value={referenceDoc}
                    onChange={(e) => setReferenceDoc(e.target.value)}
                    placeholder="/path/to/reference.docx"
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </fieldset>
          )}

          {format === 'latex' && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">LaTeX オプション</legend>
              <div>
                <label className="block text-xs text-gray-600 mb-1">LaTeX エンジン</label>
                <select
                  value={latexEngine}
                  onChange={(e) => setLatexEngine(e.target.value as LatexEngine)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="xelatex">xelatex（日本語推奨）</option>
                  <option value="lualatex">lualatex</option>
                  <option value="pdflatex">pdflatex</option>
                </select>
              </div>
            </fieldset>
          )}

          {format === 'epub' && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">ePub メタデータ</legend>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">タイトル</label>
                  <input
                    type="text"
                    value={epubTitle}
                    onChange={(e) => setEpubTitle(e.target.value)}
                    placeholder="ドキュメントタイトル"
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">著者名</label>
                  <input
                    type="text"
                    value={epubAuthor}
                    onChange={(e) => setEpubAuthor(e.target.value)}
                    placeholder="著者名"
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">言語</label>
                  <select
                    value={epubLang}
                    onChange={(e) => setEpubLang(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ja">日本語 (ja)</option>
                    <option value="en">English (en)</option>
                    <option value="zh">中文 (zh)</option>
                    <option value="ko">한국어 (ko)</option>
                  </select>
                </div>
              </div>
            </fieldset>
          )}
        </div>

        {/* フッター */}
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
