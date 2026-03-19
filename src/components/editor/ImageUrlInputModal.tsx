/**
 * Qiita 画像URL入力モーダル
 *
 * Qiita では画像は外部 URL が必要なため、画像ドロップ/ペースト時に
 * Data URI フォールバックの代わりにこのモーダルを表示する。
 *
 * image-url-input-request カスタムイベントで起動。
 * 確定時は onConfirm(url, alt) コールバックを呼ぶ。
 */

import { useEffect, useRef, useState } from 'react';

interface ImageUrlInputModalProps {
  /** alt テキストの初期値（ファイル名から生成） */
  defaultAlt: string;
  onConfirm: (url: string, alt: string) => void;
  onCancel: () => void;
}

export function ImageUrlInputModal({ defaultAlt, onConfirm, onCancel }: ImageUrlInputModalProps) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState(defaultAlt);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // Escape で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleConfirm = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onConfirm(trimmed, alt.trim() || defaultAlt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-[440px] max-w-[90vw]"
        role="dialog"
        aria-modal="true"
        aria-label="画像URLを入力"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-1">画像URLを入力</h2>
        <p className="text-xs text-gray-400 mb-4">
          Qiita では画像のURLが必要です。Qiita の記事エディタ等で画像をアップロードしてURLを取得してください。
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              画像URL <span className="text-red-500">*</span>
            </span>
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-mono"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">代替テキスト（alt）</span>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={defaultAlt}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!url.trim()}
            className="px-4 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            挿入
          </button>
        </div>
      </div>
    </div>
  );
}
