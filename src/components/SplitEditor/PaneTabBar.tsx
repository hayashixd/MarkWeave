/**
 * ペイン専用タブバーコンポーネント
 *
 * split-editor-design.md §3, §4.1 に準拠:
 * - 各ペインが独立したタブバーを持つ
 * - フォーカスのあるペインのタブバーは強調色
 * - 「ペインを閉じる」ボタン（分割時のみ表示）
 * - タブをドラッグでペイン間移動
 */

import { useCallback, useState } from 'react';
import { useTabStore } from '../../store/tabStore';
import type { TabState } from '../../store/tabStore';
import { usePaneStore } from '../../store/paneStore';

/** ドラッグ中のタブ情報を転送するための MIME タイプ */
export const PANE_TAB_DRAG_TYPE = 'application/x-pane-tab';

interface PaneTabBarProps {
  paneId: string;
  isFocused: boolean;
  showCloseButton: boolean;
  onCloseTab?: (tabId: string, isDirty: boolean) => void;
  onNewTab?: () => void;
  onClosePane?: () => void;
}

export function PaneTabBar({
  paneId,
  isFocused,
  showCloseButton,
  onCloseTab,
  onNewTab,
  onClosePane,
}: PaneTabBarProps) {
  const allTabs = useTabStore((s) => s.tabs);
  const pane = usePaneStore((s) => s.panes.find((p) => p.id === paneId));
  const setPaneActiveTab = usePaneStore((s) => s.setPaneActiveTab);
  const setActivePaneId = usePaneStore((s) => s.setActivePaneId);
  const moveTabToPane = usePaneStore((s) => s.moveTabToPane);
  const [dragOverActive, setDragOverActive] = useState(false);

  const paneTabs: TabState[] = pane
    ? pane.tabs
        .map((tid) => allTabs.find((t) => t.id === tid))
        .filter((t): t is TabState => t !== undefined)
    : [];

  const activeTabId = pane?.activeTabId ?? null;

  const handleTabClick = useCallback(
    (tabId: string) => {
      setPaneActiveTab(paneId, tabId);
      setActivePaneId(paneId);
    },
    [paneId, setPaneActiveTab, setActivePaneId],
  );

  const handlePaneFocus = useCallback(() => {
    setActivePaneId(paneId);
  }, [paneId, setActivePaneId]);

  // ドラッグ開始: タブ ID とソースペイン ID をセット
  const handleDragStart = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.dataTransfer.setData(
        PANE_TAB_DRAG_TYPE,
        JSON.stringify({ tabId, fromPaneId: paneId }),
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [paneId],
  );

  // ドラッグオーバー: ドロップ許可
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(PANE_TAB_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverActive(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverActive(false);
  }, []);

  // ドロップ: タブをこのペインに移動
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverActive(false);

      const raw = e.dataTransfer.getData(PANE_TAB_DRAG_TYPE);
      if (!raw) return;

      try {
        const { tabId, fromPaneId } = JSON.parse(raw) as {
          tabId: string;
          fromPaneId: string;
        };
        if (fromPaneId !== paneId) {
          moveTabToPane(tabId, fromPaneId, paneId);
          setActivePaneId(paneId);
        }
      } catch {
        // 無効なデータ — 無視
      }
    },
    [paneId, moveTabToPane, setActivePaneId],
  );

  return (
    <div
      className={`pane-tab-bar flex items-center border-b flex-shrink-0 overflow-x-auto ${
        isFocused
          ? 'bg-gray-100 border-gray-300'
          : 'bg-gray-50 border-gray-200'
      } ${dragOverActive ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
      onClick={handlePaneFocus}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="flex items-center min-w-0"
        role="tablist"
        aria-label={`ペイン ${paneId} のタブ`}
      >
        {paneTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              className={`pane-tab-item flex items-center gap-1 px-2.5 py-1.5 cursor-pointer border-r border-gray-200 text-xs whitespace-nowrap select-none transition-colors ${
                isActive
                  ? isFocused
                    ? 'bg-white text-gray-900 font-medium border-b-2 border-b-blue-500'
                    : 'bg-white text-gray-700 font-medium border-b-2 border-b-gray-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="truncate max-w-32">
                {tab.isReadOnly && (
                  <span className="text-gray-400 mr-0.5" title="読み取り専用">
                    🔒
                  </span>
                )}
                {tab.isDirty && (
                  <span className="text-orange-500 mr-0.5" title="未保存の変更があります">
                    ●
                  </span>
                )}
                {tab.fileName}
              </span>
              <button
                type="button"
                className={`ml-0.5 w-4 h-4 flex items-center justify-center rounded-sm transition-colors text-[10px] ${
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

      {/* 空き領域（ドロップ可能） */}
      <div className="flex-1 self-stretch" />

      {/* 新規タブボタン */}
      <button
        type="button"
        className="px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-sm flex-shrink-0"
        onClick={onNewTab}
        aria-label="新しいタブ"
        title="新しいタブ"
      >
        +
      </button>

      {/* ペインを閉じるボタン（分割時のみ） */}
      {showCloseButton && (
        <button
          type="button"
          className="px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-sm flex-shrink-0 border-l border-gray-200"
          onClick={onClosePane}
          aria-label="ペインを閉じる"
          title="ペインを閉じる"
        >
          ✕
        </button>
      )}
    </div>
  );
}
