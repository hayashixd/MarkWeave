/**
 * ウィンドウクローズ時の未保存ガードフック。
 *
 * window-tab-session-design.md §3.2 に準拠:
 * - 未保存タブがある場合、ウィンドウクローズをキャンセルして確認ダイアログを表示
 * - ユーザーが「閉じる」を選択した場合のみ destroy で閉じる
 * - 未保存タブがない場合はそのまま閉じる
 *
 * 注意: セッション保存 (saveSession) は未実装のため、Phase 1 では省略。
 */

import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ask } from '@tauri-apps/plugin-dialog';
import { useTabStore } from '../store/tabStore';

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
      if (dirtyFileNames.length === 0) return; // 未保存なし → そのまま閉じる

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
        appWindow.destroy(); // onCloseRequested を再トリガーしないよう destroy を使う
      }
    });

    return () => {
      cancelled = true;
      unlistenPromise.then((f) => f());
    };
  }, [dirtyFileNames.join(',')]); // dirtyFileNames の中身が変わったときだけ再登録
}
