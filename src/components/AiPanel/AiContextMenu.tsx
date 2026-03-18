/**
 * AI コンテキストメニュー（ai-edit-design.md §13.2 準拠）
 *
 * テキスト選択時に右クリックで表示される AI 操作メニュー。
 * table-context-menu の CSS クラスを共用する。
 */

import { useEffect, useRef } from 'react';

export interface AiContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface AiContextMenuProps {
  menu: AiContextMenuState;
  hasSelection: boolean;
  onAiEdit: () => void;
  onAiProofread: () => void;
  onAiRewrite: () => void;
  onAiSummarize: () => void;
  onAiTranslate: () => void;
  onClose: () => void;
}

export function AiContextMenu({
  menu,
  hasSelection,
  onAiEdit,
  onAiProofread,
  onAiRewrite,
  onAiSummarize,
  onAiTranslate,
  onClose,
}: AiContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu.visible) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu.visible, onClose]);

  if (!menu.visible) return null;

  const run = (callback: () => void) => {
    onClose();
    callback();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="AI 操作メニュー"
      className="table-context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="table-context-menu__section" aria-hidden="true">AI</div>
      <button
        role="menuitem"
        type="button"
        className="table-context-menu__item ai-context-menu__item--primary"
        onClick={() => run(onAiEdit)}
      >
        AI で編集...
        <span className="table-context-menu__shortcut">Ctrl+Shift+I</span>
      </button>
      {hasSelection && (
        <>
          <div className="table-context-menu__divider" aria-hidden="true" />
          <button
            role="menuitem"
            type="button"
            className="table-context-menu__item"
            onClick={() => run(onAiProofread)}
          >
            AI 校正
          </button>
          <button
            role="menuitem"
            type="button"
            className="table-context-menu__item"
            onClick={() => run(onAiRewrite)}
          >
            AI リライト
          </button>
          <button
            role="menuitem"
            type="button"
            className="table-context-menu__item"
            onClick={() => run(onAiSummarize)}
          >
            AI 要約
          </button>
          <button
            role="menuitem"
            type="button"
            className="table-context-menu__item"
            onClick={() => run(onAiTranslate)}
          >
            AI 翻訳
          </button>
        </>
      )}
    </div>
  );
}
