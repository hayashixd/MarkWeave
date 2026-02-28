/**
 * テーブルコンテキストメニュー
 *
 * テーブルセルを右クリックしたときに表示されるコンテキストメニュー。
 * TipTap のテーブルコマンドを呼び出して行・列の追加・削除を行う。
 *
 * Phase 2 実装タスク:
 * - 行の追加・削除（コンテキストメニュー）
 * - 列の追加・削除（コンテキストメニュー）
 */

import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';

export interface TableContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface TableContextMenuProps {
  editor: Editor;
  menu: TableContextMenuState;
  onClose: () => void;
}

/**
 * テーブルコンテキストメニューコンポーネント
 *
 * 行・列の追加/削除操作をメニュー項目として提供する。
 */
export function TableContextMenu({ editor, menu, onClose }: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
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

  const run = (cmd: () => boolean) => {
    cmd();
    onClose();
    editor.commands.focus();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="テーブル操作メニュー"
      className="table-context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <MenuSection label="行" />
      <MenuItem
        label="上に行を追加"
        onClick={() => run(() => editor.chain().addRowBefore().run())}
      />
      <MenuItem
        label="下に行を追加"
        onClick={() => run(() => editor.chain().addRowAfter().run())}
      />
      <MenuItem
        label="この行を削除"
        onClick={() => run(() => editor.chain().deleteRow().run())}
        danger
      />
      <MenuDivider />
      <MenuSection label="列" />
      <MenuItem
        label="左に列を追加"
        onClick={() => run(() => editor.chain().addColumnBefore().run())}
      />
      <MenuItem
        label="右に列を追加"
        onClick={() => run(() => editor.chain().addColumnAfter().run())}
      />
      <MenuItem
        label="この列を削除"
        onClick={() => run(() => editor.chain().deleteColumn().run())}
        danger
      />
      <MenuDivider />
      <MenuItem
        label="テーブルを削除"
        onClick={() => run(() => editor.chain().deleteTable().run())}
        danger
      />
    </div>
  );
}

function MenuSection({ label }: { label: string }) {
  return (
    <div className="table-context-menu__section" aria-hidden="true">
      {label}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      className={`table-context-menu__item${danger ? ' table-context-menu__item--danger' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div className="table-context-menu__divider" aria-hidden="true" />;
}
