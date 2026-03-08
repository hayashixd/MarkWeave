/**
 * PandocNotInstalledDialog - Pandoc 未インストール時のエラー案内ダイアログ
 *
 * export-interop-design.md §9.3 に準拠。
 * Pandoc が見つからない場合に表示し、インストール方法を案内する。
 */

import { useCallback, useEffect, useRef } from 'react';

export interface PandocNotInstalledDialogProps {
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
  /** 設定を開くコールバック */
  onOpenSettings: () => void;
}

export function PandocNotInstalledDialog({
  onClose,
  onOpenSettings,
}: PandocNotInstalledDialogProps) {
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

  const handleOpenSettings = useCallback(() => {
    onClose();
    onOpenSettings();
  }, [onClose, onOpenSettings]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Pandoc が見つかりません"
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <span className="text-amber-500 text-xl" aria-hidden="true">⚠</span>
          <h2 className="text-base font-semibold text-gray-900">
            Pandoc が見つかりません
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-700">
            Word / LaTeX / ePub エクスポートには <strong>Pandoc</strong> が必要です。
          </p>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Pandoc のインストール方法
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                  macOS
                </span>
                <code className="text-xs text-gray-600">brew install pandoc</code>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                  Windows
                </span>
                <span className="text-xs text-gray-600">
                  インストーラーをダウンロード:{' '}
                  <span className="text-blue-600 font-mono">pandoc.org/installing.html</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                  Linux
                </span>
                <code className="text-xs text-gray-600">apt install pandoc</code>
              </li>
            </ul>
          </div>

          <p className="text-xs text-gray-500">
            インストール後、アプリを再起動するか、設定から Pandoc のパスを手動指定してください。
          </p>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-100 rounded transition-colors"
          >
            設定を開く
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
