/**
 * 新規タブ作成時のプラットフォーム選択ダイアログ
 *
 * Ctrl+N または「+」ボタン押下時に表示され、
 * ユーザーが Zenn 技術記事 / Zenn アイデア / Qiita 記事 / 空白 を選択できる。
 * 選択後は対応するテンプレートコンテンツを持つタブが作成される。
 */

import { useEffect, useRef } from 'react';

interface NewTabPlatformPickerProps {
  onSelect: (templateId: 'zenn-tech' | 'zenn-idea' | 'qiita' | 'blank') => void;
  onCancel: () => void;
}

const OPTIONS = [
  {
    id: 'zenn-tech' as const,
    label: 'Zenn 技術記事',
    badge: '⚡',
    badgeClass: 'bg-blue-100 text-blue-700',
    description: 'tech / topics / emoji',
  },
  {
    id: 'zenn-idea' as const,
    label: 'Zenn アイデア',
    badge: '⚡',
    badgeClass: 'bg-blue-100 text-blue-700',
    description: 'idea / topics / emoji',
  },
  {
    id: 'qiita' as const,
    label: 'Qiita 記事',
    badge: '🗂',
    badgeClass: 'bg-green-100 text-green-700',
    description: 'title / tags',
  },
  {
    id: 'blank' as const,
    label: '空白',
    badge: '📄',
    badgeClass: 'bg-gray-100 text-gray-600',
    description: 'Front Matter なし',
  },
];

export function NewTabPlatformPicker({ onSelect, onCancel }: NewTabPlatformPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // フォーカストラップ & Escape で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // 最初のボタンにフォーカス
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLButtonElement>('button[data-option]');
    first?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw]"
        role="dialog"
        aria-modal="true"
        aria-label="新規ファイルの種類を選択"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-4">どのように始めますか？</h2>

        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-option
              onClick={() => onSelect(opt.id)}
              className="flex flex-col items-start gap-1 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-left"
            >
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${opt.badgeClass}`}>
                {opt.badge} {opt.label}
              </span>
              <span className="text-xs text-gray-400">{opt.description}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 py-1"
        >
          キャンセル (Esc)
        </button>
      </div>
    </div>
  );
}
