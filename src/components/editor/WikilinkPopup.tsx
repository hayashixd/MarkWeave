/**
 * Wikilink オートコンプリートポップアップ
 *
 * wikilinks-backlinks-design.md §4 に準拠。
 *
 * `[[` 入力後にワークスペースのファイル候補を表示。
 * ↑↓ で選択、Enter/Tab で挿入、Esc で閉じる。
 *
 * ペルソナ: 知識管理者 — ファイル名を覚えていなくてもリンクできる
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import type { WikilinkAutoState } from '../../extensions/WikilinkExtension';

interface WikilinkPopupProps {
  editor: Editor;
  autoState: WikilinkAutoState;
  candidates: { name: string; path: string }[];
  onClose: () => void;
}

const POPUP_MAX_HEIGHT = 280;
const POPUP_WIDTH = 320;

export function WikilinkPopup({ editor, autoState, candidates, onClose }: WikilinkPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // クエリが変わったらリセット
  useEffect(() => {
    setSelectedIndex(0);
  }, [autoState.query]);

  // 選択中アイテムを自動スクロール
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const filtered = candidates.filter((c) => {
    if (!autoState.query) return true;
    return c.name.toLowerCase().includes(autoState.query.toLowerCase());
  }).slice(0, 30);

  // ファイルを挿入
  const insertLink = useCallback(
    (candidate: { name: string; path: string }) => {
      const { from } = autoState;
      const to = editor.state.selection.from;
      // `[[query` を削除して wikilink ノードを挿入
      const targetName = candidate.name.replace(/\.(md|html|txt)$/, '');
      editor.view.dispatch(
        editor.state.tr
          .delete(from, to)
          .insert(from, editor.state.schema.nodes.wikilink.create({ target: targetName, label: null })),
      );
      onClose();
    },
    [editor, autoState, onClose],
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
        const item = filtered[selectedIndex];
        if (item) insertLink(item);
      }
    };
    window.addEventListener('wikilink-autocomplete-key', handler);
    return () => window.removeEventListener('wikilink-autocomplete-key', handler);
  }, [filtered, selectedIndex, insertLink]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!autoState.active || !autoState.coords) return null;

  // 位置計算
  const { top, left, bottom } = autoState.coords;
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - bottom;
  const showAbove = spaceBelow < POPUP_MAX_HEIGHT + 20;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(left, window.innerWidth - POPUP_WIDTH - 8),
    zIndex: 1000,
    width: POPUP_WIDTH,
    maxHeight: POPUP_MAX_HEIGHT,
    ...(showAbove ? { bottom: viewportHeight - top + 4 } : { top: bottom + 4 }),
  };

  return (
    <div ref={popupRef} className="wikilink-popup" style={style} role="listbox" aria-label="ファイル候補">
      <div className="wikilink-popup__header">
        <span className="wikilink-popup__icon">[[</span>
        <span className="wikilink-popup__query">{autoState.query || 'ファイル名を入力…'}</span>
        <span className="wikilink-popup__count">{filtered.length}件</span>
      </div>

      <div className="wikilink-popup__list">
        {filtered.length === 0 ? (
          <div className="wikilink-popup__empty">一致するファイルが見つかりません</div>
        ) : (
          filtered.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const nameWithoutExt = item.name.replace(/\.(md|html|txt)$/, '');
            const ext = item.name.split('.').pop()?.toUpperCase() ?? 'MD';
            return (
              <button
                key={item.path}
                ref={isSelected ? selectedItemRef : undefined}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`wikilink-popup__item${isSelected ? ' wikilink-popup__item--selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => insertLink(item)}
              >
                <span className={`wikilink-popup__item-badge ${ext === 'HTML' ? 'wikilink-popup__item-badge--html' : ''}`}>
                  {ext === 'HTML' ? 'H' : 'M'}
                </span>
                <span className="wikilink-popup__item-name">{nameWithoutExt}</span>
                <span className="wikilink-popup__item-path">{item.path.split(/[/\\]/).slice(-2, -1)[0] ?? ''}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="wikilink-popup__footer">
        <span>↑↓ 移動</span>
        <span>Enter 挿入</span>
        <span>Esc キャンセル</span>
      </div>
    </div>
  );
}
