/**
 * 同一ファイル分割時のスクロール同期フック
 *
 * split-editor-design.md §6 に準拠:
 * - 同じファイルを 2 ペインで開いている場合にスクロール同期
 * - 有効時: 一方のペインでスクロールすると、他方も比例してスクロール
 * - 無効時: 各ペインが独立してスクロール
 * - 異なるファイル間の同期は行わない
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePaneStore } from '../../store/paneStore';
import { useTabStore } from '../../store/tabStore';

/**
 * 同一ファイルが両ペインで開かれているかを判定し、
 * スクロール同期を行うフック。
 *
 * SplitEditorLayout 内で使用する。
 */
export function useScrollSync() {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const scrollSyncEnabled = usePaneStore((s) => s.scrollSyncEnabled);
  const allTabs = useTabStore((s) => s.tabs);
  const isSyncing = useRef(false);

  // 両ペインで同じファイルが開かれているか判定
  const isSameFile = (() => {
    if (layout.type === 'single' || panes.length < 2) return false;
    const pane1Tab = panes[0]?.activeTabId
      ? allTabs.find((t) => t.id === panes[0]?.activeTabId)
      : null;
    const pane2Tab = panes[1]?.activeTabId
      ? allTabs.find((t) => t.id === panes[1]?.activeTabId)
      : null;
    if (!pane1Tab?.filePath || !pane2Tab?.filePath) return false;
    return pane1Tab.filePath === pane2Tab.filePath;
  })();

  const shouldSync = scrollSyncEnabled && isSameFile;

  const handleScroll = useCallback(
    (sourcePane: Element, targetPane: Element) => {
      if (!shouldSync || isSyncing.current) return;

      isSyncing.current = true;
      const sourceMax = sourcePane.scrollHeight - sourcePane.clientHeight;
      if (sourceMax <= 0) {
        isSyncing.current = false;
        return;
      }
      const ratio = sourcePane.scrollTop / sourceMax;
      const targetMax = targetPane.scrollHeight - targetPane.clientHeight;
      targetPane.scrollTop = ratio * targetMax;

      // 次のフレームでフラグをリセット（無限ループ防止）
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    },
    [shouldSync],
  );

  useEffect(() => {
    if (!shouldSync) return;

    // ペインのエディタスクロール要素を取得
    const pane1El = document.querySelector('[data-pane-id="pane-1"] .ProseMirror')?.parentElement;
    const pane2El = document.querySelector('[data-pane-id="pane-2"] .ProseMirror')?.parentElement;
    if (!pane1El || !pane2El) return;

    const onPane1Scroll = () => handleScroll(pane1El, pane2El);
    const onPane2Scroll = () => handleScroll(pane2El, pane1El);

    pane1El.addEventListener('scroll', onPane1Scroll, { passive: true });
    pane2El.addEventListener('scroll', onPane2Scroll, { passive: true });

    return () => {
      pane1El.removeEventListener('scroll', onPane1Scroll);
      pane2El.removeEventListener('scroll', onPane2Scroll);
    };
  }, [shouldSync, handleScroll]);

  return { isSameFile, shouldSync };
}
