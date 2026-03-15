/**
 * ウィンドウ間状態同期フック
 *
 * window-tab-session-design.md §11.4 に準拠:
 * 他のウィンドウからの状態変更イベントを受信して Zustand ストアを更新する。
 * AppShell で一度だけマウントする。
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useSettingsStore } from '../store/settingsStore';
import { useTabStore } from '../store/tabStore';
import type {
  SettingsChangedPayload,
  FileSavedPayload,
  FileLockPayload,
} from '../ipc/window-sync-events';

export function useWindowSync() {
  useEffect(() => {
    const unlisten: Array<() => void> = [];
    let myLabel = 'main';

    try {
      myLabel = getCurrentWebviewWindow().label;
    } catch {
      // Tauri 外（ブラウザ開発時）
    }

    // 設定変更の同期（テーマ・フォントサイズ等）
    listen<SettingsChangedPayload>('settings-changed', ({ payload }) => {
      const store = useSettingsStore.getState();
      if ('updateSettings' in store && typeof store.updateSettings === 'function') {
        store.updateSettings({ [payload.key]: payload.value });
      }
    }).then((fn) => unlisten.push(fn));

    // 他ウィンドウでのファイル保存通知
    listen<FileSavedPayload>('file-saved', ({ payload }) => {
      if (payload.windowLabel === myLabel) return;

      const tab = useTabStore
        .getState()
        .tabs.find((t) => t.filePath === payload.filePath);
      if (tab) {
        // 外部変更としてマーク — 既存の外部変更通知フローに乗せる
        window.dispatchEvent(
          new CustomEvent('external-file-change', {
            detail: { filePath: payload.filePath },
          }),
        );
      }
    }).then((fn) => unlisten.push(fn));

    // ファイルロック解放通知（Read-Only → 書き込み可能に切り替え通知）
    listen<FileLockPayload>('file-lock-released', ({ payload }) => {
      if (payload.windowLabel === myLabel) return;

      const tab = useTabStore
        .getState()
        .tabs.find((t) => t.filePath === payload.filePath && t.isReadOnly);
      if (tab) {
        // トースト通知（トーストストアが利用可能であれば）
        window.dispatchEvent(
          new CustomEvent('file-lock-released-notification', {
            detail: {
              filePath: payload.filePath,
              fileName: tab.fileName,
            },
          }),
        );
      }
    }).then((fn) => unlisten.push(fn));

    return () => unlisten.forEach((fn) => fn());
  }, []);
}
