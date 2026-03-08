/**
 * セッション復元フック。
 *
 * window-tab-session-design.md §2.4 に準拠:
 * - アプリ起動時に前回のセッションを復元
 * - セッションが存在しない場合は空のタブを開く
 *
 * エラーハンドリング:
 * - 個別ファイルの読み込み失敗はスキップし、完了後に件数をトーストで通知する
 * - セッション復元自体の失敗はワーニングトーストを表示して空タブで開始する
 */

import { useEffect, useRef } from 'react';
import { useTabStore } from '../store/tabStore';
import { useToastStore } from '../store/toastStore';
import { usePaneStore } from '../store/paneStore';
import { loadSession } from '../store/session';
import { useOpenFileAsTab } from './useOpenFileAsTab';

export function useSessionRestore() {
  const addTab = useTabStore((s) => s.addTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const tabs = useTabStore((s) => s.tabs);
  const show = useToastStore((s) => s.show);
  const openFileAsTab = useOpenFileAsTab();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    (async () => {
      try {
        const session = await loadSession();
        if (!session || session.openFiles.length === 0) {
          // セッションが無い場合は空タブを開く（AppShell 側の初回起動と同様）
          if (tabs.length === 0) {
            addTab({
              filePath: null,
              fileName: 'Untitled',
              content: '',
              savedContent: '',
            });
          }
          return;
        }

        // セッションのファイルをタブとして復元
        let activeTabId: string | null = null;
        let failCount = 0;

        for (const file of session.openFiles) {
          const tabId = await openFileAsTab(file.path);
          if (tabId === null) {
            failCount++;
          } else if (file.path === session.activeFilePath) {
            activeTabId = tabId;
          }
        }

        // アクティブタブを復元
        if (activeTabId) {
          setActiveTab(activeTabId);
        }

        // ペイン分割状態の復元
        if (session.paneLayout && session.paneLayout.layoutType !== 'single') {
          const paneStore = usePaneStore.getState();
          const allTabs = useTabStore.getState().tabs;

          // ファイルパスからタブIDを解決するヘルパー
          const resolveTabId = (filePath: string): string | null => {
            const tab = allTabs.find((t) => t.filePath === filePath);
            return tab?.id ?? null;
          };

          // 分割を開始（最初のペインのタブは既にpane-1にある）
          const pane2Files = session.paneLayout.panes[1]?.filePaths ?? [];
          if (pane2Files.length > 0) {
            // 最初のタブで分割を開始
            const firstFile = pane2Files[0];
            const firstTabId = firstFile ? resolveTabId(firstFile) : null;
            if (firstTabId) {
              paneStore.splitPane(
                session.paneLayout.layoutType as 'horizontal' | 'vertical',
                firstTabId,
              );
              // 残りのタブをpane-2に移動
              for (let i = 1; i < pane2Files.length; i++) {
                const file = pane2Files[i];
                const tabId = file ? resolveTabId(file) : null;
                if (tabId) {
                  paneStore.moveTabToPane(tabId, 'pane-1', 'pane-2');
                }
              }
              // 分割比率を復元
              paneStore.setSplitRatio(session.paneLayout.splitRatio);
              // 各ペインのアクティブタブを復元
              for (let pi = 0; pi < session.paneLayout.panes.length; pi++) {
                const paneSess = session.paneLayout.panes[pi];
                const paneId = pi === 0 ? 'pane-1' : 'pane-2';
                if (paneSess?.activeFilePath) {
                  const activeId = resolveTabId(paneSess.activeFilePath);
                  if (activeId) {
                    paneStore.setPaneActiveTab(paneId, activeId);
                  }
                }
              }
              // アクティブペインを復元
              const activePaneIdx = session.paneLayout.activePaneIndex;
              paneStore.setActivePaneId(activePaneIdx === 1 ? 'pane-2' : 'pane-1');
            }
          }
        }

        // 読み込めなかったファイルを通知
        if (failCount > 0) {
          show('warning', `セッション復元: ${failCount}個のファイルを開けませんでした`);
        }
      } catch {
        // セッション復元失敗 → 空タブで開始
        show('warning', 'セッションの復元に失敗しました。新規ファイルで開始します。');
        if (tabs.length === 0) {
          addTab({
            filePath: null,
            fileName: 'Untitled',
            content: '',
            savedContent: '',
          });
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
