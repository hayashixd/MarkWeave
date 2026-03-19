/**
 * タブバーコンポーネント
 *
 * window-tab-session-design.md に準拠:
 * - タブの開く・閉じる・切り替え
 * - 未保存マーカー表示 (● filename.md)
 * - タブ閉じる時の未保存確認
 * - タブをウィンドウに切り出す機能（Phase 7: コンテキストメニュー）
 *
 * UI 改善:
 * - 閉じるボタンを常時表示（ホバー時のみだと見つけにくい）
 * - アクティブタブの視認性向上（下ボーダーに青色アクセント）
 * - タブバー空き領域のダブルクリックでウィンドウ最大化トグル
 * - タブバー空き領域をドラッグ領域として使用（data-tauri-drag-region）
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import type { TabState } from '../../store/tabStore';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useTabPlatformCacheStore } from '../../store/tabPlatformCacheStore';

interface TabBarProps {
  onCloseTab?: (tabId: string, isDirty: boolean) => void;
  onNewTab?: () => void;
  onDetachTab?: (tabId: string) => void;
}

/** content/savedContent を除いたフィールドのみで比較（キーストロークごとの再レンダリングを防止） */
function tabsShallowEqual(prev: TabState[], next: TabState[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (
      a.id !== b.id ||
      a.fileName !== b.fileName ||
      a.isDirty !== b.isDirty ||
      a.isReadOnly !== b.isReadOnly
    ) return false;
  }
  return true;
}

export function TabBar({ onCloseTab, onNewTab, onDetachTab }: TabBarProps) {
  const tabs = useStoreWithEqualityFn(useTabStore, (s) => s.tabs, tabsShallowEqual);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const platformCache = useTabPlatformCacheStore((s) => s.platforms);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: TabState } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // コンテキストメニュー外クリックで閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: PointerEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [contextMenu]);

  // タブバー空き領域のダブルクリックでウィンドウ最大化/元のサイズに切り替え
  const handleDragAreaDoubleClick = useCallback(() => {
    (async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        await getCurrentWebviewWindow().toggleMaximize();
      } catch {
        // Tauri 外（ブラウザ開発時）ではスキップ
      }
    })();
  }, []);

  const moveFocusToTab = (index: number) => {
    const nextTab = tabs[index];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocusToTab((index + 1) % tabs.length);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocusToTab((index - 1 + tabs.length) % tabs.length);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      moveFocusToTab(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      moveFocusToTab(tabs.length - 1);
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && onCloseTab) {
      e.preventDefault();
      const tab = tabs[index];
      if (tab) {
        onCloseTab(tab.id, tab.isDirty);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tab: TabState) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tab });
  };

  return (
    <div className="tab-bar flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto flex-shrink-0">
      <div
        className="flex items-center min-w-0"
        role="tablist"
        aria-label="開いているファイル"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls="editor-panel"
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`tab-item flex items-center gap-1.5 px-3 py-2 cursor-pointer border-r border-gray-200 text-sm whitespace-nowrap select-none transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 font-medium border-b-2 border-b-blue-500'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
            >
              {platformCache[tab.id] === 'zenn' && (
                <span
                  className="flex-shrink-0 text-xs font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 leading-none"
                  title="Zenn"
                >
                  Z
                </span>
              )}
              {platformCache[tab.id] === 'qiita' && (
                <span
                  className="flex-shrink-0 text-xs font-bold px-1 py-0.5 rounded bg-green-100 text-green-700 leading-none"
                  title="Qiita"
                >
                  Q
                </span>
              )}
              <span className="truncate max-w-40">
                {tab.isReadOnly && (
                  <span className="text-gray-400 mr-1" title="読み取り専用">
                    🔒
                  </span>
                )}
                {tab.isDirty && (
                  <span className="text-orange-500 mr-1" title="未保存の変更があります">
                    ●
                  </span>
                )}
                {tab.fileName}
              </span>
              <button
                type="button"
                className={`ml-1 w-5 h-5 flex items-center justify-center rounded-sm transition-colors ${
                  isActive
                    ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                    : 'text-gray-300 hover:text-gray-600 hover:bg-gray-200'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(tab.id, tab.isDirty);
                }}
                aria-label={`${tab.fileName} を閉じる`}
                title="タブを閉じる"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {/* ドラッグ可能な空き領域 — ダブルクリックでウィンドウ最大化トグル */}
      <div
        className="flex-1 self-stretch"
        data-tauri-drag-region
        onDoubleClick={handleDragAreaDoubleClick}
      />
      <button
        type="button"
        className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 text-lg flex-shrink-0"
        onClick={onNewTab}
        aria-label="新しいタブ"
        title="新しいタブ (Ctrl+N)"
      >
        +
      </button>

      {/* タブコンテキストメニュー */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => {
              onCloseTab?.(contextMenu.tab.id, contextMenu.tab.isDirty);
              setContextMenu(null);
            }}
          >
            タブを閉じる
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => {
              onDetachTab?.(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            新しいウィンドウに切り出す
          </button>
        </div>
      )}
    </div>
  );
}
