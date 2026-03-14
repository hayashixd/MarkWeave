/**
 * スラッシュコマンドメニュー UI
 *
 * slash-commands-design.md §4 に準拠。
 *
 * - カーソル直下にポップアップ表示
 * - カテゴリ別グループ表示
 * - ↑↓ で選択、Enter/Tab で実行、Esc で閉じる
 * - ビューポート端での上方向反転
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  CATEGORY_LABELS,
  filterCommands,
  type SlashCommandDef,
  type SlashCommandCategory,
} from './slash-command-definitions';
import type { SlashCommandState } from '../../extensions/SlashCommandsExtension';
import { useSettingsStore } from '../../store/settingsStore';
import { useSnippetStore } from '../../store/snippetStore';
import { snippetsToCommands } from '../../lib/snippet-commands';

interface SlashCommandMenuProps {
  editor: Editor;
  slashState: SlashCommandState;
  onClose: () => void;
}

const MENU_MAX_HEIGHT = 320;
const MENU_WIDTH = 340;

export function SlashCommandMenu({ editor, slashState, onClose }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const { settings } = useSettingsStore();
  const { snippets } = useSnippetStore();
  const showAi = settings.slashCommands?.showAiTemplates !== false;
  const snippetCommands = snippetsToCommands(snippets);
  const filtered = filterCommands(slashState.query, snippetCommands).filter(
    (cmd) => showAi || cmd.category !== 'ai',
  );

  // クエリが変わったら選択インデックスをリセット
  useEffect(() => {
    setSelectedIndex(0);
  }, [slashState.query]);

  // 選択中アイテムを自動スクロール
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // コマンド実行
  const executeCommand = useCallback(
    (cmd: SlashCommandDef) => {
      const { from } = slashState;
      const to = editor.state.selection.from;

      // メニューを先に閉じてプラグイン状態の干渉を防ぐ
      onClose();

      // /クエリ を削除してからコマンドを実行
      // deleteRange で1トランザクション処理し、その後コマンドを実行する
      editor.chain().focus().deleteRange({ from, to }).run();
      cmd.action(editor);
    },
    [editor, slashState, onClose],
  );

  // キーボードナビゲーション
  useEffect(() => {
    const handler = (e: Event) => {
      const { key } = (e as CustomEvent<{ key: string }>).detail;
      if (key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      } else if (key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
      } else if (key === 'Enter' || key === 'Tab') {
        const cmd = filtered[selectedIndex];
        if (cmd) executeCommand(cmd);
      }
    };
    window.addEventListener('slash-commands-key', handler);
    return () => window.removeEventListener('slash-commands-key', handler);
  }, [filtered, selectedIndex, executeCommand]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!slashState.active || !slashState.coords) return null;

  // メニュー位置計算
  const { top, left, bottom } = slashState.coords;
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - bottom;
  const showAbove = spaceBelow < MENU_MAX_HEIGHT + 20;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(left, window.innerWidth - MENU_WIDTH - 8),
    zIndex: 1000,
    width: MENU_WIDTH,
    maxHeight: MENU_MAX_HEIGHT,
    ...(showAbove
      ? { bottom: viewportHeight - top + 4 }
      : { top: bottom + 4 }),
  };

  // カテゴリ別にグループ化
  const grouped = new Map<SlashCommandCategory, SlashCommandDef[]>();
  let globalIndex = 0;
  const indexMap = new Map<SlashCommandDef, number>();

  for (const cmd of filtered) {
    if (!grouped.has(cmd.category)) grouped.set(cmd.category, []);
    grouped.get(cmd.category)!.push(cmd);
    indexMap.set(cmd, globalIndex++);
  }

  return (
    <div
      ref={menuRef}
      className="slash-command-menu"
      style={menuStyle}
      role="listbox"
      aria-label="コマンドを選択"
    >
      {/* クエリ表示 */}
      <div className="slash-command-menu__query">
        <span className="slash-command-menu__query-icon">🔍</span>
        <span className="slash-command-menu__query-text">
          {slashState.query ? `/${slashState.query}` : '/'}
        </span>
        <span className="slash-command-menu__query-hint">
          {filtered.length > 0 ? `${filtered.length}件` : '一致なし'}
        </span>
      </div>

      {/* コマンドリスト */}
      <div className="slash-command-menu__list">
        {filtered.length === 0 ? (
          <div className="slash-command-menu__empty">
            /{slashState.query} に一致する要素が見つかりません
          </div>
        ) : (
          Array.from(grouped.entries()).map(([category, cmds]) => (
            <div key={category} className="slash-command-menu__group">
              <div className="slash-command-menu__group-label">
                {CATEGORY_LABELS[category]}
              </div>
              {cmds.map((cmd) => {
                const idx = indexMap.get(cmd)!;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    ref={isSelected ? selectedItemRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`slash-command-menu__item${isSelected ? ' slash-command-menu__item--selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => executeCommand(cmd)}
                  >
                    <span className="slash-command-menu__item-icon">{cmd.icon}</span>
                    <span className="slash-command-menu__item-body">
                      <span className="slash-command-menu__item-name">{cmd.name}</span>
                      <span className="slash-command-menu__item-desc">{cmd.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* フッターヒント */}
      <div className="slash-command-menu__footer">
        <span>↑↓ 移動</span>
        <span>Enter 実行</span>
        <span>Esc キャンセル</span>
      </div>
    </div>
  );
}
