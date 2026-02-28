/**
 * スマートペースト確認バー（Phase 3）
 *
 * smart-paste-design.md §4.2 に準拠:
 * - ask モード時にインライン確認バーを表示
 * - [Markdown として貼り付け] / [プレーンテキストとして貼り付け] ボタン
 * - Enter で Markdown 確定、Escape でプレーンテキスト
 * - 3秒後に自動的に Markdown として貼り付け
 */

import { useEffect, useRef, useCallback } from 'react';

interface SmartPasteBarProps {
  onMarkdown: () => void;
  onPlainText: () => void;
  onDismiss: () => void;
}

export function SmartPasteBar({ onMarkdown, onPlainText, onDismiss }: SmartPasteBarProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // 3秒後に自動的にMarkdownとして貼り付け
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onMarkdown();
    }, 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onMarkdown]);

  // キーボード操作
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onMarkdown();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onPlainText();
      }
    },
    [onMarkdown, onPlainText],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div ref={barRef} className="smart-paste-bar" role="alert">
      <span className="smart-paste-bar__message">
        クリップボードに書式付きテキストがあります
      </span>
      <div className="smart-paste-bar__actions">
        <button
          type="button"
          className="smart-paste-bar__btn smart-paste-bar__btn--primary"
          onClick={onMarkdown}
        >
          Markdown として貼り付け
        </button>
        <button
          type="button"
          className="smart-paste-bar__btn smart-paste-bar__btn--secondary"
          onClick={onPlainText}
        >
          プレーンテキスト
        </button>
        <button
          type="button"
          className="smart-paste-bar__btn smart-paste-bar__btn--close"
          onClick={onDismiss}
          title="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
