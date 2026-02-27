/**
 * ウィンドウクローズ時の未保存ガード + セッション保存フック。
 *
 * window-tab-session-design.md §3.2 に準拠:
 * - 未保存タブがある場合、ウィンドウクローズをキャンセルして確認ダイアログを表示
 * - ユーザーが「閉じる」を選択した場合のみ destroy で閉じる
 * - 未保存タブがない場合はセッションを保存してそのまま閉じる
 *
 * エラーハンドリング:
 * - ダイアログ表示が失敗した場合は window.confirm にフォールバック
 * - セッション保存が失敗してもウィンドウのクローズはブロックしない
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

/** 未保存確認ダイアログを表示する（Tauri ダイアログ → window.confirm フォールバック） */
async function showUnsavedConfirmation(dirtyFileNames: string[]): Promise<boolean> {
  const fileList = dirtyFileNames.map((f) => `・${f}`).join('\n');
  const message = `以下のファイルに未保存の変更があります:\n${fileList}\n\n保存せずに閉じますか？`;

  try {
    return await ask(message, {
      title: '未保存の変更',
      kind: 'warning',
      okLabel: '閉じる',
      cancelLabel: 'キャンセル',
    });
  } catch {
    // Tauri ダイアログが失敗した場合は window.confirm にフォールバック
    return window.confirm(message);
  }
}

export function useCloseGuard() {
  const tabs = useTabStore((s) => s.tabs);

  const dirtyFileNames = tabs
    .filter((t) => t.isDirty)
    .map((t) => t.fileName);

  useEffect(() => {
    // Tauri 環境以外（ブラウザ開発時）では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

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

      try {
        const confirmed = await showUnsavedConfirmation(dirtyFileNames);

        if (confirmed) {
          await saveSession(getCurrentSession()).catch(() => {});
          appWindow.destroy(); // onCloseRequested を再トリガーしないよう destroy を使う
        }
      } catch {
        // ダイアログ表示自体が完全に失敗した場合は、安全にウィンドウを閉じる
        await saveSession(getCurrentSession()).catch(() => {});
        appWindow.destroy();
      }
    });

    return () => {
      cancelled = true;
      unlistenPromise.then((f) => f());
    };
  }, [dirtyFileNames.join(',')]); // dirtyFileNames の中身が変わったときだけ再登録
}
