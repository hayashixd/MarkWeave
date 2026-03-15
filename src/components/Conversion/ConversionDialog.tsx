/**
 * ConversionDialog - HTML ↔ MD 変換ダイアログ
 *
 * html-editing-design.md §10.3 に準拠。
 * 変換前の警告表示と変換実行、変換結果を新規タブで開くオプションを提供する。
 *
 * フロー:
 * 1. 変換ロスを検出して警告リストを表示
 * 2. ユーザーが「変換する」「別名で保存してから変換」「新規タブで開く」を選択
 * 3. 選択に応じて変換 → ファイル保存 or タブ追加
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConversionWarning } from '../../core/converter/html-to-md';

/** 変換方向 */
export type ConversionDirection = 'html-to-md' | 'md-to-html';

export interface ConversionDialogProps {
  /** 変換方向 */
  direction: ConversionDirection;
  /** 検出された変換ロスの警告リスト */
  warnings: ConversionWarning[];
  /** 現在のファイル名（表示用） */
  currentFileName: string;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
  /** 「変換して保存」実行コールバック */
  onConvertAndSave: () => void;
  /** 「新規タブで開く」実行コールバック */
  onConvertAndOpenTab: () => void;
  /** 変換中かどうか */
  isConverting?: boolean;
}

export function ConversionDialog({
  direction,
  warnings,
  currentFileName,
  onClose,
  onConvertAndSave,
  onConvertAndOpenTab,
  isConverting = false,
}: ConversionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [openInNewTab, setOpenInNewTab] = useState(false);

  const isHtmlToMd = direction === 'html-to-md';
  const targetFormat = isHtmlToMd ? 'Markdown' : 'HTML';
  const hasWarnings = warnings.length > 0;

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

  const handleConvert = useCallback(() => {
    if (openInNewTab) {
      onConvertAndOpenTab();
    } else {
      onConvertAndSave();
    }
  }, [openInNewTab, onConvertAndSave, onConvertAndOpenTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${targetFormat} に変換`}
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {isHtmlToMd ? 'HTML を Markdown に変換' : 'Markdown を HTML として保存'}
          </h2>
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
        <div className="px-5 py-4 space-y-4">
          {/* ファイル情報 */}
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">{currentFileName}</span>
            {' を '}
            {targetFormat}
            {' に変換します。'}
          </p>

          {/* 警告リスト（ロスがある場合のみ表示） */}
          {hasWarnings && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">
                このファイルには変換時に失われる要素が含まれています:
              </p>
              <ul className="space-y-1.5">
                {warnings.map((w) => (
                  <WarningItem key={w.type} warning={w} />
                ))}
              </ul>
              <p className="text-xs text-amber-600 mt-3 leading-relaxed">
                変換後は元の {isHtmlToMd ? 'HTML' : 'Markdown'} に戻すことはできません。
                {isHtmlToMd && '変換前に HTML ファイルを別名で保存することを推奨します。'}
              </p>
            </div>
          )}

          {/* 新規タブで開くオプション */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            変換結果を新規タブで開く（ファイルには保存しない）
          </label>
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
            onClick={handleConvert}
            disabled={isConverting}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConverting
              ? '変換中...'
              : openInNewTab
                ? '変換して新規タブで開く'
                : `${targetFormat} として保存`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 警告アイテム表示 */
function WarningItem({ warning }: { warning: ConversionWarning }) {
  return (
    <li className="flex items-start gap-2 text-sm text-amber-700">
      <span className="flex-shrink-0 mt-0.5" aria-hidden="true">
        {getSeverityIcon(warning.type)}
      </span>
      <span className="flex-1">
        {warning.message}
        <span className="ml-1.5 text-xs text-amber-500">
          ({warning.count} {warning.count === 1 ? '箇所' : '箇所'})
        </span>
      </span>
    </li>
  );
}

/** ロスタイプに応じたアイコンを返す */
function getSeverityIcon(type: ConversionWarning['type']): string {
  switch (type) {
    case 'svg':
    case 'iframe':
    case 'script':
    case 'style-tag':
      return '\u274C'; // ❌ 削除される要素
    default:
      return '\u26A0\uFE0F'; // ⚠️ 情報ロス
  }
}
