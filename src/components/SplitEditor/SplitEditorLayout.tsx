/**
 * ペイン分割エディタレイアウト
 *
 * split-editor-design.md §3, §8.1 に準拠:
 * - 左右/上下の 2 分割対応
 * - 各ペインは独立したタブバーを持つ
 * - フォーカスのあるペインの情報をステータスバーに反映
 * - 分割なし（single）時は従来と同じ単一エディタ表示
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { usePaneStore } from '../../store/paneStore';
import { useTabStore } from '../../store/tabStore';
import type { TabState } from '../../store/tabStore';
import { PaneTabBar, PANE_TAB_DRAG_TYPE } from './PaneTabBar';
import { Splitter } from './Splitter';

interface SplitEditorLayoutProps {
  /** エディタ本体のレンダリング関数（タブに応じてエディタを表示） */
  renderEditor: (tab: TabState, paneId: string) => React.ReactNode;
  /** タブが無い時の空状態レンダリング関数 */
  renderEmpty: (paneId: string) => React.ReactNode;
  /** Read-Only バナーのレンダリング関数 */
  renderReadOnlyBanner?: (tab: TabState) => React.ReactNode;
  /** タブを閉じるハンドラ */
  onCloseTab?: (tabId: string, isDirty: boolean) => void;
  /** 新規タブハンドラ */
  onNewTab?: () => void;
}

export function SplitEditorLayout({
  renderEditor,
  renderEmpty,
  renderReadOnlyBanner,
  onCloseTab,
  onNewTab,
}: SplitEditorLayoutProps) {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const activePaneId = usePaneStore((s) => s.activePaneId);
  const setSplitRatio = usePaneStore((s) => s.setSplitRatio);
  const closePane = usePaneStore((s) => s.closePane);
  const setActivePaneId = usePaneStore((s) => s.setActivePaneId);
  const moveTabToPane = usePaneStore((s) => s.moveTabToPane);
  const allTabs = useTabStore((s) => s.tabs);
  const [dropTargetPaneId, setDropTargetPaneId] = useState<string | null>(null);

  const handleClosePane = useCallback(
    (paneId: string) => {
      closePane(paneId);
    },
    [closePane],
  );

  const handlePaneDragOver = useCallback(
    (e: React.DragEvent, targetPaneId: string) => {
      if (e.dataTransfer.types.includes(PANE_TAB_DRAG_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetPaneId(targetPaneId);
      }
    },
    [],
  );

  const handlePaneDragLeave = useCallback(() => {
    setDropTargetPaneId(null);
  }, []);

  const handlePaneDrop = useCallback(
    (e: React.DragEvent, targetPaneId: string) => {
      e.preventDefault();
      setDropTargetPaneId(null);

      const raw = e.dataTransfer.getData(PANE_TAB_DRAG_TYPE);
      if (!raw) return;

      try {
        const { tabId, fromPaneId } = JSON.parse(raw) as {
          tabId: string;
          fromPaneId: string;
        };
        if (fromPaneId !== targetPaneId) {
          moveTabToPane(tabId, fromPaneId, targetPaneId);
          setActivePaneId(targetPaneId);
        }
      } catch {
        // 無効なデータ — 無視
      }
    },
    [moveTabToPane, setActivePaneId],
  );

  const isSplit = layout.type !== 'single';
  const isVertical = layout.type === 'vertical';

  return (
    <div
      className={`split-editor-layout flex flex-1 min-h-0 min-w-0 ${
        isVertical ? 'flex-row' : 'flex-col'
      }`}
      data-layout={layout.type}
    >
      {panes.map((pane, index) => {
        const isFocused = pane.id === activePaneId;
        const activeTab = pane.activeTabId
          ? allTabs.find((t) => t.id === pane.activeTabId) ?? null
          : null;

        // 分割時のサイズ計算
        const sizeStyle: React.CSSProperties | undefined = isSplit
          ? isVertical
            ? { width: index === 0 ? `${layout.splitRatio * 100}%` : `${(1 - layout.splitRatio) * 100}%` }
            : { height: index === 0 ? `${layout.splitRatio * 100}%` : `${(1 - layout.splitRatio) * 100}%` }
          : undefined;

        return (
          <div key={pane.id} className="contents">
            {/* ペイン間のスプリッタ（2番目のペインの前に配置） */}
            {index === 1 && isSplit && (
              <Splitter
                direction={layout.type as 'horizontal' | 'vertical'}
                onRatioChange={setSplitRatio}
              />
            )}
            <div
              className={`split-pane flex flex-col min-h-0 min-w-0 ${
                !isSplit ? 'flex-1' : ''
              } ${
                isFocused && isSplit
                  ? 'ring-1 ring-blue-300 ring-inset'
                  : ''
              } ${
                dropTargetPaneId === pane.id
                  ? 'bg-blue-50/50'
                  : ''
              }`}
              style={sizeStyle}
              onClick={() => setActivePaneId(pane.id)}
              onDragOver={(e) => handlePaneDragOver(e, pane.id)}
              onDragLeave={handlePaneDragLeave}
              onDrop={(e) => handlePaneDrop(e, pane.id)}
              data-pane-id={pane.id}
              data-focused={isFocused}
            >
              {/* ペイン内タブバー（分割時のみ表示） */}
              {isSplit && (
                <PaneTabBar
                  paneId={pane.id}
                  isFocused={isFocused}
                  showCloseButton={true}
                  onCloseTab={onCloseTab}
                  onNewTab={onNewTab}
                  onClosePane={() => handleClosePane(pane.id)}
                />
              )}

              {/* エディタ本体 */}
              <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                {activeTab?.isReadOnly && renderReadOnlyBanner?.(activeTab)}
                {activeTab ? (
                  renderEditor(activeTab, pane.id)
                ) : (
                  renderEmpty(pane.id)
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
