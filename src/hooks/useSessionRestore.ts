/**
 * セッション復元フック。
 *
 * window-tab-session-design.md §2.4 に準拠:
 * - アプリ起動時に前回のセッションを復元
 * - セッションが存在しない場合は空のタブを開く
 */

import { useEffect, useRef } from 'react';
import { useTabStore } from '../store/tabStore';
import { loadSession } from '../store/session';
import { readFile } from '../lib/tauri-commands';

export function useSessionRestore() {
  const addTab = useTabStore((s) => s.addTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const tabs = useTabStore((s) => s.tabs);
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
        for (const file of session.openFiles) {
          try {
            const content = await readFile(file.path);
            const fileName = file.path.split(/[/\\]/).pop() ?? 'Untitled';
            const tabId = addTab({
              filePath: file.path,
              fileName,
              content,
              savedContent: content,
            });
            if (file.path === session.activeFilePath) {
              activeTabId = tabId;
            }
          } catch {
            // ファイル読み込み失敗 → スキップ
          }
        }

        // アクティブタブを復元
        if (activeTabId) {
          setActiveTab(activeTabId);
        }
      } catch {
        // セッション復元失敗 → 空タブで開始
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
