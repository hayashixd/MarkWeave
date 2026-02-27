/**
 * ウィンドウクローズ時の未保存ガード + セッション保存フック。
 *
 * window-tab-session-design.md §3.2 に準拠:
 * - 未保存タブがある場合、ウィンドウクローズをキャンセルして確認ダイアログを表示
 * - ユーザーが「閉じる」を選択した場合のみ destroy で閉じる
 * - 未保存タブがない場合はセッションを保存してそのまま閉じる
 */

import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ask } from '@tauri-apps/plugin-dialog';
import { useTabStore } from '../store/tabStore';
import { saveSession } from '../store/session';

/** 現在のタブ状態からセッション情報を生成する */
function getCurrentSession() {
  const { tabs, activeTabId } = useTabStore.getState();
  const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : undefined;

  return {
    openFiles: tabs
      .filter((t) => t.filePath !== null)
      .map((t) => ({ path: t.filePath! })),
    activeFilePath: activeTab?.filePath ?? null,
    sidebarVisible: true, // Phase 1 ではサイドバー状態の追跡は省略
  };
}

export function useCloseGuard() {
  const tabs = useTabStore((s) => s.tabs);

  const dirtyFileNames = tabs
    .filter((t) => t.isDirty)
    .map((t) => t.fileName);

  useEffect(() => {
    let cancelled = false;

    const appWindow = getCurrentWebviewWindow();

    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      if (cancelled) return;

      if (dirtyFileNames.length === 0) {
        // 未保存なし → セッション保存してそのまま閉じる
        await saveSession(getCurrentSession()).catch(() => {});
        return;
      }

      event.preventDefault(); // デフォルトのクローズをキャンセル

      const fileList = dirtyFileNames.map((f) => `・${f}`).join('\n');
      const confirmed = await ask(
        `以下のファイルに未保存の変更があります:\n${fileList}\n\n保存せずに閉じますか？`,
        {
          title: '未保存の変更',
          kind: 'warning',
          okLabel: '閉じる',
          cancelLabel: 'キャンセル',
        },
      );

      if (confirmed) {
        await saveSession(getCurrentSession()).catch(() => {});
        appWindow.destroy(); // onCloseRequested を再トリガーしないよう destroy を使う
      }
    });

    return () => {
      cancelled = true;
      unlistenPromise.then((f) => f());
    };
  }, [dirtyFileNames.join(',')]); // dirtyFileNames の中身が変わったときだけ再登録
}
