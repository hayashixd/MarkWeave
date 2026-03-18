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

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../store/tabStore';
import { useToastStore } from '../store/toastStore';
import { usePaneStore } from '../store/paneStore';
import { loadSession, checkNeedsRecovery } from '../store/session';
import { clearRecoveryData } from '../store/crash-recovery';
import type { RecoveryEntry } from '../store/crash-recovery';
import { useOpenFileAsTab } from './useOpenFileAsTab';

/**
 * クラッシュリカバリが必要な場合のリカバリエントリを返すフック。
 * RecoveryDialog の表示制御に使用する。
 */
export function useRecoveryCheck() {
  const [recoveryEntries, setRecoveryEntries] = useState<RecoveryEntry[] | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Tauri 環境以外では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    checkNeedsRecovery()
      .then((entries) => setRecoveryEntries(entries))
      .catch(() => {}); // チェック失敗は無視
  }, []);

  const handleRestore = (entries: RecoveryEntry[]) => {
    const addTab = useTabStore.getState().addTab;
    const setActiveTab = useTabStore.getState().setActiveTab;

    // リカバリエントリからタブを作成（未保存状態として開く）
    let firstTabId: string | null = null;
    for (const entry of entries) {
      const fileName = entry.filePath.split(/[\\/]/).pop() ?? 'Untitled';
      const tabId = addTab({
        filePath: entry.filePath,
        fileName,
        content: entry.content,
        savedContent: entry.savedContent,
      });
      if (!firstTabId) firstTabId = tabId;
    }
    if (firstTabId) setActiveTab(firstTabId);

    // リカバリデータを削除
    clearRecoveryData().catch(() => {});
    setRecoveryEntries(null);
  };

  const handleDiscard = () => {
    clearRecoveryData().catch(() => {});
    setRecoveryEntries(null);
  };

  return { recoveryEntries, handleRestore, handleDiscard };
}

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

    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      // 非Tauri環境（ブラウザ・テスト）では空タブで開始（トースト不要）
      if (tabs.length === 0) {
        addTab({ filePath: null, fileName: 'Untitled', content: '', savedContent: '' });
      }
      return;
    }

    (async () => {
      try {
        const session = await loadSession();
        if (!session || session.openFiles.length === 0) {
          // CLI 引数でファイルが指定されている場合は空タブを作らない。
          // useFileOpenListener が後続で get_startup_file_paths を呼んで開く。
          const hasStartupFiles = await invoke<boolean>('has_startup_files');
          if (!hasStartupFiles && tabs.length === 0) {
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
        // skipActivate: true で全ファイルを追加し、中間タブのエディタ再マウントを防ぐ。
        // 最後に setActiveTab で一度だけアクティブタブを確定する。
        let activeTabId: string | null = null;
        let firstTabId: string | null = null;
        let failCount = 0;

        for (const file of session.openFiles) {
          const tabId = await openFileAsTab(file.path, { skipActivate: true });
          if (tabId === null) {
            failCount++;
          } else {
            if (!firstTabId) firstTabId = tabId;
            if (file.path === session.activeFilePath) {
              activeTabId = tabId;
            }
          }
        }

        // アクティブタブを復元（skipActivate で全タブ非アクティブのため、ここで確定）
        const targetTabId = activeTabId ?? firstTabId;
        if (targetTabId) {
          setActiveTab(targetTabId);
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
        // セッション復元失敗 → CLI 引数がなければ空タブで開始
        show('warning', 'セッションの復元に失敗しました。新規ファイルで開始します。');
        const hasStartupFiles = await invoke<boolean>('has_startup_files').catch(() => false);
        if (!hasStartupFiles && tabs.length === 0) {
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
