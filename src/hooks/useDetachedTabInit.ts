/**
 * 切り出されたウィンドウの初期化フック
 *
 * window-tab-session-design.md §11 に準拠:
 * detach_tab_to_window コマンドで作成された新しいウィンドウが
 * init-detached-tab イベントを受信し、タブを初期化する。
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/tabStore';
import type { FileEncoding, LineEnding, FileType } from '../store/tabStore';
import type { InitDetachedTabPayload } from '../ipc/window-sync-events';

export function useDetachedTabInit() {
  useEffect(() => {
    const unlistenPromise = listen<InitDetachedTabPayload>(
      'init-detached-tab',
      ({ payload }) => {
        const { tabs } = useTabStore.getState();

        // 既にタブがある場合は重複初期化を防止
        if (tabs.length > 0) return;

        useTabStore.getState().addTab({
          filePath: payload.filePath,
          fileName: payload.fileName,
          content: payload.content,
          savedContent: payload.content,
          encoding: payload.encoding as FileEncoding,
          lineEnding: payload.lineEnding as LineEnding,
          fileType: payload.fileType as FileType,
        });
      },
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);
}
