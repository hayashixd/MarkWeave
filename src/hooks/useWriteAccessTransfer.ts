/**
 * 書き込み権限譲渡フック
 *
 * window-tab-session-design.md §12.3 に準拠:
 * Read-Only ウィンドウから「編集権限を取得する」ボタンを押したとき、
 * 現在の書き込みウィンドウへ権限譲渡をリクエストする。
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../store/tabStore';
import type {
  WriteAccessTransferPayload,
  WriteAccessDeniedPayload,
} from '../ipc/window-sync-events';

/**
 * 書き込み権限の譲渡リクエストを受信して確認ダイアログを表示する。
 * 書き込み権限を持つウィンドウ側でマウントする。
 */
export function useWriteAccessTransferHandler() {
  useEffect(() => {
    let myLabel = 'main';
    try {
      myLabel = getCurrentWebviewWindow().label;
    } catch {
      return;
    }

    const unlistenPromise = listen<WriteAccessTransferPayload>(
      'write-access-transfer-requested',
      async ({ payload }) => {
        if (payload.ownerLabel !== myLabel) return;

        const fileName = payload.filePath.split(/[/\\]/).pop() ?? payload.filePath;

        let confirmed = false;
        try {
          const { ask } = await import('@tauri-apps/plugin-dialog');
          confirmed = await ask(
            `別のウィンドウが「${fileName}」の編集権限を要求しています。\nこのウィンドウは読み取り専用になります。権限を譲渡しますか？`,
            { title: '編集権限の譲渡', okLabel: '譲渡する', cancelLabel: '拒否' },
          );
        } catch {
          confirmed = window.confirm(
            `別のウィンドウが「${fileName}」の編集権限を要求しています。\nこのウィンドウは読み取り専用になります。権限を譲渡しますか？`,
          );
        }

        if (confirmed) {
          await invoke('transfer_file_lock', {
            filePath: payload.filePath,
            fromLabel: myLabel,
            toLabel: payload.requesterLabel,
          });
          useTabStore.getState().setReadOnly(payload.filePath, true);
        } else {
          await invoke('notify_write_access_denied', {
            filePath: payload.filePath,
            requesterLabel: payload.requesterLabel,
          });
        }
      },
    );

    // 権限拒否通知を受信（自分がリクエスタだった場合）
    const unlistenDenied = listen<WriteAccessDeniedPayload>(
      'write-access-denied',
      ({ payload }) => {
        const fileName = payload.filePath.split(/[/\\]/).pop() ?? payload.filePath;
        window.dispatchEvent(
          new CustomEvent('toast-notification', {
            detail: {
              type: 'warning',
              message: `「${fileName}」の編集権限の譲渡が拒否されました`,
            },
          }),
        );
      },
    );

    return () => {
      unlistenPromise.then((fn) => fn());
      unlistenDenied.then((fn) => fn());
    };
  }, []);
}

/**
 * 書き込み権限をリクエストする。
 * Read-Only タブから呼び出す。
 */
export async function requestWriteAccess(filePath: string): Promise<void> {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const myLabel = getCurrentWebviewWindow().label;
    const { invoke } = await import('@tauri-apps/api/core');

    // まずロック取得を試みる（元のウィンドウが既に閉じている可能性）
    const result = await invoke<{ acquired: boolean; ownerLabel: string | null }>(
      'try_acquire_file_lock',
      { filePath, windowLabel: myLabel },
    );

    if (result.acquired) {
      // ロック取得成功 — Read-Only を解除
      useTabStore.getState().setReadOnly(filePath, false);
      return;
    }

    if (result.ownerLabel) {
      // 権限譲渡リクエストを送信
      await invoke('emit_to_window', {
        label: result.ownerLabel,
        event: 'write-access-transfer-requested',
        payload: {
          filePath,
          requesterLabel: myLabel,
          ownerLabel: result.ownerLabel,
        },
      });
    }
  } catch {
    // Tauri 外ではスキップ
  }
}
